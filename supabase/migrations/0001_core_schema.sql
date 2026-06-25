-- Migration 0001: Talebound v1 core schema
--
-- Scope: minimal viable tables for single-player gameplay, saves and the
-- security audit log (ai_logs). Community / co-op / world-builder tables
-- (v2/v3) are intentionally deferred until needed (YAGNI).
--
-- Source of truth: docs/Talebound_Architettura_completa.md sections 8, 9, 15, 19
-- and docs/Talebound_Guardrail_e_Implementazione.md section 14.
--
-- Tables fully specified by the doc: rooms, room_translations, save_slots, ai_logs.
-- Tables documented only by purpose (minimal skeleton derived here): users, campaigns.

-- ---------------------------------------------------------------------------
-- Enums (closed value sets defined in the doc)
-- ---------------------------------------------------------------------------

-- Room ambient music mood (architecture doc, rooms schema).
create type music_mood as enum (
  'calm', 'tense', 'danger', 'mystery', 'victory', 'sad'
);

-- Campaign publication lifecycle (architecture doc, section 16).
create type campaign_status as enum (
  'draft', 'published', 'featured', 'unlisted', 'suspended'
);

-- Input classifier verdict (guardrail doc, section 14).
create type classifier_result as enum (
  'VALID', 'OFF_TOPIC', 'INJECTION', 'INAPPROPRIATE', 'EXPLOIT', 'PARSE_ERROR'
);

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at in sync on UPDATE.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users: profile, language/voice preferences, GDPR consent flag.
-- Mirrors Supabase auth.users (1:1). Detailed columns are not specified by the
-- doc; this is a minimal skeleton.
-- ponytail: extend with notification settings, ATT state, etc. when those
-- features land. Audit trail of consents belongs in a separate user_consents
-- table (deferred in this chunk).
-- ---------------------------------------------------------------------------
create table users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  preferred_language text not null default 'en',
  preferred_voice    text,
  -- Coarse GDPR consent snapshot. The legal audit trail (versioned, timestamped)
  -- lives in user_consents (deferred). ponytail: add that table for Art. 7 proof.
  personalized_ads   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- campaigns: story metadata, publication state, languages, author.
-- Minimal skeleton: detailed columns not specified by the doc.
-- author_id is a plain uuid (no FK) on purpose: the GDPR "right to be forgotten"
-- flow (guardrail doc) anonymizes published campaigns by setting author_id to a
-- random uuid and author_name to '[deleted]', which a strict FK would reject.
-- ---------------------------------------------------------------------------
create table campaigns (
  id           uuid primary key default gen_random_uuid (),
  author_id    uuid not null,
  author_name  text not null,
  title        text not null,
  synopsis     text,
  status       campaign_status not null default 'draft',
  languages    text[] not null default array['en'],
  tags         text[] not null default array[]::text[],
  -- Aggregated rating cache (architecture doc, section 16). Source ratings live
  -- in campaign_ratings (deferred); these columns are denormalized read models.
  rating_avg   numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index campaigns_author_id_idx on campaigns (author_id);
create index campaigns_status_idx on campaigns (status);

create trigger campaigns_set_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- rooms: narrative nodes with the immutable canonical description.
-- Fully specified by the architecture doc, section 8.
-- ---------------------------------------------------------------------------
create table rooms (
  id                         uuid primary key default gen_random_uuid (),
  campaign_id                uuid not null references campaigns (id) on delete cascade,
  name                       text not null,
  -- Generated once, never changes (architecture doc, section 8: mandatory).
  description_canonical       text not null,
  -- Only set by explicit, story-defined permanent change events.
  description_state_override  text,
  -- Exit graph, e.g. {"north": "<uuid>", "south": null}.
  connections                jsonb not null default '{}'::jsonb,
  music_mood                 music_mood not null default 'calm',
  -- Items present when the room is first entered.
  items_initial              jsonb not null default '[]'::jsonb,
  first_visit_text           text,
  tags                       text[] not null default array[]::text[],
  created_at                 timestamptz not null default now()
);

create index rooms_campaign_id_idx on rooms (campaign_id);

-- ---------------------------------------------------------------------------
-- room_translations: on-demand per-language translations of the canonical text.
-- Composite primary key (room_id, language). Architecture doc, section 15.
-- ---------------------------------------------------------------------------
create table room_translations (
  room_id                          uuid not null references rooms (id) on delete cascade,
  language                         text not null,
  -- Translated canonical text: immutable, like the original.
  description_canonical_translated text not null,
  translated_at                    timestamptz not null default now(),
  translated_by_model              text,
  primary key (room_id, language)
);

-- ---------------------------------------------------------------------------
-- save_slots: autosave + manual snapshots + per-act checkpoints.
-- Architecture doc, section 9.
-- ---------------------------------------------------------------------------
create table save_slots (
  id                   uuid primary key default gen_random_uuid (),
  user_id              uuid not null references users (id) on delete cascade,
  campaign_id          uuid not null references campaigns (id) on delete cascade,
  -- Full game state, overwritten every turn.
  autosave_json        jsonb not null default '{}'::jsonb,
  -- Up to 3 manual snapshots (FIFO), each with timestamp and name.
  snapshots_json       jsonb[] not null default array[]::jsonb[],
  -- One automatic checkpoint per completed act.
  act_checkpoints_json jsonb[] not null default array[]::jsonb[],
  endings_reached      text[] not null default array[]::text[],
  total_turns          integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index save_slots_user_id_idx on save_slots (user_id);
create index save_slots_campaign_id_idx on save_slots (campaign_id);

create trigger save_slots_set_updated_at
  before update on save_slots
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_logs: per-turn security / audit record. Guardrail doc, section 14.
-- Never stores raw user input: only an HMAC-SHA256 hash (HMAC_SECRET in env).
-- user_id, campaign_id and room_id are plain uuids (no FK) on purpose:
--   - user_id is anonymized to a random uuid by the GDPR deletion flow;
--   - logs must survive deletion of the referenced campaign/room (audit trail).
-- ---------------------------------------------------------------------------
create table ai_logs (
  id                           uuid primary key default gen_random_uuid (),
  user_id                      uuid,
  correlation_id               text,
  session_id                   uuid,
  turn_number                  integer,
  campaign_id                  uuid,
  room_id                      uuid,
  -- HMAC-SHA256 of the raw input. Never the plaintext (GDPR).
  user_input_hash              text,
  input_length                 integer,
  l0_blocked                   boolean not null default false,
  l0_pattern_matched           text,
  classifier_result            classifier_result,
  classifier_model             text,
  classifier_latency_ms        integer,
  classifier_cached            boolean not null default false,
  narrator_called              boolean not null default false,
  narrator_provider            text,
  narrator_latency_ms          integer,
  headroom_ratio               real,
  output_guardrail_triggered   boolean,
  indirect_injection_suspected boolean,
  created_at                   timestamptz not null default now()
);

create index ai_logs_user_id_idx on ai_logs (user_id);
create index ai_logs_correlation_id_idx on ai_logs (correlation_id);
create index ai_logs_created_at_idx on ai_logs (created_at);
create index ai_logs_classifier_result_idx on ai_logs (classifier_result);
