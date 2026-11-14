-- More profile and blob colours. Earlier layers only know the original palette, so this
-- layer hands them a colour they accept, lets every other check run as before, and then
-- stores the colour the person actually picked.
alter function public.tg_api(text, jsonb) rename to tg_api_before_colours;
revoke all on function public.tg_api_before_colours(text, jsonb) from public, anon, authenticated;
create function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u public.tg_profiles; result jsonb; blob jsonb;
  new_profile text[] := array['mint','rose','tangerine','lime','sky','cloud'];
  new_blob text[] := array['mint','sky','rose','peach','cherry','midnight'];
  want_color text; want_blob text;
begin
  if route not in ('profile/save', 'onboarding/complete') or jsonb_typeof(payload) is distinct from 'object' then
    return public.tg_api_before_colours(route, payload);
  end if;
  select * into u from public.tg_profiles where id = uid;
  if u.id is null then return public.tg_api_before_colours(route, payload); end if;

  if payload->>'color' = any(new_profile) then
    want_color := payload->>'color';
    payload := payload || jsonb_build_object('color', 'lavender');
  end if;
  blob := coalesce(payload->'blob', u.blob_avatar);
  if jsonb_typeof(blob) = 'object' and blob->>'color' = any(new_blob) then
    want_blob := blob->>'color';
    payload := payload || jsonb_build_object('blob', blob || jsonb_build_object('color', 'plum'));
  end if;

  result := public.tg_api_before_colours(route, payload);
  if want_color is null and want_blob is null then return result; end if;

  update public.tg_profiles set
    color = coalesce(want_color, color),
    blob_avatar = case when want_blob is null then blob_avatar
      else blob_avatar || jsonb_build_object('color', want_blob) end
  where id = uid returning * into u;
  return jsonb_set(result, '{profile}', tg_private.profile_view(u));
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
