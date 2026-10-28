-- Human reviewers record work performed in Meta without triggering an automatic action.
create function public.moderation_record_review(p_admin uuid,p_session uuid,p_job uuid,p_note text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 if not public.moderation_authorized(p_admin,p_session,'moderation:review') then raise exception 'Permission or session denied'; end if;
 if length(trim(p_note))<5 or length(p_note)>1000 then raise exception 'A review note of 5 to 1000 characters is required'; end if;
 update public.moderation_decisions set reviewed_by=p_admin,reviewed_at=now(),review_note=trim(p_note),action_status='none'
   where job_id=p_job and action_status='review' and reviewed_at is null;
 if not found then return false; end if;
 insert into public.moderation_security_events(admin_id,session_id,action,outcome) values(p_admin,p_session,'review','recorded');
 return true;
end $$;
revoke all on function public.moderation_record_review(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.moderation_record_review(uuid,uuid,uuid,text) to service_role;
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
  if s.restart_reason='refresh' and s.applied_generation<>s.generation then
    if exists(select 1 from public.moderation_jobs j where j.status='done' and not exists(select 1 from public.moderation_decisions d where d.job_id=j.id)) then
      update public.moderation_service set status='Error',error='Maintenance integrity check found completed jobs without decisions. Investigate before resuming.' where id;
      return false;
    end if;
    insert into public.moderation_history(kind,generation,outcome,detail) values('maintenance_integrity',s.generation,'completed','Queue/decision links verified; expired leases recovered; configuration and Meta connections revalidated.');
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
