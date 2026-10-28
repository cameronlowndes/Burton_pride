-- Keep worker readiness consistent with the validated policy engine.
create function public.moderation_policy_valid(p jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
 select case when jsonb_typeof(p)='object' and p->>'approved'='true' and jsonb_typeof(p->'version')='string' and length(p->>'version')>0 and jsonb_typeof(p->'rules')='array' then
   jsonb_array_length(p->'rules') between 1 and 200 and not exists (
     select 1 from jsonb_array_elements(p->'rules') r where
       coalesce(r->>'category','') not in ('hate','harassment','threat','spam','abuse') or
       coalesce(r->>'action','') not in ('hide','review') or
       coalesce(jsonb_typeof(r->'phrase'),'')<>'string' or
       coalesce(length(trim(r->>'phrase')),0)<3 or length(r->>'phrase')>200
   ) else false end;
$$;
revoke all on function public.moderation_policy_valid(jsonb) from public,anon,authenticated;
grant execute on function public.moderation_policy_valid(jsonb) to service_role;
create or replace function public.moderation_ready(p_lease uuid,p_generation bigint,p_connections jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.moderation_service; c jsonb; healthy boolean; begin
  select * into s from public.moderation_service where id for update;
  if s.lease_id is distinct from p_lease or s.lease_until<=now() or s.generation<>p_generation then return false; end if;
  for c in select * from jsonb_array_elements(p_connections) loop
    update public.moderation_connections set status=c->>'status',error=c->>'error',checked_at=now() where platform=c->>'platform';
  end loop;
  healthy:=(select count(*)=2 and bool_and(status='Connected') from public.moderation_connections)
    and public.moderation_policy_valid(s.policy);
  if not s.enabled then
    update public.moderation_service set status='Stopped',error=null where id;
    return false;
  end if;
  if not healthy then
    update public.moderation_service set status='Error',error='Moderation paused: verify both Meta connections and approve a moderation policy.' where id;
    return false;
  end if;
  if s.applied_generation<>s.generation then
    insert into public.moderation_history(kind,generation,outcome) values(s.restart_reason,s.generation,'completed');
  end if;
  update public.moderation_service set status='Running',error=null,
    started_at=case when applied_generation<>generation or started_at is null or s.recovery_attempts>0 then now() else started_at end,
    last_restart_at=case when applied_generation<>generation and restart_reason<>'start' then now() else last_restart_at end,
    last_refresh_at=case when applied_generation<>generation and restart_reason='refresh' then now() else last_refresh_at end,
    applied_generation=generation,recovery_attempts=0,heartbeat_at=now(),updated_at=now() where id;
  return true;
end $$;
