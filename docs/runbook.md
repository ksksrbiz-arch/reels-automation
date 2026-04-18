# Runbook

Day-to-day operating procedures for the Reels Automation Pipeline.

---

## Weekly rhythm

| Day | Action | Time |
|-----|--------|------|
| **Sunday 6pm** | Cron fires 01-ideation → 14 draft concepts in Supabase | auto |
| **Monday** | Keith reviews drafts, kills/approves via admin-cli or Supabase UI | 20 min |
| **Mon–Fri** | 02-broll cron generates Veo B-roll for wisdom + identity pillars | auto |
| **Tuesday** | Keith batch-records talking-head clips | 2 hr |
| **Tue afternoon** | Keith drops `.mp4` files into Drive folder | 5 min |
| **Tue–Wed** | 03-ingest picks up clips → 04-edit runs Submagic | auto |
| **Daily** | 05-publish cron checks every 10 min, posts ready reels | auto |
| **Daily 11pm** | 07-analytics pulls IG insights for posted reels | auto |
| **Sunday 3am** | 06-token-refresh renews IG long-lived token | auto |

---

## Admin CLI commands

```bash
# List all drafts awaiting review
npx tsx scripts/admin-cli.ts list --status draft

# Approve a reel
npx tsx scripts/admin-cli.ts approve <reel-id>

# Kill a reel (with optional reason)
npx tsx scripts/admin-cli.ts kill <reel-id> --reason "hook is too generic"

# Show all details for a reel
npx tsx scripts/admin-cli.ts show <reel-id>

# What needs to be recorded this week?
npx tsx scripts/admin-cli.ts upcoming-recordings
```

---

## Monitoring checklist (5 min/day)

1. Check the Discord/Slack `#reels-alerts` channel for any `⚠️` messages
2. Run `npx tsx scripts/admin-cli.ts list --status ready` — verify reels are scheduled
3. Check n8n execution history for red (failed) executions

---

## Cost tracking

- **Veo B-roll**: ~$1.20/reel. Monthly cap = 25 reels = ~$30. Cost guard built into 02-broll workflow.
- **Claude Opus 4**: ~$0.15–0.50/weekly ideation run (8k tokens out).
- **Submagic**: $16/mo flat.
- **R2 storage**: ~$0.015/GB stored. Negligible at this scale.

---

## Adjusting the schedule

Edit `scheduled_for` in Supabase directly, or:

```sql
UPDATE reels_queue
SET scheduled_for = '2026-04-25 18:00:00+00'
WHERE id = '<reel-id>';
```

---

## Pausing the pipeline

To stop publishing temporarily:
1. In n8n, deactivate `05-ig-publish`
2. All `ready` reels will stay queued and publish when re-activated

To pause B-roll generation:
1. Deactivate `02-daily-broll-generation` in n8n

---

## Manually triggering a publish

```bash
npx tsx scripts/ig-publisher.ts --reel-id <uuid>
```

---

## Manually refreshing the IG token

```bash
npx tsx scripts/ig-token-refresh.ts
```
