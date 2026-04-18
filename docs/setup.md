# Setup Guide

This guide walks through the one-time setup steps required before the pipeline runs automatically.

---

## Prerequisites (Keith does these first)

| # | Task | Where | Time |
|---|------|-------|------|
| 1 | Create IG Creator account `@keithjskaggs` | Instagram app | 5 min |
| 2 | Convert @1commerce_llc to Business, link both to Facebook Page | IG Settings | 10 min |
| 3 | Create Meta Developer App → Add Instagram Graph API product | developers.facebook.com | 15 min |
| 4 | Generate long-lived IG access token (60-day) for Creator account | Graph API Explorer | 10 min |
| 5 | Enable Gemini API billing + request Veo 3.1 access | ai.google.dev | 20 min |
| 6 | Create Anthropic API key | console.anthropic.com | 2 min |
| 7 | Create Cloudflare R2 bucket `reels-media` + R2 API token | Cloudflare dash | 5 min |
| 8 | Create Submagic account + API key (optional, $16/mo) | submagic.co | 5 min |
| 9 | Confirm n8n running on Contabo w/ HTTPS webhook URL | Contabo SSH | verify |
| 10 | Create Google Drive folder `1commerce-reels-inbox` + service account | Google Cloud Console | 15 min |

---

## 1. Install dependencies

```bash
cd reels-automation/
npm install
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value. See comments in `.env.example` for where to find each credential.

---

## 3. Run Supabase migrations

If using the Supabase CLI:

```bash
supabase db push
```

Or run each file manually in the Supabase SQL editor:
1. `supabase/migrations/20260418_001_reels_queue.sql`
2. `supabase/migrations/20260418_002_helpers.sql`
3. `supabase/migrations/20260418_003_rls.sql`

---

## 4. Seed the IG access token

Run this once after generating your long-lived token:

```sql
INSERT INTO api_tokens (id, token, expires_at)
VALUES (
  'ig_long_lived',
  'YOUR_LONG_LIVED_TOKEN_HERE',
  now() + interval '60 days'
);
```

Or use the Supabase dashboard Table Editor.

---

## 5. Import n8n workflows

1. Open your n8n instance
2. For each file in `n8n-workflows/`:
   - Click **New Workflow → Import from JSON**
   - Paste or upload the `.json` file
3. Configure credentials in n8n:
   - **Supabase API**: add your `SUPABASE_URL` and service role key
   - **Google Drive OAuth2**: authorize with the service account
4. Set environment variables in n8n Settings → Environment Variables:
   - `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SUBMAGIC_API_KEY`, `IG_BUSINESS_ACCOUNT_ID`, `ALERT_WEBHOOK_URL`, `VEO_MONTHLY_LIMIT`
5. Activate all 7 workflows

---

## 6. Test end-to-end

```bash
# Test Veo generation (runs a real API call — ~$1.20)
npx tsx scripts/veo-generator.ts --prompt "Cinematic 9:16. Pacific Northwest mountains at dusk. No text. 8 seconds." --output /tmp/test-clip.mp4

# Test R2 upload
npx tsx scripts/r2-upload.ts --file /tmp/test-clip.mp4 --key test/test-clip.mp4

# List queue
npx tsx scripts/admin-cli.ts list

# Check upcoming recordings
npx tsx scripts/admin-cli.ts upcoming-recordings
```

---

## 7. Weekly recording convention

Name your clips as: `{reel_id}_{pillar}_{brief}.mp4`

Example: `a3f2c1d2-...-b4e5_trades_fresno_story.mp4`

Drop them into the Google Drive folder `1commerce-reels-inbox/`. The pipeline picks them up within minutes.
