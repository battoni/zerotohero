-- Core schema: trails, phases, milestones, evidence and the social layer.
-- Source of truth: docs/spec-mvp.md §3. Every table has RLS; helper functions are
-- SECURITY DEFINER with an empty search_path so policies never recurse.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.track_color as enum ('violet', 'coral', 'sky', 'mint', 'sun');
create type public.track_visibility as enum ('private', 'friends', 'public');
create type public.evidence_kind as enum ('link', 'note', 'file', 'certificate');
create type public.friend_status as enum ('pending', 'accepted');
create type public.activity_type as enum ('milestone_completed', 'track_completed', 'track_started', 'track_followed');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.tracks (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  goal             text check (char_length(goal) <= 280),
  emoji            text not null default '🎯' check (char_length(emoji) between 1 and 8),
  color            public.track_color not null default 'violet',
  target_date      date,
  visibility       public.track_visibility not null default 'private',
  source_track_id  uuid references public.tracks (id) on delete set null,
  copies_count     integer not null default 0 check (copies_count >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);
create index tracks_owner_idx on public.tracks (owner_id);
create index tracks_public_idx on public.tracks (visibility, copies_count desc) where archived_at is null;

create table public.phases (
  id        uuid primary key default gen_random_uuid(),
  track_id  uuid not null references public.tracks (id) on delete cascade,
  title     text not null check (char_length(title) between 1 and 60),
  position  integer not null default 0,
  unique (id, track_id)
);
create index phases_track_idx on public.phases (track_id, position);

create table public.milestones (
  id                  uuid primary key default gen_random_uuid(),
  track_id            uuid not null references public.tracks (id) on delete cascade,
  phase_id            uuid not null,
  title               text not null check (char_length(title) between 1 and 140),
  tag                 text check (char_length(tag) between 1 and 24),
  position            integer not null default 0,
  due_date            date,
  completed_at        timestamptz,
  time_spent_minutes  integer check (time_spent_minutes >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A milestone's phase must belong to the same trail.
  foreign key (phase_id, track_id) references public.phases (id, track_id) on delete cascade
);
create index milestones_track_idx on public.milestones (track_id);
create index milestones_phase_idx on public.milestones (phase_id, position);
create index milestones_completed_idx on public.milestones (track_id, completed_at);

create table public.evidences (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references public.milestones (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind          public.evidence_kind not null,
  url           text check (char_length(url) <= 2048),
  body          text check (char_length(body) <= 4000),
  learned       text check (char_length(learned) <= 4000),
  storage_path  text check (char_length(storage_path) <= 512),
  created_at    timestamptz not null default now(),
  constraint evidence_payload check (
    case kind
      when 'link' then url is not null
      when 'certificate' then url is not null or storage_path is not null
      when 'file' then storage_path is not null
      when 'note' then body is not null
    end
  )
);
create index evidences_milestone_idx on public.evidences (milestone_id);

create table public.friendships (
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friend_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.track_follows (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  track_id    uuid not null references public.tracks (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index track_follows_track_idx on public.track_follows (track_id);

create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references public.profiles (id) on delete cascade,
  type          public.activity_type not null,
  track_id      uuid not null references public.tracks (id) on delete cascade,
  milestone_id  uuid references public.milestones (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index activities_actor_idx on public.activities (actor_id, created_at desc);
create index activities_track_idx on public.activities (track_id);

create table public.kudos (
  activity_id  uuid not null references public.activities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create trigger tracks_touch before update on public.tracks
  for each row execute function public.touch_updated_at();
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions (used by policies)
-- ---------------------------------------------------------------------------
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create function public.can_view_track(p_track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tracks t
    where t.id = p_track_id
      and (
        t.owner_id = (select auth.uid())
        or t.visibility = 'public'
        or (t.visibility = 'friends' and public.are_friends(t.owner_id, (select auth.uid())))
      )
  );
$$;

create function public.owns_track(p_track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tracks t where t.id = p_track_id and t.owner_id = (select auth.uid()));
$$;

create function public.can_view_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    where a.id = p_activity_id
      and (
        a.actor_id = (select auth.uid())
        or (public.are_friends(a.actor_id, (select auth.uid())) and public.can_view_track(a.track_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Activity triggers
-- ---------------------------------------------------------------------------
create function public.milestone_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_total integer;
  v_done integer;
begin
  select owner_id into v_owner from public.tracks where id = new.track_id;

  if old.completed_at is null and new.completed_at is not null then
    select count(*), count(completed_at) into v_total, v_done
      from public.milestones where track_id = new.track_id;

    if not exists (select 1 from public.activities where track_id = new.track_id and type = 'track_started') then
      insert into public.activities (actor_id, type, track_id, created_at)
      values (v_owner, 'track_started', new.track_id, new.completed_at);
    end if;

    insert into public.activities (actor_id, type, track_id, milestone_id, created_at)
    values (v_owner, 'milestone_completed', new.track_id, new.id, new.completed_at);

    if v_done = v_total then
      insert into public.activities (actor_id, type, track_id, created_at)
      values (v_owner, 'track_completed', new.track_id, new.completed_at);
    end if;

  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.activities
      where milestone_id = new.id and type = 'milestone_completed';
    delete from public.activities
      where track_id = new.track_id and type = 'track_completed';
  end if;

  return new;
end;
$$;

create trigger milestones_activity
  after update of completed_at on public.milestones
  for each row execute function public.milestone_activity();

-- Milestones inserted already completed (paste list, seed) count as completions too.
create function public.milestone_insert_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.completed_at is not null then
    select owner_id into v_owner from public.tracks where id = new.track_id;
    if not exists (select 1 from public.activities where track_id = new.track_id and type = 'track_started') then
      insert into public.activities (actor_id, type, track_id, created_at)
      values (v_owner, 'track_started', new.track_id, new.completed_at);
    end if;
    insert into public.activities (actor_id, type, track_id, milestone_id, created_at)
    values (v_owner, 'milestone_completed', new.track_id, new.id, new.completed_at);
  end if;
  return new;
end;
$$;

create trigger milestones_insert_activity
  after insert on public.milestones
  for each row execute function public.milestone_insert_activity();

create function public.follow_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activities (actor_id, type, track_id, created_at)
  values (new.user_id, 'track_followed', new.track_id, new.created_at);
  return new;
end;
$$;

create trigger track_follows_activity
  after insert on public.track_follows
  for each row execute function public.follow_activity();

-- ---------------------------------------------------------------------------
-- Copy a trail as a template: structure only, never progress or evidence.
-- ---------------------------------------------------------------------------
create function public.copy_track(source uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_new uuid;
  v_phase record;
  v_new_phase uuid;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.can_view_track(source) then
    raise exception 'trail not found' using errcode = 'P0002';
  end if;

  insert into public.tracks (owner_id, title, goal, emoji, color, target_date, visibility, source_track_id)
  select v_me, t.title, t.goal, t.emoji, t.color, null, 'private', t.id
    from public.tracks t where t.id = source
  returning id into v_new;

  for v_phase in select * from public.phases where track_id = source order by position loop
    insert into public.phases (track_id, title, position)
    values (v_new, v_phase.title, v_phase.position)
    returning id into v_new_phase;

    insert into public.milestones (track_id, phase_id, title, tag, position)
    select v_new, v_new_phase, m.title, m.tag, m.position
      from public.milestones m where m.phase_id = v_phase.id;
  end loop;

  update public.tracks set copies_count = copies_count + 1 where id = source;
  return v_new;
end;
$$;

revoke execute on function public.copy_track(uuid) from public, anon;
grant execute on function public.copy_track(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Progress view (runs with the caller's RLS)
-- ---------------------------------------------------------------------------
create view public.track_progress
with (security_invoker = true)
as
select
  t.id as track_id,
  count(m.id)::integer as total,
  count(m.completed_at)::integer as done,
  (
    select m2.id from public.milestones m2
    join public.phases p2 on p2.id = m2.phase_id
    where m2.track_id = t.id and m2.completed_at is null
    order by p2.position, m2.position
    limit 1
  ) as next_milestone_id,
  (
    select m2.title from public.milestones m2
    join public.phases p2 on p2.id = m2.phase_id
    where m2.track_id = t.id and m2.completed_at is null
    order by p2.position, m2.position
    limit 1
  ) as next_milestone_title,
  max(m.completed_at) as last_completed_at
from public.tracks t
left join public.milestones m on m.track_id = t.id
group by t.id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tracks enable row level security;
alter table public.phases enable row level security;
alter table public.milestones enable row level security;
alter table public.evidences enable row level security;
alter table public.friendships enable row level security;
alter table public.track_follows enable row level security;
alter table public.activities enable row level security;
alter table public.kudos enable row level security;

-- tracks
-- Evaluated on the row itself (not via can_view_track): INSERT ... RETURNING checks
-- this policy against a row a STABLE function's snapshot cannot see yet.
create policy "tracks: visible per visibility" on public.tracks
  for select to authenticated using (
    owner_id = (select auth.uid())
    or visibility = 'public'
    or (visibility = 'friends' and public.are_friends(owner_id, (select auth.uid())))
  );
create policy "tracks: owner inserts" on public.tracks
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "tracks: owner updates" on public.tracks
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "tracks: owner deletes" on public.tracks
  for delete to authenticated using (owner_id = (select auth.uid()));

-- phases
create policy "phases: visible with the trail" on public.phases
  for select to authenticated using (public.can_view_track(track_id));
create policy "phases: owner inserts" on public.phases
  for insert to authenticated with check (public.owns_track(track_id));
create policy "phases: owner updates" on public.phases
  for update to authenticated using (public.owns_track(track_id)) with check (public.owns_track(track_id));
create policy "phases: owner deletes" on public.phases
  for delete to authenticated using (public.owns_track(track_id));

-- milestones
create policy "milestones: visible with the trail" on public.milestones
  for select to authenticated using (public.can_view_track(track_id));
create policy "milestones: owner inserts" on public.milestones
  for insert to authenticated with check (public.owns_track(track_id));
create policy "milestones: owner updates" on public.milestones
  for update to authenticated using (public.owns_track(track_id)) with check (public.owns_track(track_id));
create policy "milestones: owner deletes" on public.milestones
  for delete to authenticated using (public.owns_track(track_id));

-- evidences
create policy "evidences: visible with the trail" on public.evidences
  for select to authenticated using (
    exists (select 1 from public.milestones m where m.id = milestone_id and public.can_view_track(m.track_id))
  );
create policy "evidences: owner inserts" on public.evidences
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.milestones m where m.id = milestone_id and public.owns_track(m.track_id))
  );
create policy "evidences: owner updates" on public.evidences
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "evidences: owner deletes" on public.evidences
  for delete to authenticated using (owner_id = (select auth.uid()));

-- friendships
create policy "friendships: both sides read" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "friendships: requester asks" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending' and responded_at is null);
create policy "friendships: addressee accepts" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "friendships: either side removes" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- track_follows
create policy "follows: follower or trail owner reads" on public.track_follows
  for select to authenticated
  using (user_id = (select auth.uid()) or public.owns_track(track_id) or public.can_view_track(track_id));
create policy "follows: follow a visible trail" on public.track_follows
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_track(track_id));
create policy "follows: unfollow" on public.track_follows
  for delete to authenticated using (user_id = (select auth.uid()));

-- activities (written only by triggers)
create policy "activities: own and friends' visible ones" on public.activities
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (public.are_friends(actor_id, (select auth.uid())) and public.can_view_track(track_id))
  );

-- kudos
create policy "kudos: visible with the activity" on public.kudos
  for select to authenticated using (public.can_view_activity(activity_id));
create policy "kudos: cheer someone else's visible activity" on public.kudos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.can_view_activity(activity_id)
    and not exists (select 1 from public.activities a where a.id = activity_id and a.actor_id = (select auth.uid()))
  );
create policy "kudos: take it back" on public.kudos
  for delete to authenticated using (user_id = (select auth.uid()));
