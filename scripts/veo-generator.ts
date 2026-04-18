/**
 * veo-generator.ts
 * Wrapper around the Google Gemini Veo 3.1 Fast API for generating vertical B-roll clips.
 * Uses the @google/genai SDK. Downloads in the same process — Veo URIs expire in minutes.
 *
 * Usage (standalone):
 *   npx tsx scripts/veo-generator.ts --prompt "..." --output /tmp/clip.mp4
 */

import 'dotenv/config';
import { readFile, rename, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { parseArgs } from 'util';
import { GoogleGenAI } from '@google/genai';

const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 40; // ~10 min ceiling

export interface VeoJobInput {
  prompt: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  durationSeconds?: number;
  generateAudio?: boolean;
}

export interface VeoJobResult {
  video: Buffer;
  durationSeconds: number;
  operationName: string;
}

function buildClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

export async function generateVeoClip(input: VeoJobInput): Promise<VeoJobResult> {
  const ai = buildClient();

  console.log('[veo] Submitting job…');
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-preview',
    prompt: input.prompt,
    config: {
      aspectRatio: input.aspectRatio ?? '9:16',
      resolution: input.resolution ?? '1080p',
      durationSeconds: input.durationSeconds ?? 8,
      generateAudio: input.generateAudio ?? true,
      numberOfVideos: 1,
    },
  });

  const operationName = operation.name ?? 'unknown';
  console.log(`[veo] Operation: ${operationName}`);

  let attempts = 0;
  while (!operation.done) {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      throw new Error(`Veo operation stuck after ${attempts} poll attempts (~10 min)`);
    }
    await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await ai.operations.getVideosOperation({ operation });
    attempts++;
    console.log(`[veo] Poll ${attempts}: ${operation.done ? 'done' : 'in-progress'}`);
  }

  if (operation.error) {
    throw new Error(`Veo operation failed: ${operation.error.message}`);
  }

  const generated = operation.response?.generatedVideos?.[0]?.video;
  if (!generated) throw new Error('Veo completed but returned no video');

  // Download immediately — Veo URIs expire within minutes
  console.log('[veo] Downloading generated video…');
  const tmpPath = join(tmpdir(), `veo-${randomUUID()}.mp4`);
  await ai.files.download({ file: generated, downloadPath: tmpPath });
  const buffer = await readFile(tmpPath);
  await unlink(tmpPath).catch(() => { /* best-effort */ });

  return {
    video: buffer,
    durationSeconds: input.durationSeconds ?? 8,
    operationName,
  };
}

export async function generateVeoClipToFile(
  input: VeoJobInput,
  outputPath: string,
): Promise<VeoJobResult> {
  const result = await generateVeoClip(input);
  const tmpPath = `${outputPath}.part`;
  await writeFile(tmpPath, result.video);
  await rename(tmpPath, outputPath);
  return result;
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

  generateVeoClipToFile(
    {
      prompt: values.prompt,
      aspectRatio: (values.aspect as '9:16' | '16:9') ?? '9:16',
      resolution: (values.resolution as '1080p' | '720p') ?? '1080p',
      durationSeconds: parseInt(values.duration ?? '8', 10),
    },
    values.output!,
  )
    .then(result => {
      console.log(`[veo] Saved to ${values.output} (${result.video.length} bytes)`);
    })
    .catch(err => {
      console.error('[veo] Error:', err.message);
      process.exit(1);
    });
}
