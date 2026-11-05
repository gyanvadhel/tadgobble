-- Notifications: the bell. Makers see when their work is saved, commented on or replied to,
-- and when a review has a result. Creating a notification can never fail the action that caused it.
create table public.tg_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.tg_profiles(id) on delete cascade,
  kind text not null check (kind in ('save','comment','reply','review')),
  product_id text references public.tg_products(id) on delete cascade,
  comment_id uuid references public.tg_comments(id) on delete cascade,
  actor_id uuid references public.tg_profiles(id) on delete set null,
  preview text not null default '',
  count integer not null default 1,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index tg_notifications_recipient on public.tg_notifications(recipient_id, created_at desc);

-- Remembers who has ever saved a work, so saving, unsaving and saving again stays quiet.
create table tg_private.save_seen (
  user_id uuid not null references public.tg_profiles(id) on delete cascade,
  product_id text not null references public.tg_products(id) on delete cascade,
  primary key (user_id, product_id)
);

alter table public.tg_notifications enable row level security;
alter table tg_private.save_seen enable row level security;
revoke all on public.tg_notifications, tg_private.save_seen from public, anon, authenticated;
grant all on public.tg_notifications, tg_private.save_seen to service_role;

-- Adds one bell item. Returns its id, or null when skipped (nobody to tell, or telling yourself).
create function tg_private.notify(recipient uuid, kind text, product text, comment uuid, actor uuid, preview text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nid uuid;
begin
  if recipient is null or recipient is not distinct from actor then return null; end if;
  insert into public.tg_notifications(recipient_id, kind, product_id, comment_id, actor_id, preview)
    values (recipient, kind, product, comment, actor, coalesce(preview, ''))
    returning id into nid;
  return nid;
end $$;
revoke all on function tg_private.notify(uuid, text, text, uuid, uuid, text) from public, anon, authenticated;

alter function public.tg_api(text, jsonb) rename to tg_api_before_notifications;
revoke all on function public.tg_api_before_notifications(text, jsonb) from public, anon, authenticated;
create function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); result jsonb; pid text; owner_uid uuid; nid uuid;
  c public.tg_comments; top_author uuid;
begin
  if route = 'notifications' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    return jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(x.item order by x.created_at desc) from (
          select n.created_at, jsonb_build_object(
            'id', n.id, 'kind', n.kind, 'count', n.count, 'preview', n.preview,
            'created_at', n.created_at, 'read', n.read_at is not null,
            'product', jsonb_build_object('slug', p.slug, 'name', p.name),
            'actor', case when n.kind = 'save' or a.id is null then null else jsonb_build_object('name', a.name) end
          ) || case when n.kind = 'review' then jsonb_build_object('outcome', n.preview) else '{}'::jsonb end as item
          from public.tg_notifications n
          join public.tg_products p on p.id = n.product_id
          left join public.tg_profiles a on a.id = n.actor_id
          where n.recipient_id = uid
          order by n.created_at desc limit 30
        ) x
      ), '[]'::jsonb),
      'unread', (select count(*) from public.tg_notifications where recipient_id = uid and read_at is null)
    );
  end if;
  if route = 'notifications/read' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    update public.tg_notifications set read_at = now() where recipient_id = uid and read_at is null;
    return jsonb_build_object('ok', true);
  end if;

  result := public.tg_api_before_notifications(route, payload);

  -- Hooks run after the real action has succeeded, and can never undo or fail it.
  begin
    pid := payload->>'productId';
    if route = 'save' and result->>'saved' = 'true' then
      select owner_id into owner_uid from public.tg_products where id = pid;
      if owner_uid is not null and owner_uid <> uid then
        perform pg_advisory_xact_lock(hashtext('notify-save:' || owner_uid::text || pid));
        insert into tg_private.save_seen(user_id, product_id) values (uid, pid) on conflict do nothing;
        if found then
          update public.tg_notifications set count = count + 1, created_at = now()
            where id = (select id from public.tg_notifications
              where recipient_id = owner_uid and kind = 'save' and product_id = pid and read_at is null
              order by created_at desc limit 1);
          if not found then
            insert into public.tg_notifications(recipient_id, kind, product_id, actor_id) values (owner_uid, 'save', pid, null);
          end if;
        end if;
      end if;
    elsif route = 'comment' then
      select * into c from public.tg_comments where product_id = pid and user_id = uid order by created_at desc, id limit 1;
      select owner_id into owner_uid from public.tg_products where id = pid;
      if c.id is not null then
        if c.parent_id is null then
          perform tg_private.notify(owner_uid, 'comment', pid, c.id, uid, left(c.body, 140));
        else
          select user_id into top_author from public.tg_comments where id = c.parent_id;
          perform tg_private.notify(top_author, 'reply', pid, c.id, uid, left(c.body, 140));
          if owner_uid is distinct from uid and owner_uid is distinct from top_author then
            perform tg_private.notify(owner_uid, 'reply', pid, c.id, uid, left(c.body, 140));
          end if;
        end if;
      end if;
    elsif route = 'comment/delete' then
      -- A removed comment with replies stays as a placeholder, so the cascade does not fire.
      delete from public.tg_notifications n using public.tg_comments x where n.comment_id = x.id and x.removed;
    end if;
  exception when others then null;
  end;
  return result;
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
