# Troubleshooting

Common issues and their fixes.

---

## 01-ideation: Claude returns invalid JSON

**Symptom**: n8n "Code (parse JSON)" node errors with `JSON.parse` failure.

**Fix**: The parse node strips markdown fences (```` ``` ````) before parsing. If Claude wraps output in unexpected formatting, check the raw `content[0].text` in n8n's execution log. The regex handles both ```` ```json ```` and bare ```` ``` ```` fences.

If still failing, manually run a test message through the Claude API and inspect the raw response.

---

## 02-broll: "Monthly Veo limit reached"

**Symptom**: Cost guard node throws `Monthly Veo limit of 25 reached`.

**Fix**: Either the limit has been hit legitimately, or the `broll_url IS NOT NULL` count is wrong.

```sql
-- Check how many B-rolls were generated this month
SELECT COUNT(*) FROM reels_queue
WHERE broll_url IS NOT NULL
  AND created_at >= date_trunc('month', now());
```

To raise the limit, update `VEO_MONTHLY_LIMIT` in n8n environment variables.

---

## 02-broll: Veo operation stuck

**Symptom**: The poll loop runs more than 10 times without `done = true`.

**Fix**: Check the Gemini API status page. Veo generation can take 3-8 minutes normally. If stuck > 15 min, the operation name may have expired. The error branch keeps the reel in `approved` so it retries next cycle without needing another manual approval.

---

## 03-ingest: Clip goes to `unmatched/`

**Symptom**: Alert fires: "Unmatched recording: `filename.mp4` has no reel_id prefix."

**Fix**: Rename the file to `{reel_id}_{brief}.mp4` format and re-upload. To find the correct `reel_id`:

```bash
npx tsx scripts/admin-cli.ts list --status recording_needed
```

---

## 04-edit: Submagic API unavailable

**Symptom**: Submagic submit node returns 5xx or times out.

**Fix**: The workflow has a fallback path — if Submagic is down, the reel falls through to an FFmpeg text-burn node that burns `text_overlay` directly onto the B-roll. The reel still posts, just without animated captions.

Check Submagic status: https://status.submagic.co

---

## 05-publish: Container stuck in `IN_PROGRESS`

**Symptom**: Timeout Check node throws after 5 poll attempts (~5 min).

**Fix**: The reel remains at `status='ready'` and the 10-min cron will retry automatically. This is usually a transient IG API delay. If it persists:

1. Check Meta Developer status: https://developers.facebook.com/status
2. Verify `final_reel_url` is publicly accessible from the internet (IG pulls the video from R2)
3. Verify R2 public access is enabled for the `final/` prefix

---

## 05-publish: "Invalid OAuth access token"

**Symptom**: Create container call returns error code 190.

**Fix**: The IG token has expired. Run immediately:

```bash
npx tsx scripts/ig-token-refresh.ts
```

If refresh also fails (token fully expired beyond 60 days), you must generate a new long-lived token manually via the Graph API Explorer and seed it:

```sql
UPDATE api_tokens SET token = 'NEW_TOKEN', expires_at = now() + interval '60 days'
WHERE id = 'ig_long_lived';
```

---

## 06-token-refresh: Refresh failed

**Symptom**: Critical alert fires — "IG token refresh FAILED".

**Cause**: Token may have expired between refresh cycles (>60 days without refresh).

**Fix**: Generate a new long-lived token from scratch:
1. Go to Graph API Explorer → select your Meta App
2. Generate a short-lived user token with `instagram_basic,instagram_content_publish` permissions
3. Exchange it for a long-lived token via `GET /oauth/access_token?grant_type=fb_exchange_token&...`
4. Seed it into Supabase (see setup.md §4)

---

## Analytics: Metrics not updating

**Symptom**: `views`, `likes` columns staying at 0 after posting.

**Cause**: IG Insights data is typically available 24-48h after posting. The `last_metrics_pull < now() - 4 hours` filter ensures we don't hammer the API, but new posts may show zeros initially.

**Fix**: Wait 24h. If still 0 after 48h, check that `ig_media_id` is correctly populated and that the token has `instagram_manage_insights` permission.

---

## General: Supabase connection errors

**Symptom**: Any workflow node fails with `FetchError: connect ECONNREFUSED`.

**Fix**:
1. Verify `SUPABASE_URL` is correct and includes `https://`
2. Verify the service role key hasn't been rotated
3. Check Supabase project status at https://status.supabase.com
