-- Edits to published work wait for review in pending_edit while the live version
-- stays up; approval applies them. Deleting work also frees its media, so storage
-- doesn't fill with files nothing can reach.
alter table public.tg_products add column pending_edit jsonb;

create or replace function tg_private.product_view(p public.tg_products) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(p)-'submission_details'-'owner_id'-'review_note'-'reviewed_at'-'pending_edit') || jsonb_build_object(
    'submission',p.submission_details,
    'cover',(select tg_private.cover_view(c) from public.tg_covers c where c.id=p.cover_id),
    'owner_name',case when p.submission_details->>'onBehalf'='true' then p.submission_details->>'creatorName' else (select name from public.tg_profiles where id=p.owner_id) end,
    'creator_username',case when coalesce(p.submission_details->>'onBehalf','false')<>'true' then (select username from public.tg_profiles where id=p.owner_id and visible) else null end,
    'creator_instagram',case when p.submission_details->>'onBehalf'='true' then p.submission_details->>'creatorInstagram' else (select instagram from public.tg_profiles where id=p.owner_id and visible) end,
    'save_count',(select count(*) from public.tg_saves where product_id=p.id),
    'comment_count',(select count(*) from public.tg_comments where product_id=p.id),
    'saved',exists(select 1 from public.tg_saves where product_id=p.id and user_id=auth.uid())) ||
    case when p.owner_id=auth.uid() or exists(select 1 from public.tg_profiles where id=auth.uid() and role='admin')
      then jsonb_build_object('review_note',p.review_note,'reviewed_at',p.reviewed_at) else '{}'::jsonb end
$$;
-- Owners and reviewers see a pending edit in place of the live version it would replace.
create function tg_private.edit_view(p public.tg_products) returns jsonb language sql stable set search_path = '' as $$
  select case when p.pending_edit is null then tg_private.product_view(p)
    else tg_private.product_view(jsonb_populate_record(p,p.pending_edit)) || jsonb_build_object('pendingEdit',true) end
$$;
create function tg_private.edit_of(p public.tg_products) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('name',p.name,'tagline',p.tagline,'description',p.description,'url',p.url,
    'category',p.category,'audience',p.audience,'pricing',p.pricing,'source',p.source,'facts',p.facts,
    'submission_details',p.submission_details,'cover_id',p.cover_id)
$$;
create function tg_private.apply_edit(product_id text,e jsonb) returns void language sql set search_path = '' as $$
  update public.tg_products t set name=r.name,tagline=r.tagline,description=r.description,url=r.url,
    category=r.category,audience=r.audience,pricing=r.pricing,source=r.source,facts=r.facts,
    submission_details=r.submission_details,cover_id=r.cover_id,pending_edit=null
  from jsonb_populate_record(null::public.tg_products,e) r where t.id=product_id
$$;

alter function public.tg_api(text,jsonb) rename to tg_api_before_live_edits;
revoke all on function public.tg_api_before_live_edits(text,jsonb) from public,anon,authenticated;
create function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.tg_products; n public.tg_products; result jsonb; covers uuid[]; paths jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536 then raise exception 'Invalid request.'; end if;
  if route='my-work' then
    if uid is null then raise exception 'Sign in to continue.'; end if;
    return jsonb_build_object('products',(select coalesce(jsonb_agg(tg_private.edit_view(x) order by x.created_at desc),'[]') from public.tg_products x where owner_id=uid));
  end if;
  if route='works/update' then
    select * into p from public.tg_products where id=payload->>'id' and owner_id=uid and status='published' for update;
    if p.id is not null then
      -- Validate and write through the usual path, then hold the result as a pending
      -- edit and put the live version back.
      result := public.tg_api_before_live_edits(route,payload);
      select * into n from public.tg_products where id=p.id;
      update public.tg_products set name=p.name,tagline=p.tagline,description=p.description,url=p.url,
        category=p.category,audience=p.audience,pricing=p.pricing,source=p.source,facts=p.facts,
        submission_details=p.submission_details,cover_id=p.cover_id,status=p.status,review_note='',
        reviewed_at=p.reviewed_at,verified_at=p.verified_at,pending_edit=tg_private.edit_of(n)
      where id=p.id;
      return result || jsonb_build_object('live',true);
    end if;
  end if;
  if route='works/delete' then
    select * into p from public.tg_products where id=payload->>'id' and owner_id=uid;
    covers := array_remove(array[p.cover_id,(p.pending_edit->>'cover_id')::uuid],null);
    result := public.tg_api_before_live_edits(route,payload);
    -- Free media nothing else uses; the client removes the files themselves.
    select coalesce(array_agg(c.id),'{}') into covers from public.tg_covers c where c.id=any(covers) and c.owner_id=uid
      and not exists(select 1 from public.tg_products x where x.cover_id=c.id or x.pending_edit->>'cover_id'=c.id::text)
      and not exists(select 1 from public.tg_profiles u where u.avatar_id=c.id);
    paths := jsonb_build_object(
      'covers',(select coalesce(jsonb_agg(path),'[]') from public.tg_covers where id=any(covers)),
      'videos',(select coalesce(jsonb_agg(path),'[]') from public.tg_videos where cover_id=any(covers)));
    delete from public.tg_covers where id=any(covers);
    return result || jsonb_build_object('removed',paths);
  end if;
  if route='studio/product' then
    select * into p from public.tg_products where id=payload->>'id' for update;
    if p.pending_edit is not null then
      if not exists(select 1 from public.tg_profiles where id=uid and role='admin') then raise exception 'Studio access is required.'; end if;
      if payload->>'action'='verify' then
        perform tg_private.apply_edit(p.id,p.pending_edit);
      elsif payload->>'action' in ('reject','changes') then
        update public.tg_products set pending_edit=null,reviewed_at=now(),
          review_note=tg_private.field(coalesce(nullif(trim(payload->>'feedback'),''),case when payload->>'action'='reject' then 'These edits were not accepted. Your post is unchanged.' else '' end),'Feedback',1000,3)
        where id=p.id;
        insert into public.tg_audit(action,detail) values('edit_'||(payload->>'action'),p.id);
        return jsonb_build_object('ok',true);
      elsif payload->>'action'='cover' then
        result := public.tg_api_before_live_edits(route,payload);
        update public.tg_products set cover_id=p.cover_id,
          pending_edit=pending_edit||jsonb_build_object('cover_id',(select cover_id from public.tg_products where id=p.id))
        where id=p.id;
        return result;
      end if;
    end if;
  end if;
  result := public.tg_api_before_live_edits(route,payload);
  if route='studio' then
    -- An edit to live work joins the review queue; the live version stays up meanwhile.
    result := jsonb_set(result,'{products}',(select coalesce(jsonb_agg(tg_private.edit_view(x) ||
      case when x.pending_edit is not null then jsonb_build_object('status','pending') else '{}'::jsonb end
      order by x.created_at desc),'[]') from public.tg_products x));
  end if;
  return result;
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;

-- Let members remove their own files once nothing in the app refers to them.
create function public.tg_orphan_file(bucket_name text,object_path text) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and split_part(object_path,'/',1)=auth.uid()::text
    and not exists(select 1 from public.tg_covers where bucket_name='covers' and path=object_path)
    and not exists(select 1 from public.tg_videos where bucket_name='videos' and path=object_path)
$$;
revoke all on function public.tg_orphan_file(text,text) from public;
grant execute on function public.tg_orphan_file(text,text) to authenticated;
create policy tg_orphan_select on storage.objects for select to authenticated using (bucket_id in ('covers','videos') and public.tg_orphan_file(bucket_id,name));
create policy tg_orphan_delete on storage.objects for delete to authenticated using (bucket_id in ('covers','videos') and public.tg_orphan_file(bucket_id,name));
