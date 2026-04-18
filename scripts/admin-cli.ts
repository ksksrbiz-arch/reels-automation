/**
 * admin-cli.ts
 * CLI for managing reels in the queue — approve, kill, list, and inspect.
 *
 * Usage:
 *   npx tsx scripts/admin-cli.ts list [--status draft]
 *   npx tsx scripts/admin-cli.ts approve <reel-id>
 *   npx tsx scripts/admin-cli.ts kill <reel-id> [--reason "too generic"]
 *   npx tsx scripts/admin-cli.ts show <reel-id>
 *   npx tsx scripts/admin-cli.ts upcoming-recordings
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseArgs } from 'util';

function buildClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key);
}

const VALID_STATUSES = [
  'draft', 'approved', 'broll_ready', 'recording_needed',
  'editing', 'ready', 'posted', 'killed',
] as const;

type ReelStatus = typeof VALID_STATUSES[number];

async function cmdList(supabase: SupabaseClient, status?: string): Promise<void> {
  let query = supabase
    .from('reels_queue')
    .select('id,pillar,status,hook,scheduled_for,ig_media_id')
    .order('scheduled_for', { ascending: true });

  if (status) {
    if (!VALID_STATUSES.includes(status as ReelStatus)) {
      console.error(`Invalid status: ${status}. Valid values: ${VALID_STATUSES.join(', ')}`);
      process.exit(1);
    }
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data?.length) {
    console.log('No reels found.');
    return;
  }

  console.log(`\n${'ID'.padEnd(38)} ${'PILLAR'.padEnd(18)} ${'STATUS'.padEnd(18)} ${'SCHEDULED'.padEnd(22)} HOOK`);
  console.log('─'.repeat(130));
  for (const r of data) {
    const scheduled = r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : 'unscheduled';
    console.log(
      `${r.id.padEnd(38)} ${(r.pillar ?? '').padEnd(18)} ${(r.status ?? '').padEnd(18)} ${scheduled.padEnd(22)} ${r.hook?.slice(0, 60) ?? ''}`
    );
  }
  console.log();
}

async function cmdApprove(supabase: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('reels_queue')
    .update({ status: 'approved' })
    .eq('id', id)
    .select('id,hook,status')
    .single();

  if (error) throw error;
  console.log(`✅ Approved: [${data.id}] "${data.hook}"`);
}

async function cmdKill(supabase: SupabaseClient, id: string, reason?: string): Promise<void> {
  const update: Record<string, string> = { status: 'killed' };
  if (reason) update.notes = reason;

  const { data, error } = await supabase
    .from('reels_queue')
    .update(update)
    .eq('id', id)
    .select('id,hook')
    .single();

  if (error) throw error;
  console.log(`🗑️  Killed: [${data.id}] "${data.hook}"${reason ? ` — ${reason}` : ''}`);
}

async function cmdShow(supabase: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('reels_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error(`Reel not found: ${id}`);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

async function cmdUpcomingRecordings(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc('upcoming_recording_needs');
  if (error) throw error;

  if (!data?.length) {
    console.log('No recordings needed at this time.');
    return;
  }

  console.log('\n📹 Upcoming recording needs:\n');
  for (const r of data) {
    console.log(`  [${r.pillar}] ${r.hook}`);
    console.log(`    Script: ${r.script?.slice(0, 120) ?? '(none)'}…`);
    console.log(`    Scheduled: ${r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : 'unscheduled'}`);
    console.log(`    ID: ${r.id}\n`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    status: { type: 'string' },
    reason: { type: 'string' },
  },
});

const [command, id] = positionals;
const supabase = buildClient();

(async () => {
  switch (command) {
    case 'list':
      await cmdList(supabase, values.status);
      break;

    case 'approve':
      if (!id) { console.error('Usage: admin-cli approve <reel-id>'); process.exit(1); }
      await cmdApprove(supabase, id);
      break;

    case 'kill':
      if (!id) { console.error('Usage: admin-cli kill <reel-id> [--reason "..."]'); process.exit(1); }
      await cmdKill(supabase, id, values.reason);
      break;

    case 'show':
      if (!id) { console.error('Usage: admin-cli show <reel-id>'); process.exit(1); }
      await cmdShow(supabase, id);
      break;

    case 'upcoming-recordings':
      await cmdUpcomingRecordings(supabase);
      break;

    default:
      console.error(
        'Commands: list [--status <status>] | approve <id> | kill <id> [--reason "..."] | show <id> | upcoming-recordings'
      );
      process.exit(1);
  }
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
