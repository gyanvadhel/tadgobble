-- Conversations: comments can be answered one level deep. A removed comment that
-- already has replies stays as a placeholder so the thread still reads properly.
alter table public.tg_comments add column parent_id uuid references public.tg_comments(id) on delete cascade;
alter table public.tg_comments add column removed boolean not null default false;
create index tg_comments_parent on public.tg_comments(parent_id) where parent_id is not null;

alter function public.tg_api(text,jsonb) rename to tg_api_before_replies;
revoke all on function public.tg_api_before_replies(text,jsonb) from public,anon,authenticated;
create function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.tg_products; c public.tg_comments; parent uuid; result jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536 then raise exception 'Invalid request.'; end if;
  if route='comment' and coalesce(payload->>'parentId','')<>'' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    select * into p from public.tg_products where id=payload->>'productId' and status='published';
    if p.id is null then raise exception 'Product not found.'; end if;
    perform tg_private.rate('comment:'||uid::text,30,60);
    begin
      select coalesce(x.parent_id,x.id) into parent from public.tg_comments x where x.id=(payload->>'parentId')::uuid and x.product_id=p.id;
    exception when invalid_text_representation then parent:=null;
    end;
    if parent is null then raise exception 'That comment is no longer here.'; end if;
    insert into public.tg_comments(product_id,user_id,body,parent_id) values(p.id,uid,tg_private.field(payload->>'body','Comment',1500,2),parent);
    return jsonb_build_object('ok',true);
  end if;
  if route='comment/delete' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    begin
      select * into c from public.tg_comments where id=(payload->>'id')::uuid and not removed for update;
    exception when invalid_text_representation then c:=null;
    end;
    if c.id is null or not (c.user_id=uid or exists(select 1 from public.tg_profiles where id=uid and role='admin')) then
      raise exception 'You cannot remove this comment.';
    end if;
    if exists(select 1 from public.tg_comments where parent_id=c.id) then
      update public.tg_comments set removed=true,body='[removed]' where id=c.id;
    else
      delete from public.tg_comments where id=c.id;
    end if;
    -- A removed comment with nothing left under it can go entirely.
    if c.parent_id is not null then
      delete from public.tg_comments x where x.id=c.parent_id and x.removed and not exists(select 1 from public.tg_comments y where y.parent_id=x.id);
    end if;
    return jsonb_build_object('ok',true);
  end if;
  result:=public.tg_api_before_replies(route,payload);
  if route like 'products/%' and result ? 'product' then
    result:=jsonb_set(result,'{comments}',coalesce((
      select jsonb_agg(case when a.removed
        then jsonb_build_object('id',a.id,'parent_id',null,'created_at',a.created_at,'removed',true)
        else jsonb_build_object('id',a.id,'body',a.body,'created_at',a.created_at,'parent_id',a.parent_id,'removed',false,
          'name',b.name,'user_id',a.user_id,'profile',
          case when b.visible then jsonb_build_object('name',b.name,'blob',b.blob_avatar,'avatar',
            (select tg_private.cover_view(v) from public.tg_covers v where v.id=b.avatar_id)) end) end
        order by a.created_at desc)
      from public.tg_comments a join public.tg_profiles b on b.id=a.user_id
      where a.product_id=result->'product'->>'id' and (a.id in (select t.id from public.tg_comments t where t.product_id=result->'product'->>'id' and t.parent_id is null order by t.created_at desc limit 100)
        or a.parent_id in (select t.id from public.tg_comments t where t.product_id=result->'product'->>'id' and t.parent_id is null order by t.created_at desc limit 100))
    ),'[]'::jsonb));
  end if;
  return result;
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;
