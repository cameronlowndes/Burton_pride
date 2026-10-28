-- pg_net's extension-owned queue cannot be hardened by the project's postgres role.
-- Never place a permanent secret there: mint one-use, 60-second credentials per tick.
alter table public.moderation_worker_auth add column expires_at timestamptz not null default now();
alter table public.moderation_worker_auth add column used_at timestamptz;
create function public.moderation_accept_worker(p_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 update public.moderation_worker_auth set used_at=now() where token_hash=p_hash and used_at is null and expires_at>now();
 return found;
end $$;
revoke all on function public.moderation_accept_worker(text) from public,anon,authenticated;
grant execute on function public.moderation_accept_worker(text) to service_role;
select cron.schedule('moderation-worker-every-minute','* * * * *',$cron$
 do $tick$
 declare token text; endpoint text; begin
   update public.moderation_service set status='Error',error='Worker heartbeat overdue. Check Supabase Cron and Edge Function logs.'
     where id and enabled and not recovery_blocked and updated_at<now()-interval '150 seconds'
       and (heartbeat_at is null or heartbeat_at<now()-interval '150 seconds');
   delete from public.moderation_worker_auth where expires_at<now();
   select decrypted_secret into endpoint from vault.decrypted_secrets where name='moderation_worker_url';
   if endpoint is not null then
     token:=encode(extensions.gen_random_bytes(32),'hex');
     insert into public.moderation_worker_auth(token_hash,expires_at) values(encode(extensions.digest(token,'sha256'),'hex'),now()+interval '60 seconds');
     perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=55000);
   end if;
 end $tick$;
$cron$);
-- Retire the now-unused dedicated long-lived credential; no other Vault secret is touched.
delete from vault.secrets where name='moderation_worker_token';
