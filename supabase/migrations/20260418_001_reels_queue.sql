-- =============================================================================
-- Migration: 20260418_001_reels_queue.sql
-- Creates enum types and the main reels_queue table with indexes and triggers.
-- =============================================================================

-- Enum: content pillar
create type reel_pillar as enum (
  'operator_wisdom',
  'build_in_public',
  'trades_to_tech',
  'pnw_identity'
);

-- Enum: pipeline status
create type reel_status as enum (
  'draft',             -- Claude generated, awaiting Keith approval
  'approved',          -- Keith approved, ready for downstream
  'broll_ready',       -- Veo generated B-roll, waiting on recording or edit
  'recording_needed',  -- Talking-head pillar, waiting on Keith's raw clip
  'editing',           -- Raw ingredients assembled, in Submagic
  'ready',             -- Final reel built, scheduled
  'posted',            -- Published to IG
  'killed'             -- Rejected, archived
);

-- Main queue table
create table public.reels_queue (
  id                      uuid primary key default gen_random_uuid(),
  pillar                  reel_pillar not null,
  status                  reel_status not null default 'draft',

  -- Content
  hook                    text not null,
  script                  text,
  text_overlay            text,
  caption                 text,
  hashtags                text[] default '{}',

  -- Media
  broll_prompt            text,
  broll_url               text,                    -- R2 URL after Veo generates
  raw_clip_url            text,                    -- R2 URL after Keith uploads
  final_reel_url          text,                    -- R2 URL after Submagic
  audio_suggestion        text,

  -- Scheduling
  scheduled_for           timestamptz,
  posted_at               timestamptz,
  ig_media_id             text,

  -- Analytics
  views                   int default 0,
  likes                   int default 0,
  comments                int default 0,
  saves                   int default 0,
  shares                  int default 0,
  reach                   int default 0,
  watch_time_avg_seconds  numeric,
  last_metrics_pull       timestamptz,

  -- Meta
  ig_account              text default 'keithjskaggs',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  notes                   text
);

create index idx_reels_status       on reels_queue(status);
create index idx_reels_scheduled    on reels_queue(scheduled_for) where status = 'ready';
create index idx_reels_pillar       on reels_queue(pillar);
create index idx_reels_posted_at    on reels_queue(posted_at desc);

-- Updated-at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger reels_queue_updated_at
  before update on reels_queue
  for each row execute function set_updated_at();

-- Analytics rollup view
create or replace view reels_pillar_performance as
select
  pillar,
  count(*)            as reels_posted,
  avg(views)          as avg_views,
  avg(likes)          as avg_likes,
  avg(saves)          as avg_saves,
  avg(shares)         as avg_shares,
  sum(views)          as total_views
from reels_queue
where status = 'posted'
  and posted_at > now() - interval '30 days'
group by pillar;
