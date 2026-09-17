-- Atomic trail writes. SECURITY INVOKER: every statement runs under the caller's RLS.
-- Payload shape (docs/spec-mvp.md §3):
-- { title, goal, emoji, color, target_date, visibility,
--   phases: [ { id?, title, milestones: [ { id?, title, tag, due_date, completed_at? } ] } ] }

create function public.create_track(payload jsonb)
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

  return v_track;
end;
$$;

create function public.update_track(p_id uuid, payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_p jsonb;
  v_m jsonb;
  v_phase uuid;
  v_pi integer := 0;
  v_mi integer;
  v_keep_phases uuid[] := '{}';
  v_keep_ms uuid[] := '{}';
begin
  if jsonb_array_length(coalesce(payload -> 'phases', '[]'::jsonb)) = 0 then
    raise exception 'a trail needs at least one phase' using errcode = '22023';
  end if;

  update public.tracks set
    title = payload ->> 'title',
    goal = nullif(payload ->> 'goal', ''),
    emoji = coalesce(nullif(payload ->> 'emoji', ''), '🎯'),
    color = coalesce((payload ->> 'color')::public.track_color, color),
    target_date = nullif(payload ->> 'target_date', '')::date,
    visibility = coalesce((payload ->> 'visibility')::public.track_visibility, visibility)
  where id = p_id;
  if not found then
    raise exception 'trail not found' using errcode = 'P0002';
  end if;

  -- Collect the ids the payload keeps; everything else in the trail is removed.
  select coalesce(array_agg((p ->> 'id')::uuid), '{}') into v_keep_phases
    from jsonb_array_elements(payload -> 'phases') p where p ? 'id' and p ->> 'id' <> '';
  select coalesce(array_agg((m ->> 'id')::uuid), '{}') into v_keep_ms
    from jsonb_array_elements(payload -> 'phases') p,
         jsonb_array_elements(coalesce(p -> 'milestones', '[]'::jsonb)) m
    where m ? 'id' and m ->> 'id' <> '';

  delete from public.milestones where track_id = p_id and not (id = any (v_keep_ms));

  for v_p in select * from jsonb_array_elements(payload -> 'phases') loop
    if v_p ? 'id' and v_p ->> 'id' <> '' then
      v_phase := (v_p ->> 'id')::uuid;
      update public.phases set title = v_p ->> 'title', position = v_pi
        where id = v_phase and track_id = p_id;
      if not found then
        raise exception 'phase % does not belong to this trail', v_phase using errcode = '22023';
      end if;
    else
      insert into public.phases (track_id, title, position)
      values (p_id, v_p ->> 'title', v_pi)
      returning id into v_phase;
      v_keep_phases := v_keep_phases || v_phase;
    end if;
    v_pi := v_pi + 1;
    v_mi := 0;

    for v_m in select * from jsonb_array_elements(coalesce(v_p -> 'milestones', '[]'::jsonb)) loop
      if v_m ? 'id' and v_m ->> 'id' <> '' then
        update public.milestones set
          phase_id = v_phase,
          title = v_m ->> 'title',
          tag = nullif(v_m ->> 'tag', ''),
          due_date = nullif(v_m ->> 'due_date', '')::date,
          position = v_mi
        where id = (v_m ->> 'id')::uuid and track_id = p_id;
        if not found then
          raise exception 'milestone does not belong to this trail' using errcode = '22023';
        end if;
      else
        insert into public.milestones (track_id, phase_id, title, tag, due_date, completed_at, position)
        values (
          p_id, v_phase, v_m ->> 'title', nullif(v_m ->> 'tag', ''),
          nullif(v_m ->> 'due_date', '')::date, nullif(v_m ->> 'completed_at', '')::timestamptz, v_mi
        );
      end if;
      v_mi := v_mi + 1;
    end loop;
  end loop;

  delete from public.phases where track_id = p_id and not (id = any (v_keep_phases));
end;
$$;

revoke execute on function public.create_track(jsonb) from public, anon;
revoke execute on function public.update_track(uuid, jsonb) from public, anon;
grant execute on function public.create_track(jsonb) to authenticated;
grant execute on function public.update_track(uuid, jsonb) to authenticated;
