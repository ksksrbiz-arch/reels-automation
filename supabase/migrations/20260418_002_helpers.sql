-- =============================================================================
-- Migration: 20260418_002_helpers.sql
-- Helper functions used by n8n workflows, and the api_tokens table.
-- =============================================================================

-- Token storage table (for IG long-lived tokens)
create table if not exists public.api_tokens (
  id           text primary key,
  token        text not null,
  refreshed_at timestamptz default now(),
  expires_at   timestamptz
);

-- Function: next reel to post (used by 05-publish workflow)
create or replace function next_reel_to_publish()
returns setof reels_queue language sql as $$
  select * from reels_queue
  where status = 'ready'
    and scheduled_for <= now()
  order by scheduled_for asc
  limit 1;
$$;

-- Function: upcoming recording needs (for Keith's Tuesday batch)
create or replace function upcoming_recording_needs()
returns setof reels_queue language sql as $$
  select * from reels_queue
  where status = 'recording_needed'
    and pillar in ('build_in_public', 'trades_to_tech')
  order by scheduled_for asc;
$$;
