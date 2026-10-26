alter table public.tg_profiles
  add column blob_avatar jsonb not null default '{"shape":"gobble","color":"plum","mood":"chill","seed":"gobble"}',
  add column setup_completed boolean not null default false,
  add column setup_intent text not null default 'explore',
  add column setup_interests jsonb not null default '[]';
-- Existing members keep their profile and are not forced through a new flow.
update public.tg_profiles set setup_completed=true;

create or replace function tg_private.profile_view(u public.tg_profiles) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('name',u.name,'username',u.username,'bio',u.bio,'specialty',u.specialty,
    'instagram',u.instagram,'website',u.website,'color',u.color,'visible',u.visible,'blob',u.blob_avatar,
    'avatar',(select tg_private.cover_view(c) from public.tg_covers c where c.id=u.avatar_id))
$$;
create function tg_private.onboarding_view(u public.tg_profiles) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('complete',u.setup_completed,'intent',u.setup_intent,'interests',u.setup_interests)
$$;

alter function public.tg_api(text,jsonb) rename to tg_api_before_onboarding;
revoke all on function public.tg_api_before_onboarding(text,jsonb) from public,anon,authenticated;
create function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); u public.tg_profiles; result jsonb; blob jsonb; prefs jsonb; interests jsonb; intent text;
begin
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536 then raise exception 'Invalid request.'; end if;
  if route in ('onboarding/skip','onboarding/complete','profile/save') then
    select * into u from public.tg_profiles where id=uid;
    if u.id is null then raise exception 'Sign in to continue.'; end if;
    if route='onboarding/skip' then
      update public.tg_profiles set setup_completed=true where id=uid returning * into u;
      return jsonb_build_object('onboarding',tg_private.onboarding_view(u));
    end if;
    blob:=coalesce(payload->'blob',u.blob_avatar);
    if jsonb_typeof(blob) is distinct from 'object' then raise exception 'Choose a blob from the picker.'; end if;
    if (blob-array['shape','color','mood','seed'])<>'{}'::jsonb or
      coalesce(blob->>'shape','')<>all(array['gobble','cloud','pebble','round','boxy','sun']) or
      coalesce(blob->>'color','')<>all(array['plum','lavender','butter','orange','pond']) or
      coalesce(blob->>'mood','')<>all(array['chill','happy','wink','sleepy','wow']) or
      jsonb_typeof(blob->'seed') is distinct from 'string' or coalesce(blob->>'seed','') !~ '^[a-zA-Z0-9-]{1,48}$' then
      raise exception 'Choose a blob from the picker.';
    end if;
    prefs:=coalesce(payload->'preferences',tg_private.onboarding_view(u));
    intent:=prefs->>'intent'; interests:=prefs->'interests';
    if jsonb_typeof(prefs) is distinct from 'object' or coalesce(intent,'')<>all(array['explore','share','both']) or jsonb_typeof(interests) is distinct from 'array' then
      raise exception 'Choose an introduction and up to six interests from the list.';
    end if;
    if jsonb_array_length(interests)>6 or
      exists(select 1 from jsonb_array_elements(interests) x where jsonb_typeof(x) is distinct from 'string' or (x#>>'{}')<>all(array['Art & painting','Illustration','Graphic design','Photography','UI & UX','3D & animation','Video & motion','Apps & tools','Code & experiments','Writing','Music','Craft & objects'])) or
      (select count(distinct x) from jsonb_array_elements(interests) x)<>jsonb_array_length(interests) then
      raise exception 'Choose an introduction and up to six interests from the list.';
    end if;
    -- Existing profile validation, ownership, uniqueness and video-avatar checks
    -- run in the same transaction before any of these fields can be persisted.
    result:=public.tg_api_before_onboarding('profile/save',payload);
    update public.tg_profiles set blob_avatar=blob,setup_intent=intent,setup_interests=interests,
      setup_completed=setup_completed or route='onboarding/complete' where id=uid returning * into u;
    return jsonb_build_object('profile',tg_private.profile_view(u),'onboarding',tg_private.onboarding_view(u));
  end if;
  result:=public.tg_api_before_onboarding(route,payload);
  if route like 'products/%' then
    result:=jsonb_set(result,'{comments}',coalesce((select jsonb_agg(c || jsonb_build_object('profile',
      (select jsonb_build_object('name',p.name,'blob',p.blob_avatar,'avatar',
        (select tg_private.cover_view(a) from public.tg_covers a where a.id=p.avatar_id))
       from public.tg_profiles p where p.id=(c->>'user_id')::uuid and p.visible)))
      from jsonb_array_elements(result->'comments') c),'[]'::jsonb));
  end if;
  if route='bootstrap' and uid is not null then
    select * into u from public.tg_profiles where id=uid;
    if u.id is not null then result:=jsonb_set(result,'{user,onboarding}',tg_private.onboarding_view(u)); end if;
  end if;
  return result;
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;
