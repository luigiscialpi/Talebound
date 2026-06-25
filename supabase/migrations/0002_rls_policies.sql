-- Migration 0002: Row Level Security policies for the v1 core schema
--
-- Default posture: deny everything, then grant the narrowest access that the
-- product needs. The backend uses the Supabase service role, which bypasses RLS;
-- these policies govern the anon / authenticated client roles only.
--
-- auth.uid() returns the id of the currently authenticated user (NULL for anon).

-- ---------------------------------------------------------------------------
-- Enable RLS on every table. With RLS on and no matching policy, access is denied.
-- ---------------------------------------------------------------------------
alter table users             enable row level security;
alter table campaigns         enable row level security;
alter table rooms             enable row level security;
alter table room_translations enable row level security;
alter table save_slots        enable row level security;
alter table ai_logs           enable row level security;

-- ---------------------------------------------------------------------------
-- users: a user can only see and edit their own profile row.
-- ---------------------------------------------------------------------------
create policy users_select_own on users
  for select using (id = auth.uid ());

create policy users_insert_own on users
  for insert with check (id = auth.uid ());

create policy users_update_own on users
  for update using (id = auth.uid ()) with check (id = auth.uid ());

-- ---------------------------------------------------------------------------
-- campaigns: publicly readable when listed (published/featured/unlisted);
-- the author always sees and manages their own campaigns (including drafts).
-- "unlisted" is link-only at the product level; the DB still allows reads,
-- since discovery (Explore) is filtered server-side to published/featured.
-- ---------------------------------------------------------------------------
create policy campaigns_select_public_or_owner on campaigns
  for select using (
    status in ('published', 'featured', 'unlisted')
    or author_id = auth.uid ()
  );

create policy campaigns_insert_owner on campaigns
  for insert with check (author_id = auth.uid ());

create policy campaigns_update_owner on campaigns
  for update using (author_id = auth.uid ()) with check (author_id = auth.uid ());

create policy campaigns_delete_owner on campaigns
  for delete using (author_id = auth.uid ());

-- ---------------------------------------------------------------------------
-- rooms: readable when the parent campaign is readable; writable only by the
-- campaign author.
-- ---------------------------------------------------------------------------
create policy rooms_select_via_campaign on rooms
  for select using (
    exists (
      select 1 from campaigns c
      where c.id = rooms.campaign_id
        and (
          c.status in ('published', 'featured', 'unlisted')
          or c.author_id = auth.uid ()
        )
    )
  );

create policy rooms_write_via_campaign_owner on rooms
  for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = rooms.campaign_id and c.author_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from campaigns c
      where c.id = rooms.campaign_id and c.author_id = auth.uid ()
    )
  );

-- ---------------------------------------------------------------------------
-- room_translations: same visibility rules as the parent room/campaign.
-- ---------------------------------------------------------------------------
create policy room_translations_select_via_campaign on room_translations
  for select using (
    exists (
      select 1 from rooms r
      join campaigns c on c.id = r.campaign_id
      where r.id = room_translations.room_id
        and (
          c.status in ('published', 'featured', 'unlisted')
          or c.author_id = auth.uid ()
        )
    )
  );

create policy room_translations_write_via_campaign_owner on room_translations
  for all
  using (
    exists (
      select 1 from rooms r
      join campaigns c on c.id = r.campaign_id
      where r.id = room_translations.room_id and c.author_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from rooms r
      join campaigns c on c.id = r.campaign_id
      where r.id = room_translations.room_id and c.author_id = auth.uid ()
    )
  );

-- ---------------------------------------------------------------------------
-- save_slots: strictly private to their owner.
-- ---------------------------------------------------------------------------
create policy save_slots_all_own on save_slots
  for all
  using (user_id = auth.uid ())
  with check (user_id = auth.uid ());

-- ---------------------------------------------------------------------------
-- ai_logs: no client policies on purpose. RLS is enabled and no policy matches,
-- so anon/authenticated clients are fully denied. Only the backend service role
-- (which bypasses RLS) reads and writes security logs.
-- ---------------------------------------------------------------------------
