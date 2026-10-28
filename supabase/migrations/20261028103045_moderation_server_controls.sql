-- Additive, initially disabled. No moderation/history or administrator rows are deleted.
create function public.moderation_next_restart(p_now timestamptz default now())
returns timestamptz language sql stable security invoker set search_path = '' as $$
  select case when (date_trunc('day',p_now at time zone 'Europe/London')+interval '8 hours') at time zone 'Europe/London'>p_now
    then (date_trunc('day',p_now at time zone 'Europe/London')+interval '8 hours') at time zone 'Europe/London'
    else (date_trunc('day',p_now at time zone 'Europe/London')+interval '1 day 8 hours') at time zone 'Europe/London' end;
$$;
create table public.moderation_service (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  status text not null default 'Stopped' check (status in ('Running','Stopped','Starting','Restarting','Error')),
  generation bigint not null default 0,
  applied_generation bigint not null default -1,
  started_at timestamptz,
  last_restart_at timestamptz,
  last_manual_restart_at timestamptz,
  next_restart_at timestamptz not null default public.moderation_next_restart(),
  last_refresh_at timestamptz,
  heartbeat_at timestamptz,
  next_health_check_at timestamptz,
  last_processed_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  recovery_attempts integer not null default 0,
  recovery_blocked boolean not null default false,
  restart_reason text not null default 'start',
  error text,
  policy jsonb not null default '{"approved":false,"version":"unconfigured","rules":[]}',
  updated_at timestamptz not null default now()
);
insert into public.moderation_service(id) values (true);

create table public.moderation_connections (
  platform text primary key check (platform in ('facebook','instagram')),
  status text not null default 'Disconnected' check (status in ('Connected','Disconnected','Error')),
  checked_at timestamptz,
  error text
);
insert into public.moderation_connections(platform) values ('facebook'),('instagram');

create table public.moderation_jobs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  platform text not null check (platform in ('facebook','instagram')),
  account_id text not null,
  comment_id text not null,
  content text not null,
  status text not null default 'queued' check (status in ('queued','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  completed_at timestamptz
);
create index moderation_jobs_due on public.moderation_jobs(available_at,received_at) where status in ('queued','processing');
create table public.moderation_decisions (
  job_id uuid primary key references public.moderation_jobs(id),
  platform text not null,
  comment_id text not null,
  decision text not null check (decision in ('allow','review','hide')),
  categories text[] not null,
  policy_version text not null,
  reason text not null,
  action_status text not null check (action_status in ('none','pending','applied','review','failed')),
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create table public.moderation_actions (
  platform text not null,
  comment_id text not null,
  action text not null check (action = 'hide'),
  applied_at timestamptz,
  primary key(platform,comment_id,action)
);
create table public.moderation_history (
  id bigint generated always as identity primary key,
  kind text not null,
  generation bigint not null,
  actor_id uuid references public.admin_users(id),
  outcome text not null,
  detail text,
  created_at timestamptz not null default now()
);
create table public.moderation_security_events (
  id bigint generated always as identity primary key,
  admin_id uuid references public.admin_users(id),
  session_id uuid,
  action text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index moderation_security_rate on public.moderation_security_events(admin_id,created_at);
create table public.moderation_proofs (
  proof_hash text primary key,
  code_hash text not null unique,
  admin_id uuid not null references public.admin_users(id),
  session_id uuid not null,
  action text not null check (action in ('stop','restart','refresh')),
  expires_at timestamptz not null default now() + interval '2 minutes',
  consumed_at timestamptz
);
-- Only hashes are stored outside Vault. Raw worker authorization never reaches the browser.
create table public.moderation_worker_auth (token_hash text primary key);

-- Service-role-only tables: access is through authenticated, permission-checked routes.
do $$ declare t text; begin
  foreach t in array array['moderation_service','moderation_connections','moderation_jobs','moderation_decisions','moderation_actions','moderation_history','moderation_security_events','moderation_proofs','moderation_worker_auth'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage,select on sequence public.moderation_history_id_seq,public.moderation_security_events_id_seq to service_role;
insert into public.admin_permissions(permission_key,label,description,sort_order)
select k,l,d,900+n from (values
 (1,'moderation:view','View moderation server','View server health and moderation records.'),
 (2,'moderation:control','Control moderation server','Start and securely stop, restart or refresh moderation.'),
 (3,'moderation:review','Review moderation decisions','Record a human review outcome.')) as p(n,k,l,d)
where not exists (select 1 from public.admin_permissions a where a.permission_key=p.k);

create function public.moderation_authorized(p_admin uuid,p_session uuid,p_permission text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a join public.admin_security_sessions s on s.admin_id=a.id
    where a.id=p_admin and a.is_active and s.id=p_session and s.revoked_at is null
      and s.expires_at>now() and s.aal='aal2' and not s.requires_reauthentication
      and (a.role='main_admin' or exists (
        select 1 from public.admin_user_permissions up join public.admin_permissions p on p.id=up.permission_id
        where up.admin_user_id=a.id and up.is_allowed and p.permission_key=p_permission))
  );
$$;

create function public.moderation_rate_limit(p_admin uuid,p_session uuid,p_action text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_admin::text,0));
  if not public.moderation_authorized(p_admin,p_session,'moderation:control') then return false; end if;
  if (select count(*) from public.moderation_security_events where admin_id=p_admin and outcome='attempt' and created_at>now()-interval '10 minutes')>=10 then
    insert into public.moderation_security_events(admin_id,session_id,action,outcome) values(p_admin,p_session,p_action,'rate_limited');
    return false;
  end if;
  insert into public.moderation_security_events(admin_id,session_id,action,outcome) values(p_admin,p_session,p_action,'attempt');
  return true;
end $$;

create function public.moderation_command(p_admin uuid,p_session uuid,p_action text,p_generation bigint,p_proof text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.moderation_service; begin
  if not public.moderation_authorized(p_admin,p_session,'moderation:control') then raise exception 'Permission or session denied'; end if;
  select * into s from public.moderation_service where id for update;
  if s.generation<>p_generation then raise exception 'State changed. Refresh and try again.'; end if;
  if p_action not in ('start','stop','restart','refresh') then raise exception 'Invalid action'; end if;
  if p_action<>'start' then
    update public.moderation_proofs set consumed_at=now() where proof_hash=p_proof and admin_id=p_admin and session_id=p_session and action=p_action and consumed_at is null and expires_at>now();
    if not found then raise exception 'Verification expired or already used'; end if;
  end if;
  if p_action in ('restart','refresh') and not s.enabled then raise exception 'Service is off. Turn it on before restarting.'; end if;
  update public.moderation_service set enabled=(p_action<>'stop'),generation=generation+1,
    status=case p_action when 'stop' then 'Stopped' when 'start' then 'Starting' else 'Restarting' end,
    restart_reason=p_action,recovery_attempts=0,recovery_blocked=false,error=null,
    last_manual_restart_at=case when p_action='restart' then now() else last_manual_restart_at end,
    updated_at=now() where id;
  insert into public.moderation_history(kind,generation,actor_id,outcome) values(p_action,s.generation+1,p_admin,'requested');
  insert into public.moderation_security_events(admin_id,session_id,action,outcome) values(p_admin,p_session,p_action,'accepted');
  return jsonb_build_object('accepted',true,'generation',s.generation+1);
end $$;

-- One bounded invocation owns the coordinator. Commands never steal a live lease.
create function public.moderation_begin(p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.moderation_service; london timestamp; due timestamptz; begin
  select * into s from public.moderation_service where id for update;
  if s.lease_until>now() then return null; end if;
  -- Calendar-based timezone conversion handles 23/25-hour days and missed scheduler ticks.
  london:=now() at time zone 'Europe/London';
  due:=(date_trunc('day',london)+interval '8 hours') at time zone 'Europe/London';
  if due<=now() then due:=(date_trunc('day',london)+interval '1 day 8 hours') at time zone 'Europe/London'; end if;
  if s.enabled and s.next_restart_at<=now() and not s.recovery_blocked then
    update public.moderation_service set generation=generation+1,status='Restarting',restart_reason='automatic' where id returning * into s;
    insert into public.moderation_history(kind,generation,outcome) values('automatic',s.generation,'requested');
  end if;
  update public.moderation_service set next_restart_at=due where id;
  -- Expired work is retried with the same target-state action (hide=true), never deleted.
  update public.moderation_jobs set status=case when attempts>=5 then 'failed' else 'queued' end,
    lease_id=null,lease_until=null,last_error='Worker lease expired; preserved for retry',available_at=now()
    where status='processing' and lease_until<=now();
  if s.recovery_blocked then return null; end if;
  if s.enabled and (s.lease_id is not null or s.heartbeat_at<now()-interval '150 seconds') then
    s.recovery_attempts:=s.recovery_attempts+1;
    update public.moderation_service set generation=generation+1,restart_reason='recovery',status='Restarting' where id returning generation into s.generation;
    insert into public.moderation_history(kind,generation,outcome,detail) values('recovery',s.generation,'attempt','Worker invocation expired');
  end if;
  if s.recovery_attempts>=3 then
    update public.moderation_service set recovery_blocked=true,status='Error',error='Three worker failures. Inspect worker logs, then manually restart.',lease_id=null,lease_until=null where id;
    return null;
  end if;
  update public.moderation_service set lease_id=p_lease,lease_until=now()+interval '55 seconds',heartbeat_at=now(),
    next_health_check_at=now()+interval '1 minute',recovery_attempts=s.recovery_attempts,updated_at=now() where id;
  select * into s from public.moderation_service where id;
  return to_jsonb(s);
end $$;

create function public.moderation_ready(p_lease uuid,p_generation bigint,p_connections jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.moderation_service; c jsonb; healthy boolean; begin
  select * into s from public.moderation_service where id for update;
  if s.lease_id is distinct from p_lease or s.lease_until<=now() or s.generation<>p_generation then return false; end if;
  for c in select * from jsonb_array_elements(p_connections) loop
    update public.moderation_connections set status=c->>'status',error=c->>'error',checked_at=now() where platform=c->>'platform';
  end loop;
  healthy:=(select count(*)=2 and bool_and(status='Connected') from public.moderation_connections)
    and coalesce((s.policy->>'approved')::boolean,false) and jsonb_array_length(s.policy->'rules')>0;
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

create function public.moderation_claim(p_lease uuid,p_generation bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j public.moderation_jobs; s public.moderation_service; begin
  select * into s from public.moderation_service where id for update;
  if not s.enabled or s.status<>'Running' or s.generation<>p_generation or s.lease_id is distinct from p_lease or s.lease_until<=now() or s.next_restart_at<=now() then return null; end if;
  select * into j from public.moderation_jobs where status='queued' and available_at<=now() and attempts<5 order by received_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.moderation_jobs set status='processing',attempts=attempts+1,lease_id=p_lease,lease_until=s.lease_until where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create function public.moderation_finish(p_lease uuid,p_job uuid,p_decision jsonb default null,p_error text default null,p_retry_seconds integer default 60)
returns void language plpgsql security invoker set search_path = '' as $$
declare j public.moderation_jobs; begin
  select * into j from public.moderation_jobs where id=p_job and lease_id=p_lease and status='processing' and lease_until>now() for update;
  if not found then raise exception 'Job lease lost'; end if;
  if p_error is not null then
    update public.moderation_jobs set status=case when attempts>=5 then 'failed' else 'queued' end,last_error=left(p_error,500),
      available_at=now()+make_interval(secs=>greatest(30,least(p_retry_seconds,3600))),lease_id=null,lease_until=null where id=p_job;
    return;
  end if;
  insert into public.moderation_decisions(job_id,platform,comment_id,decision,categories,policy_version,reason,action_status)
    values(j.id,j.platform,j.comment_id,p_decision->>'decision',array(select jsonb_array_elements_text(p_decision->'categories')),p_decision->>'policyVersion',p_decision->>'reason',p_decision->>'actionStatus')
    on conflict(job_id) do nothing;
  update public.moderation_jobs set status='done',completed_at=now(),lease_id=null,lease_until=null where id=p_job;
  update public.moderation_service set last_processed_at=now() where id;
end $$;

create function public.moderation_end(p_lease uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.moderation_service set lease_id=null,lease_until=null,heartbeat_at=now(),next_health_check_at=now()+interval '1 minute',updated_at=now() where id and lease_id=p_lease;
end $$;

-- Remove default PUBLIC function access; these RPCs do not use SECURITY DEFINER.
do $$ declare r record; begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'moderation_%' loop
   execute format('revoke all on function %s from public, anon, authenticated',r.signature);
   execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
