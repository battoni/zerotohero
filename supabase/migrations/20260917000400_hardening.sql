-- Hardening after the impartial review of 2026-09-17.
-- Each block names the finding it closes.

-- (1) A friendship's parties are immutable, and the only transition is pending → accepted.
create function public.guard_friendship_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'friendship parties cannot change' using errcode = '42501';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'an accepted friendship can only be removed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger friendships_guard before update on public.friendships
  for each row execute function public.guard_friendship_update();

-- (2) Evidence can only live on milestones of the caller's own trails, and links are http(s).
drop policy "evidences: owner updates" on public.evidences;
create policy "evidences: owner updates" on public.evidences
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.milestones m where m.id = milestone_id and public.owns_track(m.track_id))
  );

alter table public.evidences
  add constraint evidence_url_scheme check (url is null or url ~* '^https?://[^\s]+$');

-- (3) A stored file path must sit in the owner's folder for that milestone.
alter table public.evidences
  add constraint evidence_storage_path_scope check (
    storage_path is null
    or storage_path like owner_id::text || '/' || milestone_id::text || '/%'
  );

-- (4) Policy helpers are not a public API: only signed-in callers, and are_friends
-- only answers about pairs that include the caller.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) in (a, b)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
    );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.can_view_track(uuid) from public, anon;
revoke execute on function public.owns_track(uuid) from public, anon;
revoke execute on function public.can_view_activity(uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.can_view_track(uuid) to authenticated;
grant execute on function public.owns_track(uuid) to authenticated;
grant execute on function public.can_view_activity(uuid) to authenticated;

-- (5a) Clients cannot set popularity or provenance; copy_track (running as the
-- function owner) still can.
create function public.guard_track_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.copies_count := 0;
      new.source_track_id := null;
    else
      new.copies_count := old.copies_count;
      new.source_track_id := old.source_track_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger tracks_guard_counters before insert or update on public.tracks
  for each row execute function public.guard_track_counters();

-- (5b) Completion dates cannot be in the future (a day of slack for time zones).
create function public.guard_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed_at is not null and new.completed_at > now() + interval '1 day' then
    raise exception 'completed_at cannot be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger milestones_guard_completed before insert or update of completed_at on public.milestones
  for each row execute function public.guard_completed_at();

-- (8) A trail created already fully done also records track_completed. create_track
-- runs as the caller (no insert right on activities), so it goes through a definer helper
-- that re-checks ownership.
create function public.record_track_completed(p_track uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_track(p_track) then
    raise exception 'trail not found' using errcode = 'P0002';
  end if;
  insert into public.activities (actor_id, type, track_id, created_at)
  select t.owner_id, 'track_completed', t.id, (select max(completed_at) from public.milestones where track_id = t.id)
  from public.tracks t
  where t.id = p_track
    and exists (select 1 from public.milestones where track_id = p_track)
    and not exists (select 1 from public.milestones where track_id = p_track and completed_at is null)
    and not exists (select 1 from public.activities where track_id = p_track and type = 'track_completed');
end;
$$;

revoke execute on function public.record_track_completed(uuid) from public, anon;
grant execute on function public.record_track_completed(uuid) to authenticated;

create or replace function public.create_track(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_track uuid;
  v_phase uuid;
  v_p jsonb;
  v_m jsonb;
  v_pi integer := 0;
  v_mi integer;
begin
  if jsonb_array_length(coalesce(payload -> 'phases', '[]'::jsonb)) = 0 then
    raise exception 'a trail needs at least one phase' using errcode = '22023';
  end if;

  insert into public.tracks (title, goal, emoji, color, target_date, visibility)
  values (
    payload ->> 'title',
    nullif(payload ->> 'goal', ''),
    coalesce(nullif(payload ->> 'emoji', ''), '🎯'),
    coalesce((payload ->> 'color')::public.track_color, 'violet'),
    nullif(payload ->> 'target_date', '')::date,
    coalesce((payload ->> 'visibility')::public.track_visibility, 'private')
  )
  returning id into v_track;

  for v_p in select * from jsonb_array_elements(payload -> 'phases') loop
    insert into public.phases (track_id, title, position)
    values (v_track, v_p ->> 'title', v_pi)
    returning id into v_phase;
    v_pi := v_pi + 1;
    v_mi := 0;
    for v_m in select * from jsonb_array_elements(coalesce(v_p -> 'milestones', '[]'::jsonb)) loop
      insert into public.milestones (track_id, phase_id, title, tag, due_date, completed_at, position)
      values (
        v_track, v_phase, v_m ->> 'title', nullif(v_m ->> 'tag', ''),
        nullif(v_m ->> 'due_date', '')::date, nullif(v_m ->> 'completed_at', '')::timestamptz, v_mi
      );
      v_mi := v_mi + 1;
    end loop;
  end loop;

  perform public.record_track_completed(v_track);

  return v_track;
end;
$$;

-- (6) Complete a milestone and attach its evidence in one transaction.
create function public.complete_milestone(p_id uuid, p_completed_at timestamptz, p_minutes integer, p_evidence jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.milestones
    set completed_at = coalesce(p_completed_at, now()), time_spent_minutes = p_minutes
    where id = p_id and completed_at is null;
  if not found then
    -- Visible but not ours (a public trail) must fail too, not pass as "already done".
    if not exists (
      select 1 from public.milestones
      where id = p_id and completed_at is not null and public.owns_track(track_id)
    ) then
      raise exception 'milestone not found' using errcode = 'P0002';
    end if;
    return false; -- already completed by the owner
  end if;

  if p_evidence is not null and p_evidence <> 'null'::jsonb then
    insert into public.evidences (milestone_id, kind, url, body, learned, storage_path)
    values (
      p_id,
      (p_evidence ->> 'kind')::public.evidence_kind,
      nullif(p_evidence ->> 'url', ''),
      nullif(p_evidence ->> 'body', ''),
      nullif(p_evidence ->> 'learned', ''),
      nullif(p_evidence ->> 'storage_path', '')
    );
  end if;
  return true;
end;
$$;

revoke execute on function public.complete_milestone(uuid, timestamptz, integer, jsonb) from public, anon;
grant execute on function public.complete_milestone(uuid, timestamptz, integer, jsonb) to authenticated;
