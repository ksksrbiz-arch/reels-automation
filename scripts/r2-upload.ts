/**
 * r2-upload.ts
 * Cloudflare R2 multipart upload helper using the AWS S3-compatible API.
 *
 * Usage (standalone):
 *   npx tsx scripts/r2-upload.ts --file /tmp/clip.mp4 --key broll/<uuid>.mp4
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { parseArgs } from 'util';

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const PART_SIZE = 50 * 1024 * 1024;             // 50 MB per part

function buildS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID is not set');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType = 'video/mp4',
  bucket = process.env.R2_BUCKET ?? 'reels-media',
): Promise<string> {
  const s3 = buildS3Client();

  if (buffer.length <= MULTIPART_THRESHOLD) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  } else {
    await multipartUpload(s3, bucket, key, buffer, contentType);
  }

  const publicBase = process.env.R2_PUBLIC_BASE_URL ?? '';
  return publicBase ? `${publicBase}/${key}` : key;
}

async function multipartUpload(
  s3: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const create = await s3.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  }));

  const uploadId = create.UploadId!;
  const parts: Array<{ PartNumber: number; ETag: string }> = [];

  let partNumber = 1;
  let offset = 0;

  while (offset < buffer.length) {
    const chunk = buffer.subarray(offset, offset + PART_SIZE);
    const part = await s3.send(new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
    }));
    parts.push({ PartNumber: partNumber, ETag: part.ETag! });
    console.log(`[r2] Uploaded part ${partNumber} (${chunk.length} bytes)`);
    offset += PART_SIZE;
    partNumber++;
  }

  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));
}

export async function uploadFile(
  filePath: string,
  key: string,
  contentType = 'video/mp4',
): Promise<string> {
  const buffer = await readFile(filePath);
  return uploadBuffer(buffer, key, contentType);
}

// ─── Standalone CLI ──────────────────────────────────────────────────────────
if (process.argv[1].endsWith('r2-upload.ts') || process.argv[1].endsWith('r2-upload.js')) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: 'string' },
      key: { type: 'string' },
      'content-type': { type: 'string', default: 'video/mp4' },
    },
  });

  if (!values.file || !values.key) {
    console.error('Usage: npx tsx scripts/r2-upload.ts --file /tmp/clip.mp4 --key broll/<uuid>.mp4');
    process.exit(1);
  }

  uploadFile(values.file, values.key, values['content-type'] ?? 'video/mp4')
    .then(url => console.log(`[r2] Uploaded: ${url}`))
    .catch(err => {
      console.error('[r2] Error:', err.message);
      process.exit(1);
    });
}
