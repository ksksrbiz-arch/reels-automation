/**
 * veo-generator.ts
 * Wrapper around the Google Gemini Veo 3.1 Fast API for generating vertical B-roll clips.
 * Called by n8n's Execute Command node or imported into Function nodes.
 *
 * Usage (standalone):
 *   npx tsx scripts/veo-generator.ts --prompt "..." --output /tmp/clip.mp4
 */

import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { parseArgs } from 'util';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const POLL_INTERVAL_MS = 30_000;

export interface VeoJobInput {
  prompt: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  durationSeconds?: number;
  generateAudio?: boolean;
}

export interface VeoJobResult {
  videoUri: string;
  durationSeconds: number;
  operationName: string;
}

interface VeoOperation {
  name: string;
  done?: boolean;
  response?: {
    videos?: Array<{ uri: string; encoding: string }>;
  };
  error?: { code: number; message: string };
}

async function submitVeoJob(input: VeoJobInput): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-preview:predictLongRunning?key=${GEMINI_API_KEY}`;
  const body = {
    instances: [{ prompt: input.prompt }],
    parameters: {
      aspectRatio: input.aspectRatio ?? '9:16',
      resolution: input.resolution ?? '1080p',
      duration: input.durationSeconds ?? 8,
      generateAudio: input.generateAudio ?? true,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Veo submit failed (${res.status}): ${err}`);
  }

  const op = (await res.json()) as VeoOperation;
  if (!op.name) throw new Error('Veo response missing operation name');
  return op.name;
}

async function pollVeoOperation(operationName: string): Promise<VeoOperation> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Veo poll failed (${res.status}): ${err}`);
  }
  return (await res.json()) as VeoOperation;
}

export async function generateVeoClip(input: VeoJobInput): Promise<VeoJobResult> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  console.log('[veo] Submitting job…');
  const operationName = await submitVeoJob(input);
  console.log(`[veo] Operation: ${operationName}`);

  let op: VeoOperation = { name: operationName };
  while (!op.done) {
    await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    op = await pollVeoOperation(operationName);
    console.log(`[veo] Status: ${op.done ? 'done' : 'in-progress'}`);
  }

  if (op.error) {
    throw new Error(`Veo operation failed: ${op.error.message} (code ${op.error.code})`);
  }

  const videos = op.response?.videos;
  if (!videos?.length) throw new Error('Veo completed but returned no videos');
  const videoUri = videos[0].uri;

  return {
    videoUri,
    durationSeconds: input.durationSeconds ?? 8,
    operationName,
  };
}

export async function downloadVeoClip(videoUri: string): Promise<Buffer> {
  const res = await fetch(videoUri);
  if (!res.ok) throw new Error(`Failed to download Veo clip (${res.status})`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ─── Standalone CLI ──────────────────────────────────────────────────────────
if (process.argv[1].endsWith('veo-generator.ts') || process.argv[1].endsWith('veo-generator.js')) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      prompt: { type: 'string' },
      output: { type: 'string', default: '/tmp/veo-clip.mp4' },
      aspect: { type: 'string', default: '9:16' },
      resolution: { type: 'string', default: '1080p' },
      duration: { type: 'string', default: '8' },
    },
  });

  if (!values.prompt) {
    console.error('Usage: npx tsx scripts/veo-generator.ts --prompt "..." [--output /tmp/clip.mp4]');
    process.exit(1);
  }

  generateVeoClip({
    prompt: values.prompt,
    aspectRatio: (values.aspect as '9:16' | '16:9') ?? '9:16',
    resolution: (values.resolution as '1080p' | '720p') ?? '1080p',
    durationSeconds: parseInt(values.duration ?? '8', 10),
  })
    .then(async result => {
      console.log(`[veo] Done. Downloading from ${result.videoUri}`);
      const buf = await downloadVeoClip(result.videoUri);
      await writeFile(values.output!, buf);
      console.log(`[veo] Saved to ${values.output}`);
    })
    .catch(err => {
      console.error('[veo] Error:', err.message);
      process.exit(1);
    });
}
