-- Discover as a showcase: every listing carries its creator's public avatar, and
-- conversation counts leave out removed comments.
create or replace function tg_private.product_view(p public.tg_products) returns jsonb language sql stable set search_path = '' as $$
  select (to_jsonb(p)-'submission_details'-'owner_id'-'review_note'-'reviewed_at'-'pending_edit') || jsonb_build_object(
    'submission',p.submission_details,
    'cover',(select tg_private.cover_view(c) from public.tg_covers c where c.id=p.cover_id),
    'owner_name',case when p.submission_details->>'onBehalf'='true' then p.submission_details->>'creatorName' else (select name from public.tg_profiles where id=p.owner_id) end,
    'creator_username',case when coalesce(p.submission_details->>'onBehalf','false')<>'true' then (select username from public.tg_profiles where id=p.owner_id and visible) else null end,
    'creator_instagram',case when p.submission_details->>'onBehalf'='true' then p.submission_details->>'creatorInstagram' else (select instagram from public.tg_profiles where id=p.owner_id and visible) end,
    'creator_profile',case when coalesce(p.submission_details->>'onBehalf','false')<>'true' then (
      select jsonb_build_object('name',b.name,'blob',b.blob_avatar,'avatar',
        (select tg_private.cover_view(v) from public.tg_covers v where v.id=b.avatar_id))
      from public.tg_profiles b where b.id=p.owner_id and b.visible) end,
    'save_count',(select count(*) from public.tg_saves where product_id=p.id),
    'comment_count',(select count(*) from public.tg_comments where product_id=p.id and not removed),
    'saved',exists(select 1 from public.tg_saves where product_id=p.id and user_id=auth.uid())) ||
    case when p.owner_id=auth.uid() or exists(select 1 from public.tg_profiles where id=auth.uid() and role='admin')
      then jsonb_build_object('review_note',p.review_note,'reviewed_at',p.reviewed_at) else '{}'::jsonb end
$$;
