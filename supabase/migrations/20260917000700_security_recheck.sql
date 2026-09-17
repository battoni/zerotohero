-- Ninth review (2026-09-17).

-- (1) A stored file path is exactly {owner}/{milestone}/{file}, with no dot segments.
-- Storage URLs are normalized by fetch, so "a/b/../../c" would reach another folder.
alter table public.evidences drop constraint evidence_storage_path_scope;
alter table public.evidences
  add constraint evidence_storage_path_scope check (
    storage_path is null
    or (
      split_part(storage_path, '/', 1) = owner_id::text
      and split_part(storage_path, '/', 2) = milestone_id::text
      and split_part(storage_path, '/', 3) ~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,119}$'
      and split_part(storage_path, '/', 4) = ''
      and storage_path !~ '\.\.'
    )
  );

-- (2) Size caps, matching the app's list limits (20 phases, 200 milestones).
-- They also bound the per-row completion sync.
create function public.enforce_track_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'milestones'
     and (select count(*) from public.milestones where track_id = new.track_id) > 200 then
    raise exception 'a trail has at most 200 milestones' using errcode = '23514';
  end if;
  if tg_table_name = 'phases'
     and (select count(*) from public.phases where track_id = new.track_id) > 20 then
    raise exception 'a trail has at most 20 phases' using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger milestones_size
  after insert on public.milestones
  for each row execute function public.enforce_track_size();
create trigger phases_size
  after insert on public.phases
  for each row execute function public.enforce_track_size();

-- (3) Popularity counts people, not calls: only someone's first copy of a trail counts.
create or replace function public.copy_track(source uuid)
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
  v_first boolean;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.can_view_track(source) then
    raise exception 'trail not found' using errcode = 'P0002';
  end if;

  v_first := not exists (select 1 from public.tracks where owner_id = v_me and source_track_id = source);

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

  if v_first then
    update public.tracks set copies_count = copies_count + 1 where id = source;
  end if;
  return v_new;
end;
$$;

revoke execute on function public.enforce_track_size() from public, anon, authenticated;
