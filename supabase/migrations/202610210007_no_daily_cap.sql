-- Cloud studio delegates publishing to the desktop worker. Do not advertise the
-- old fixed one-post allowance now that the app's daily cap is disabled.
create or replace function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if route='profile/save' and exists(select 1 from public.tg_videos where cover_id=nullif(payload->>'avatarId','')::uuid) then
    raise exception 'Choose a still image for your profile photo.';
  end if;
  result := public.tg_api_before_video(route,payload);
  if route='studio' then
    result := jsonb_set(result,'{connection,dailyLimit}','null'::jsonb);
  end if;
  return result;
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;
