/**
 * ig-token-refresh.ts
 * Refreshes the Instagram long-lived access token and updates Supabase.
 * Run weekly (Sunday 3am) via n8n cron or standalone.
 *
 * Usage (standalone):
 *   npx tsx scripts/ig-token-refresh.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const IG_REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';
const TOKEN_ROW_ID = 'ig_long_lived';

export interface RefreshResult {
  accessToken: string;
  expiresAt: Date;
}

export async function refreshIgToken(currentToken: string): Promise<RefreshResult> {
  const url = `${IG_REFRESH_URL}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };

  if (json.error) throw new Error(`IG refresh error: ${json.error.message}`);
  if (!json.access_token) throw new Error('No access_token in refresh response');

  const expiresIn = json.expires_in ?? 5184000; // default 60 days
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return { accessToken: json.access_token, expiresAt };
}

async function run(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: tokenRow, error: loadErr } = await supabase
    .from('api_tokens')
    .select('token')
    .eq('id', TOKEN_ROW_ID)
    .single();

  if (loadErr || !tokenRow) {
    throw new Error(`Could not load token from Supabase: ${loadErr?.message ?? 'not found'}`);
  }

  console.log('[token-refresh] Refreshing IG long-lived token…');
  const result = await refreshIgToken(tokenRow.token);

  const { error: updateErr } = await supabase
    .from('api_tokens')
    .upsert({
      id: TOKEN_ROW_ID,
      token: result.accessToken,
      refreshed_at: new Date().toISOString(),
      expires_at: result.expiresAt.toISOString(),
    });

  if (updateErr) throw new Error(`Failed to save refreshed token: ${updateErr.message}`);

  console.log(`[token-refresh] Token refreshed. Expires: ${result.expiresAt.toISOString()}`);
}

if (process.argv[1].endsWith('ig-token-refresh.ts') || process.argv[1].endsWith('ig-token-refresh.js')) {
  run().catch(err => {
    console.error('[token-refresh] CRITICAL:', err.message);
    process.exit(1);
  });
}
