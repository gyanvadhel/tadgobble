-- Posting is instant. There is no review queue: a new work and every edit go live the
-- moment they are sent. An admin can still take a work down (the old "reject" action) and
-- put it back (the old "verify" action); a taken-down work stays down when its maker edits it.
-- "checked" is a note for the studio that someone looked at the source and facts; it never
-- hides or shows anything.

-- Whatever was waiting in the queue goes live now. Edits first, then the works themselves.
select tg_private.apply_edit(id, pending_edit) from public.tg_products where pending_edit is not null;
update public.tg_products set status = 'published', reviewed_at = now(), review_note = ''
where status in ('pending', 'needs_changes');

alter function public.tg_api(text, jsonb) rename to tg_api_before_instant;
revoke all on function public.tg_api_before_instant(text, jsonb) from public, anon, authenticated;
create function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.tg_products; result jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text) > 65536 then raise exception 'Invalid request.'; end if;

  if route = 'studio/product' then
    if payload->>'action' = 'changes' then
      raise exception 'Asking for changes is no longer part of tadgobble. Take the work down or leave it up.';
    end if;
    if payload->>'action' in ('checked', 'verify') then
      if not exists(select 1 from public.tg_profiles where id = uid and role = 'admin') then raise exception 'Studio access is required.'; end if;
      select * into p from public.tg_products where id = payload->>'id' for update;
      if p.id is null then raise exception 'Product not found.'; end if;
      if payload->>'action' = 'checked' then
        if payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm that you checked the source and facts.'; end if;
        if p.status <> 'published' then raise exception 'Put the work back live first.'; end if;
        update public.tg_products set verified_at = now() where id = p.id;
        insert into public.tg_audit(action, detail) values ('product_checked', p.id);
        return jsonb_build_object('ok', true);
      end if;
      if p.status = 'published' then raise exception 'This work is already live.'; end if;
    end if;
  end if;

  if route = 'works/update' then
    select * into p from public.tg_products where id = payload->>'id' and owner_id = uid;
  end if;

  result := public.tg_api_before_instant(route, payload);

  if route = 'submit' then
    update public.tg_products set status = 'published', reviewed_at = now(), review_note = ''
    where slug = result->>'slug' and owner_id = uid and status = 'pending';
  elsif route = 'works/update' and p.id is not null then
    if result->>'live' = 'true' then
      -- A live work takes the edit now; the checked mark belongs to the words that were checked.
      perform tg_private.apply_edit(p.id, (select pending_edit from public.tg_products where id = p.id));
      update public.tg_products set verified_at = null where id = p.id;
      delete from public.tg_email_outbox where kind = 'admin_queue' and product_id = p.id and status = 'queued' and data->>'what' = 'edit';
      result := result - 'live';
    elsif p.status in ('rejected', 'archived') then
      -- Editing does not undo a take-down; only an admin puts a work back.
      update public.tg_products set status = p.status, review_note = p.review_note, reviewed_at = p.reviewed_at, verified_at = p.verified_at where id = p.id;
      delete from public.tg_email_outbox where kind = 'admin_queue' and product_id = p.id and status = 'queued' and data->>'what' = 'resubmission';
    else
      update public.tg_products set status = 'published', reviewed_at = now(), review_note = '' where id = p.id;
    end if;
  end if;
  return result;
end $$;
revoke all on function public.tg_api(text, jsonb) from public;
grant execute on function public.tg_api(text, jsonb) to anon, authenticated;
