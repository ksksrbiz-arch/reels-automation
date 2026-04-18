/**
 * ig-publisher.ts
 * Instagram Graph API wrapper for creating and publishing Reels.
 * Handles container creation → status polling → publish in one call.
 *
 * Usage (standalone):
 *   npx tsx scripts/ig-publisher.ts --reel-id <uuid>
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'util';

const IG_API_BASE = 'https://graph.facebook.com/v21.0';
const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 10; // 5 minutes max

interface ReelRow {
  id: string;
  final_reel_url: string;
  caption: string;
  hashtags: string[];
  hook: string;
}

export interface PublishResult {
  igMediaId: string;
  containerId: string;
}

export async function createMediaContainer(
  accountId: string,
  accessToken: string,
  reel: ReelRow,
): Promise<string> {
  const caption = [reel.caption, (reel.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n');
  const url = `${IG_API_BASE}/${accountId}/media`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: reel.final_reel_url,
      caption,
      access_token: accessToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create container failed (${res.status}): ${err}`);
  }

  const json = (await res.json()) as { id?: string; error?: { message: string } };
  if (!json.id) throw new Error(`No container ID in response: ${JSON.stringify(json)}`);
  return json.id;
}

export async function pollContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<string> {
  const url = `${IG_API_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Poll container failed (${res.status}): ${err}`);
  }
  const json = (await res.json()) as { status_code?: string };
  return json.status_code ?? 'UNKNOWN';
}

export async function publishContainer(
  accountId: string,
  accessToken: string,
  containerId: string,
): Promise<string> {
  const url = `${IG_API_BASE}/${accountId}/media_publish`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Publish failed (${res.status}): ${err}`);
  }

  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error('No media ID returned from publish');
  return json.id;
}

export async function publishReel(
  reel: ReelRow,
  accountId: string,
  accessToken: string,
): Promise<PublishResult> {
  console.log(`[ig] Creating media container for reel ${reel.id}…`);
  const containerId = await createMediaContainer(accountId, accessToken, reel);
  console.log(`[ig] Container: ${containerId}. Waiting 60s for IG processing…`);
  await new Promise<void>(resolve => setTimeout(resolve, 60_000));

  let attempts = 0;
  let statusCode = '';
  while (statusCode !== 'FINISHED') {
    statusCode = await pollContainerStatus(containerId, accessToken);
    console.log(`[ig] Container status: ${statusCode}`);

    if (statusCode === 'ERROR') {
      throw new Error(`Container ${containerId} entered ERROR state`);
    }

    if (statusCode !== 'FINISHED') {
      attempts++;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw new Error(`Container ${containerId} stuck after ${attempts} poll attempts`);
      }
      await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  console.log('[ig] Container FINISHED. Publishing…');
  const igMediaId = await publishContainer(accountId, accessToken, containerId);
  console.log(`[ig] Published! Media ID: ${igMediaId}`);

  return { igMediaId, containerId };
}

// ─── Standalone CLI ──────────────────────────────────────────────────────────
if (process.argv[1].endsWith('ig-publisher.ts') || process.argv[1].endsWith('ig-publisher.js')) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'reel-id': { type: 'string' },
    },
  });

  if (!values['reel-id']) {
    console.error('Usage: npx tsx scripts/ig-publisher.ts --reel-id <uuid>');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  (async () => {
    const { data: reel, error } = await supabase
      .from('reels_queue')
      .select('id,final_reel_url,caption,hashtags,hook')
      .eq('id', values['reel-id'])
      .single();

    if (error || !reel) {
      console.error('Reel not found:', error?.message);
      process.exit(1);
    }

    const { data: tokenRow } = await supabase
      .from('api_tokens')
      .select('token')
      .eq('id', 'ig_long_lived')
      .single();

    if (!tokenRow) {
      console.error('IG token not found in api_tokens');
      process.exit(1);
    }

    const result = await publishReel(
      reel as ReelRow,
      process.env.IG_BUSINESS_ACCOUNT_ID!,
      tokenRow.token,
    );

    await supabase
      .from('reels_queue')
      .update({ status: 'posted', posted_at: new Date().toISOString(), ig_media_id: result.igMediaId })
      .eq('id', reel.id);

    console.log(`[ig] Done. https://www.instagram.com/reel/${result.igMediaId}`);
  })().catch(err => {
    console.error('[ig] Error:', err.message);
    process.exit(1);
  });
}
