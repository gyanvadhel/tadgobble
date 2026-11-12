-- Following makers. A signed-in person can follow a visible profile. The maker hears about a new
-- follower once, and followers get a bell item when the maker posts something new.
-- How many followers a maker has is public; who follows whom is not exposed by any route.
create table public.tg_follows (
  follower_id uuid not null references public.tg_profiles(id) on delete cascade,
  maker_id uuid not null references public.tg_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, maker_id),
  check (follower_id <> maker_id)
);
create index tg_follows_maker on public.tg_follows(maker_id);

-- Remembers who has ever followed whom, so following, unfollowing and following again stays quiet.
create table tg_private.follow_seen (
  follower_id uuid not null references public.tg_profiles(id) on delete cascade,
  maker_id uuid not null references public.tg_profiles(id) on delete cascade,
  primary key (follower_id, maker_id)
);

alter table public.tg_follows enable row level security;
alter table tg_private.follow_seen enable row level security;
revoke all on public.tg_follows, tg_private.follow_seen from public, anon, authenticated;
grant all on public.tg_follows, tg_private.follow_seen to service_role;

alter table public.tg_notifications drop constraint tg_notifications_kind_check;
alter table public.tg_notifications add constraint tg_notifications_kind_check
  check (kind in ('save','comment','reply','review','follow','new_work'));

alter function public.tg_api(text, jsonb) rename to tg_api_before_follows;
revoke all on function public.tg_api_before_follows(text, jsonb) from public, anon, authenticated;
create function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb; maker public.tg_profiles; prod public.tg_products;
begin
  if route = 'follow' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    perform tg_private.rate('follow:' || uid::text, 60, 3600);
    select * into maker from public.tg_profiles
      where username = lower(trim(coalesce(payload->>'username', ''))) and visible;
    if maker.id is null then raise exception 'This profile is unavailable.'; end if;
    if maker.id = uid then raise exception 'You can''t follow yourself.'; end if;
    delete from public.tg_follows where follower_id = uid and maker_id = maker.id;
    if not found then
      insert into public.tg_follows(follower_id, maker_id) values (uid, maker.id) on conflict do nothing;
      begin
        insert into tg_private.follow_seen(follower_id, maker_id) values (uid, maker.id) on conflict do nothing;
        if found then perform tg_private.notify(maker.id, 'follow', null, null, uid, ''); end if;
      exception when others then null;
      end;
    end if;
    return jsonb_build_object(
      'following', exists(select 1 from public.tg_follows where follower_id = uid and maker_id = maker.id),
      'followers', (select count(*) from public.tg_follows where maker_id = maker.id));
  end if;

  if route = 'notifications' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    return jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(x.item order by x.created_at desc) from (
          select n.created_at, jsonb_build_object(
            'id', n.id, 'kind', n.kind, 'count', n.count, 'preview', n.preview,
            'created_at', n.created_at, 'read', n.read_at is not null,
            'product', case when p.id is null then null else jsonb_build_object('slug', p.slug, 'name', p.name) end,
            'actor', case when n.kind = 'save' or a.id is null then null
              else jsonb_build_object('name', a.name, 'username', case when a.visible then a.username end) end
          ) || case when n.kind = 'review' then jsonb_build_object('outcome', n.preview) else '{}'::jsonb end as item
          from public.tg_notifications n
          left join public.tg_products p on p.id = n.product_id
          left join public.tg_profiles a on a.id = n.actor_id
          where n.recipient_id = uid
            and (n.product_id is null or p.id is not null)
            and (n.kind <> 'new_work' or p.status = 'published')
          order by n.created_at desc limit 30
        ) x
      ), '[]'::jsonb),
      'unread', (select count(*) from public.tg_notifications n
        left join public.tg_products p on p.id = n.product_id
        where n.recipient_id = uid and n.read_at is null
          and (n.kind <> 'new_work' or p.status = 'published'))
    );
  end if;

  result := public.tg_api_before_follows(route, payload);

  if route like 'profiles/%' then
    select * into maker from public.tg_profiles where username = lower(substring(route from 10)) and visible;
    result := result || jsonb_build_object(
      'followers', (select count(*) from public.tg_follows where maker_id = maker.id),
      'following', uid is not null and exists(select 1 from public.tg_follows where follower_id = uid and maker_id = maker.id));
  end if;

  -- Telling followers can never fail the post itself.
  begin
    if route = 'submit' then
      select * into prod from public.tg_products where slug = result->>'slug' and owner_id = uid;
      if prod.id is not null and prod.status = 'published'
         and coalesce(prod.submission_details->>'onBehalf', 'false') <> 'true' then
        insert into public.tg_notifications(recipient_id, kind, product_id, actor_id)
          select f.follower_id, 'new_work', prod.id, uid from public.tg_follows f where f.maker_id = uid;
      end if;
    end if;
  exception when others then null;
  end;
  return result;
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
