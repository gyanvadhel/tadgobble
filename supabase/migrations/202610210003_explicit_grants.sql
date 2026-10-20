-- Hosted projects may grant EXECUTE to anon/authenticated through default privileges.
revoke all on function public.tg_cover_write(text) from public,anon,authenticated;
grant execute on function public.tg_cover_write(text) to authenticated;
revoke all on function public.tg_import_legacy_password(uuid,text),public.tg_legacy_password(text,text),public.tg_finish_legacy_password(uuid) from public,anon,authenticated;
