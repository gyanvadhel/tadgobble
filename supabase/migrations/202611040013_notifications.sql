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

-- Email: a queue the sender drains outside the user's request, plus the maker's own switch.
alter table public.tg_profiles add column email_updates boolean not null default true,
  add column first_save_emailed boolean not null default false;
create table public.tg_email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('first_save','comment','review','admin_queue','roundup')),
  recipient_id uuid references public.tg_profiles(id) on delete cascade,
  product_id text references public.tg_products(id) on delete cascade,
  comment_id uuid references public.tg_comments(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued','sent','skipped','failed')),
  attempts integer not null default 0,
  last_error text
);
create index tg_email_outbox_queue on public.tg_email_outbox(created_at) where status = 'queued';
alter table public.tg_email_outbox enable row level security;
revoke all on public.tg_email_outbox from public, anon, authenticated;
grant all on public.tg_email_outbox to service_role;

-- Saves that already exist are not news: remember them so only new savers ping the owner,
-- and makers who have already been saved never get a "first save" email.
insert into tg_private.save_seen(user_id, product_id) select user_id, product_id from public.tg_saves on conflict do nothing;
update public.tg_profiles u set first_save_emailed = true
  where exists (select 1 from public.tg_saves s join public.tg_products p on p.id = s.product_id where p.owner_id = u.id);

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
  c public.tg_comments; top_author uuid; pre public.tg_products; prod public.tg_products;
  review_outcome text; review_note text; maker_name text;
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
  if route = 'email-prefs' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    return jsonb_build_object('emailUpdates', (select email_updates from public.tg_profiles where id = uid));
  end if;
  if route = 'email-prefs/save' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    if jsonb_typeof(payload->'emailUpdates') is distinct from 'boolean' then raise exception 'Choose on or off.'; end if;
    update public.tg_profiles set email_updates = (payload->>'emailUpdates')::boolean where id = uid;
    return jsonb_build_object('emailUpdates', (payload->>'emailUpdates')::boolean);
  end if;

  -- What a review or edit looked like before the action changes it.
  begin
    if route in ('studio/product', 'works/update') then
      select * into pre from public.tg_products where id = payload->>'id';
    end if;
  exception when others then null;
  end;

  result := public.tg_api_before_notifications(route, payload);

  -- Reviews only count when something actually changed for the maker.
  if route = 'studio/product' and pre.owner_id is not null and payload->>'action' in ('verify', 'changes', 'reject')
     and (payload->>'action' <> 'verify' or pre.pending_edit is not null or pre.status is distinct from 'published') then
    review_outcome := case payload->>'action' when 'verify' then 'approved' when 'changes' then 'changes' else 'rejected' end;
  end if;

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
    elsif review_outcome is not null then
      perform tg_private.notify(pre.owner_id, 'review', pre.id, null, null, review_outcome);
    elsif route = 'comment/delete' then
      -- A removed comment with replies stays as a placeholder, so the cascade does not fire.
      delete from public.tg_notifications n using public.tg_comments x where n.comment_id = x.id and x.removed;
    end if;
  exception when others then null;
  end;

  -- Emails are queued separately, so a problem here never costs the bell item either.
  begin
    pid := payload->>'productId';
    select name into maker_name from public.tg_profiles where id = uid;
    if route = 'save' and result->>'saved' = 'true' then
      select owner_id into owner_uid from public.tg_products where id = pid;
      if owner_uid is not null and owner_uid <> uid then
        update public.tg_profiles set first_save_emailed = true where id = owner_uid and not first_save_emailed;
        if found then
          insert into public.tg_email_outbox(kind, recipient_id, product_id) values ('first_save', owner_uid, pid);
        end if;
      end if;
    elsif route = 'comment' then
      select * into c from public.tg_comments where product_id = pid and user_id = uid order by created_at desc, id limit 1;
      select owner_id into owner_uid from public.tg_products where id = pid;
      if c.id is not null and c.parent_id is null and owner_uid is not null and owner_uid <> uid then
        insert into public.tg_email_outbox(kind, recipient_id, product_id, comment_id, data)
          values ('comment', owner_uid, pid, c.id, jsonb_build_object('actor', maker_name, 'preview', left(c.body, 140)));
      end if;
    elsif review_outcome is not null then
      select * into prod from public.tg_products where id = pre.id;
      review_note := case when review_outcome = 'approved' then '' else coalesce(prod.review_note, '') end;
      insert into public.tg_email_outbox(kind, recipient_id, product_id, data)
        values ('review', pre.owner_id, pre.id,
          jsonb_build_object('outcome', review_outcome, 'note', review_note, 'edit', pre.pending_edit is not null));
    elsif route = 'submit' then
      select * into prod from public.tg_products where slug = result->>'slug';
      insert into public.tg_email_outbox(kind, product_id, data)
        values ('admin_queue', prod.id, jsonb_build_object('what', 'new', 'name', prod.name, 'maker', maker_name));
    elsif route = 'works/update' and pre.id is not null then
      select * into prod from public.tg_products where id = pre.id;
      if result->>'live' = 'true' then
        insert into public.tg_email_outbox(kind, product_id, data)
          values ('admin_queue', prod.id, jsonb_build_object('what', 'edit', 'name', prod.name, 'maker', maker_name));
      elsif pre.status in ('needs_changes', 'rejected') then
        insert into public.tg_email_outbox(kind, product_id, data)
          values ('admin_queue', prod.id, jsonb_build_object('what', 'resubmission', 'name', prod.name, 'maker', maker_name));
      end if;
    end if;
  exception when others then null;
  end;
  return result;
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
