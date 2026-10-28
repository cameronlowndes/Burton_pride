-- One bounded worker tick per minute, independent of browsers and Vercel plans.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ declare token text; begin
  if not exists(select 1 from vault.secrets where name='moderation_worker_token') then
    token:=encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(token,'moderation_worker_token','Dedicated moderation worker invocation credential');
  else
    select decrypted_secret into token from vault.decrypted_secrets where name='moderation_worker_token';
  end if;
  insert into public.moderation_worker_auth(token_hash) values(encode(extensions.digest(token,'sha256'),'hex')) on conflict do nothing;
end $$;
-- pg_net temporarily stores HTTP headers; ordinary API users must not read its queue.
revoke all on net.http_request_queue from public,anon,authenticated;
select cron.schedule('moderation-worker-every-minute','* * * * *',$cron$
  update public.moderation_service set status='Error',error='Worker heartbeat overdue. Check Supabase Cron and Edge Function logs.'
    where id and enabled and not recovery_blocked and updated_at<now()-interval '150 seconds'
      and (heartbeat_at is null or heartbeat_at<now()-interval '150 seconds');
  select net.http_post(
    url:=endpoint.decrypted_secret,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || credential.decrypted_secret),
    body:='{}'::jsonb,timeout_milliseconds:=55000
  ) from vault.decrypted_secrets endpoint cross join vault.decrypted_secrets credential
    where endpoint.name='moderation_worker_url' and credential.name='moderation_worker_token';
$cron$);
