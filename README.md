# reels-automation

> **Owner**: Keith J. Skaggs Jr. | 1Commerce LLC  
> **Target**: Running end-to-end by Fri Apr 24, 2026  
> **Account**: `@keithjskaggs`

Automated Instagram Reels pipeline. Generates 14 concepts/week via Claude, creates B-roll via Veo 3.1 Fast, ingests Keith's talking-head recordings from Google Drive, captions via Submagic, and publishes to Instagram on schedule — all via n8n cron jobs.

**After setup, Keith spends ~3 hrs/week total.** Everything else runs on cron.

---

## Architecture

```
Sun 6pm cron  →  01-ideation  →  Claude API  →  Supabase reels_queue (status=draft)
Daily 2am     →  02-broll     →  Veo 3.1     →  R2 → Supabase (status=broll_ready/ready)
Keith upload  →  03-ingest    →  Drive watch →  R2 → Supabase (status=editing)
Webhook       →  04-edit      →  Submagic    →  R2 → Supabase (status=ready)
Every 10 min  →  05-publish   →  IG Graph API→  Supabase (status=posted)
Sun 3am       →  06-refresh   →  IG OAuth    →  Supabase api_tokens
Daily 11pm    →  07-analytics →  IG Insights →  Supabase (metrics updated)
```

---

## Repo structure

```
reels-automation/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
│
├── supabase/migrations/
│   ├── 20260418_001_reels_queue.sql   # Main table, enums, indexes, view
│   ├── 20260418_002_helpers.sql       # Helper functions, api_tokens table
│   └── 20260418_003_rls.sql           # Row-level security
│
├── n8n-workflows/
│   ├── 01-weekly-ideation.json        # Claude → 14 concepts → Supabase
│   ├── 02-daily-broll-generation.json # Veo 3.1 B-roll → R2
│   ├── 03-recording-ingest.json       # Drive watcher → R2
│   ├── 04-auto-edit-submagic.json     # Submagic captioning → R2
│   ├── 05-ig-publish.json             # IG Graph API publish
│   ├── 06-token-refresh.json          # IG 60-day token rotation
│   └── 07-analytics-pull.json         # IG Insights → Supabase
│
├── scripts/
│   ├── veo-generator.ts               # Veo 3.1 API wrapper
│   ├── ig-publisher.ts                # IG Graph API wrapper
│   ├── r2-upload.ts                   # Cloudflare R2 multipart upload
│   ├── ig-token-refresh.ts            # Token refresh utility
│   └── admin-cli.ts                   # Queue management CLI
│
├── prompts/
│   ├── ideation-system-prompt.md      # Claude system prompt for ideation
│   └── broll-prompt-examples.md       # Veo 3.1 prompt style guide
│
└── docs/
    ├── setup.md                       # One-time setup guide
    ├── runbook.md                     # Weekly operating procedures
    └── troubleshooting.md             # Common issues and fixes
```

---

## Quick start

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Run Supabase migrations (via Supabase CLI or paste into SQL editor)
supabase db push

# Import n8n workflows (see docs/setup.md §5)

# Verify setup
npx tsx scripts/admin-cli.ts list
```

See **[docs/setup.md](docs/setup.md)** for the full setup walkthrough.  
See **[docs/runbook.md](docs/runbook.md)** for weekly operating procedures.  
See **[docs/troubleshooting.md](docs/troubleshooting.md)** for common issues.

---

## Content pillars

| Pillar | % | Format | Duration |
|--------|---|--------|----------|
| `operator_wisdom` | 43% | Aspirational B-roll + quote | 7-15s |
| `build_in_public` | 29% | Screen recording / talking-head | 15-30s |
| `trades_to_tech` | 14% | Story-driven talking-head | 30-60s |
| `pnw_identity` | 14% | Aesthetic B-roll only | 5-10s |

---

## Cost summary

| Service | Cost |
|---------|------|
| Veo 3.1 B-roll | ~$1.20/clip, capped at 25/month (~$30) |
| Claude Opus 4 | ~$0.15–0.50/week |
| Submagic | $16/month flat |
| Cloudflare R2 | ~$0.015/GB (negligible) |
| **Total** | **~$50/month** |
