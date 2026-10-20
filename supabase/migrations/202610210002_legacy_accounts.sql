-- One-time password migration. Legacy hashes are never exposed through the Data API.
create table tg_private.legacy_passwords (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null
);
create function public.tg_import_legacy_password(user_id uuid, password_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if password_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$' then raise exception 'Invalid legacy password format.'; end if;
  insert into tg_private.legacy_passwords values(user_id,password_hash) on conflict do nothing;
end $$;
create function public.tg_legacy_password(email_value text, client_address text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform tg_private.rate('legacy:email:'||md5(lower(email_value)),5,900);
  perform tg_private.rate('legacy:ip:'||md5(client_address),30,900);
  perform tg_private.rate('legacy:global',200,3600);
  select jsonb_build_object('id',u.id,'hash',p.password_hash) into result
    from auth.users u join tg_private.legacy_passwords p on p.user_id=u.id where lower(u.email)=lower(email_value);
  return result;
end $$;
create function public.tg_finish_legacy_password(user_id uuid) returns void
language sql security definer set search_path = '' as $$delete from tg_private.legacy_passwords where legacy_passwords.user_id=tg_finish_legacy_password.user_id$$;
revoke all on function public.tg_import_legacy_password(uuid,text),public.tg_legacy_password(text,text),public.tg_finish_legacy_password(uuid) from public,anon,authenticated;
grant execute on function public.tg_import_legacy_password(uuid,text),public.tg_legacy_password(text,text),public.tg_finish_legacy_password(uuid) to service_role;
