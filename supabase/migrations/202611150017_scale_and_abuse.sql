-- Holding up as the site grows, and against a few people trying to spoil it:
--  * The catalog arrives 48 works at a time (bootstrap, then products/page), not all at once.
--  * Shared daily limits on covers and inquiries are high enough that one or two
--    visitors can't use them up for everyone; each visitor gets their own daily limit instead.
--  * Nobody gets more than 5 comment emails a day. The bell and the weekly roundup cover the rest.
--  * Deleting an account deletes the person's works and uploaded files too.

-- Keyset paging over the same order Discover shows: featured first, newest next.
create index tg_products_page on public.tg_products(featured desc, created_at desc, id desc)
  where status = 'published';

-- Shared limits: raised here so every earlier layer that calls rate() gets the new values.
create or replace function tg_private.rate(k text, cap integer, seconds integer) returns void
language plpgsql set search_path = '' as $$
declare n integer;
begin
  cap := case k when 'covers:global' then 20000 when 'inquiry:global' then 1000 else cap end;
  insert into public.tg_rate_limits(key,count,reset_at) values(k,1,now()+make_interval(secs=>seconds))
  on conflict(key) do update set count=case when tg_rate_limits.reset_at<=now() then 1 else tg_rate_limits.count+1 end,
    reset_at=case when tg_rate_limits.reset_at<=now() then now()+make_interval(secs=>seconds) else tg_rate_limits.reset_at end
  returning count into n;
  if n > cap then raise exception 'Too many requests. Please try again later.'; end if;
end $$;

-- One page of the published catalog after a cursor (null for the first page).
-- The cursor is "featured|created_at|id" of the last work on the previous page.
create function tg_private.catalog_page(cursor_value text, page_size integer) returns jsonb
language plpgsql stable set search_path = '' as $$
declare parts text[]; after_featured boolean; after_at timestamptz; after_id text; rows jsonb; last record; more boolean;
begin
  if cursor_value is not null then
    parts := regexp_match(cursor_value, '^([01])\|([^|]+)\|(.+)$');
    if parts is null then raise exception 'Invalid page cursor.'; end if;
    begin
      after_featured := parts[1] = '1';
      after_at := parts[2]::timestamptz;
      after_id := parts[3];
    exception when others then raise exception 'Invalid page cursor.';
    end;
  end if;
  select coalesce(jsonb_agg(q.v order by q.n) filter (where q.n <= page_size), '[]'), count(*) > page_size
    into rows, more
    from (
      select tg_private.product_view(p) as v,
        row_number() over (order by p.featured desc, p.created_at desc, p.id desc) as n
      from public.tg_products p
      where p.status = 'published'
        and (cursor_value is null or (p.featured, p.created_at, p.id) < (after_featured, after_at, after_id))
      order by p.featured desc, p.created_at desc, p.id desc
      limit page_size + 1
    ) q;
  if not more then return jsonb_build_object('products', rows, 'nextCursor', null); end if;
  select p.featured, p.created_at, p.id into last from public.tg_products p
    where p.id = rows->(page_size - 1)->>'id';
  return jsonb_build_object('products', rows, 'nextCursor',
    case when last.featured then '1' else '0' end || '|'
    || to_char(last.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || last.id);
end $$;

-- Every comment email beyond 5 in a day to the same person is dropped before it is queued.
create index tg_email_outbox_comment_day on public.tg_email_outbox(recipient_id, created_at)
  where kind = 'comment';
create function tg_private.cap_comment_emails() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'comment' and (select count(*) from public.tg_email_outbox o
      where o.kind = 'comment' and o.recipient_id = new.recipient_id
        and o.created_at > now() - interval '24 hours') >= 5 then
    return null;
  end if;
  return new;
end $$;
create trigger tg_email_outbox_comment_cap before insert on public.tg_email_outbox
  for each row execute function tg_private.cap_comment_emails();

alter function public.tg_api(text, jsonb) rename to tg_api_before_scale;
revoke all on function public.tg_api_before_scale(text, jsonb) from public, anon, authenticated;
create function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u public.tg_profiles; actor text; result jsonb; saved jsonb;
  covers uuid[]; paths jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' then
    return public.tg_api_before_scale(route, payload);
  end if;
  actor := coalesce(uid::text, md5(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', 'anonymous')));

  if route = 'bootstrap' then
    result := tg_private.catalog_page(null, 48);
    select * into u from public.tg_profiles where id = uid;
    if u.id is null then return result || jsonb_build_object('user', null); end if;
    -- Saved works may sit on pages not loaded yet; send them so "Saved" is complete.
    -- shortcut: the newest 200 saves; past that, older saves show once their page loads.
    select coalesce(jsonb_agg(tg_private.product_view(p) order by s.created_at desc), '[]') into saved
      from (select * from public.tg_saves where user_id = uid order by created_at desc limit 200) s
      join public.tg_products p on p.id = s.product_id and p.status = 'published';
    return result || jsonb_build_object('saved', saved, 'user', jsonb_build_object(
      'id', u.id, 'name', u.name, 'role', u.role,
      'email', (select email from auth.users where id = uid),
      'profile', tg_private.profile_view(u),
      'onboarding', tg_private.onboarding_view(u)));
  end if;

  if route = 'products/page' then
    perform tg_private.rate('page:' || actor, 300, 3600);
    return tg_private.catalog_page(nullif(payload->>'cursor', ''), 48);
  end if;

  if route in ('covers/prepare', 'covers/capture') then
    perform tg_private.rate('covers-day:' || actor, 60, 86400);
  elsif route = 'sponsor' then
    perform tg_private.rate('inquiry-day:' || actor, 5, 86400);
  end if;

  if route = 'account/delete' and uid is not null then
    select * into u from public.tg_profiles where id = uid;
    if u.id is not null and u.role is distinct from 'admin' then
      -- Everything the person uploaded, unless someone else's work or profile uses it.
      select coalesce(array_agg(c.id), '{}') into covers from public.tg_covers c
        where c.owner_id = uid
          and not exists(select 1 from public.tg_products x
            where (x.cover_id = c.id or x.pending_edit->>'cover_id' = c.id::text) and x.owner_id is distinct from uid)
          and not exists(select 1 from public.tg_profiles p where p.avatar_id = c.id and p.id <> uid);
      paths := jsonb_build_object(
        'covers', (select coalesce(jsonb_agg(path order by path), '[]') from public.tg_covers where id = any(covers)),
        'videos', (select coalesce(jsonb_agg(path order by path), '[]') from public.tg_videos where cover_id = any(covers)));
      -- Saves, comments, events and notifications go with the works.
      delete from public.tg_products where owner_id = uid;
      insert into public.tg_audit(action, detail) values('account_deleted_with_works', uid::text);
      result := public.tg_api_before_scale(route, payload);
      delete from public.tg_covers where id = any(covers); -- videos cascade
      return result || jsonb_build_object('removed', paths);
    end if;
  end if;

  return public.tg_api_before_scale(route, payload);
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
