-- Reopen a milestone and drop its evidence in one transaction (fourth review, 2026-09-17).
-- Returns the storage paths the caller should remove from the bucket.
create function public.reopen_milestone(p_id uuid)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not exists (select 1 from public.milestones where id = p_id and public.owns_track(track_id)) then
    raise exception 'milestone not found' using errcode = 'P0002';
  end if;

  update public.milestones
    set completed_at = null, time_spent_minutes = null
    where id = p_id and completed_at is not null;

  with gone as (
    delete from public.evidences where milestone_id = p_id returning storage_path
  )
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}') into v_paths from gone;
  return v_paths;
end;
$$;

revoke execute on function public.reopen_milestone(uuid) from public, anon;
grant execute on function public.reopen_milestone(uuid) to authenticated;
