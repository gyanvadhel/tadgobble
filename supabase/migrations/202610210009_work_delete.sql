-- Creators can delete their own work. Edits are touch-ups, so a post can't be
-- switched between art and an app listing; that is a new post instead.
alter function public.tg_api(text,jsonb) rename to tg_api_before_work_delete;
revoke all on function public.tg_api_before_work_delete(text,jsonb) from public,anon,authenticated;
create function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.tg_products;
begin
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536 then raise exception 'Invalid request.'; end if;
  if route in ('works/update','works/delete') then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    select * into p from public.tg_products where id=payload->>'id' and owner_id=uid for update;
    if p.id is null then raise exception 'Work not found.'; end if;
    if route='works/update' and coalesce(nullif(payload->>'kind',''),'app')<>coalesce(p.submission_details->>'kind','app') then
      raise exception 'You can’t change what kind of work this is. Share it as a new post.';
    end if;
    if route='works/delete' then
      perform tg_private.rate('delete:'||uid::text,20,3600);
      -- Saves, comments and events cascade with the product.
      delete from public.tg_products where id=p.id;
      insert into public.tg_audit(action,detail) values('work_deleted',p.id);
      return jsonb_build_object('ok',true);
    end if;
  end if;
  return public.tg_api_before_work_delete(route,payload);
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;
