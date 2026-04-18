-- =============================================================================
-- Migration: 20260418_003_rls.sql
-- Row-level security policies — n8n uses the service role key.
-- =============================================================================

alter table public.reels_queue  enable row level security;
alter table public.api_tokens   enable row level security;

-- Service role bypass (n8n uses service role key, which bypasses RLS entirely,
-- but explicit policies are added for clarity and defence-in-depth).
create policy reels_service_role on public.reels_queue
  for all using (auth.role() = 'service_role');

create policy tokens_service_role on public.api_tokens
  for all using (auth.role() = 'service_role');
