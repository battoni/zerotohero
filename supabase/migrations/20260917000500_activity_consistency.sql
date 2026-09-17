-- Activity consistency after the third review (2026-09-17).

-- A trail has at most one track_completed, and only while it is actually complete.
create or replace function public.sync_track_completed(p_track uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_done integer;
begin
  select count(*), count(completed_at) into v_total, v_done from public.milestones where track_id = p_track;
  if v_total = 0 or v_done < v_total then
    delete from public.activities where track_id = p_track and type = 'track_completed';
  elsif not exists (select 1 from public.activities where track_id = p_track and type = 'track_completed') then
    insert into public.activities (actor_id, type, track_id, created_at)
    select t.owner_id, 'track_completed', t.id, (select max(completed_at) from public.milestones where track_id = t.id)
    from public.tracks t where t.id = p_track;
  end if;
end;
$$;

revoke execute on function public.sync_track_completed(uuid) from public, anon, authenticated;

-- record_track_completed (called by create_track) now defers to the same rule.
create or replace function public.record_track_completed(p_track uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_track(p_track) then
    raise exception 'trail not found' using errcode = 'P0002';
  end if;
  perform public.sync_track_completed(p_track);
end;
$$;

-- Completing / reopening: milestone activity as before, trail completion through the rule.
create or replace function public.milestone_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.tracks where id = new.track_id;

  if old.completed_at is null and new.completed_at is not null then
    if not exists (select 1 from public.activities where track_id = new.track_id and type = 'track_started') then
      insert into public.activities (actor_id, type, track_id, created_at)
      values (v_owner, 'track_started', new.track_id, new.completed_at);
    end if;
    insert into public.activities (actor_id, type, track_id, milestone_id, created_at)
    values (v_owner, 'milestone_completed', new.track_id, new.id, new.completed_at);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.activities where milestone_id = new.id and type = 'milestone_completed';
  end if;

  perform public.sync_track_completed(new.track_id);
  return new;
end;
$$;

-- Adding or removing milestones (create_track, update_track) can make a trail
-- (in)complete. Row-level and idempotent, so the final state is what counts.
create function public.milestones_changed_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip while the parent trail is being deleted (cascade).
  if exists (select 1 from public.tracks where id = coalesce(new.track_id, old.track_id)) then
    perform public.sync_track_completed(coalesce(new.track_id, old.track_id));
  end if;
  return null;
end;
$$;

create trigger milestones_membership_sync
  after insert or delete on public.milestones
  for each row execute function public.milestones_changed_sync();

-- Unfollowing removes the "started following" item (and its cheers).
create function public.unfollow_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activities
  where type = 'track_followed' and actor_id = old.user_id and track_id = old.track_id;
  return old;
end;
$$;

create trigger track_follows_unfollow
  after delete on public.track_follows
  for each row execute function public.unfollow_activity();
