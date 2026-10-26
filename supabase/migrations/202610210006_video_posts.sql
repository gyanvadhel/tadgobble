create table public.tg_videos (
  id uuid primary key,
  cover_id uuid not null unique references public.tg_covers(id) on delete cascade,
  owner_id uuid references public.tg_profiles(id) on delete set null,
  path text not null unique,
  mime text not null check(mime in ('video/mp4','video/webm')),
  duration double precision not null check(duration>0 and duration<=120),
  width integer not null check(width between 16 and 1920),
  height integer not null check(height between 16 and 1920),
  bytes integer not null check(bytes between 24 and 5242880),
  created_at timestamptz not null default now()
);
alter table public.tg_videos enable row level security;
revoke all on public.tg_videos from anon,authenticated;
grant all on public.tg_videos to service_role;

create or replace function tg_private.cover_view(c public.tg_covers) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',c.id,'path',c.path,'kind',c.kind,'status',c.status,'created_at',c.created_at,'error',c.last_error,
    'video',(select jsonb_build_object('id',v.id,'duration',v.duration,'width',v.width,'height',v.height,'mime',v.mime,'bytes',v.bytes) from public.tg_videos v where v.cover_id=c.id))
$$;

create function public.tg_video_read(object_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.tg_videos v where v.path=object_path and (
    v.owner_id=auth.uid() or exists(select 1 from public.tg_profiles where id=auth.uid() and role='admin') or
    exists(select 1 from public.tg_products where cover_id=v.cover_id and status='published')))
$$;
grant execute on function public.tg_video_read(text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('videos','videos',false,5242880,array['video/mp4','video/webm']);
create policy tg_video_select on storage.objects for select to anon,authenticated using(bucket_id='videos' and public.tg_video_read(name));

create function public.tg_video_play(video_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.tg_videos;
begin
  select * into v from public.tg_videos where id=video_id;
  if v.id is null or not public.tg_video_read(v.path) then raise exception 'This video is unavailable.'; end if;
  return jsonb_build_object('id',v.id,'path',v.path,'mime',v.mime,'duration',v.duration,'width',v.width,'height',v.height);
end $$;
revoke all on function public.tg_video_play(uuid) from public;
grant execute on function public.tg_video_play(uuid) to anon,authenticated;

create function public.tg_video_upload_gate() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null or not exists(select 1 from public.tg_profiles where id=uid) then raise exception 'Sign in to upload a video.'; end if;
  perform tg_private.rate('video-upload:'||uid::text,10,3600);
  return uid;
end $$;
revoke all on function public.tg_video_upload_gate() from public;
grant execute on function public.tg_video_upload_gate() to authenticated;

-- Only the validating Edge Function may attach video bytes to a cover.
create function public.tg_video_finalize(uid uuid,cid uuid,vid uuid,poster_path text,video_path text,metadata jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.tg_covers;
begin
  if not exists(select 1 from public.tg_profiles where id=uid) then raise exception 'Account not found.'; end if;
  if poster_path<>(uid::text||'/'||cid::text||'.webp') or video_path<>(uid::text||'/'||vid::text||(case when metadata->>'mime'='video/webm' then '.webm' else '.mp4' end)) then raise exception 'Invalid video path.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='covers' and name=poster_path) or not exists(select 1 from storage.objects where bucket_id='videos' and name=video_path) then raise exception 'Upload both the video and cover first.'; end if;
  insert into public.tg_covers(id,owner_id,path,kind,status) values(cid,uid,poster_path,'upload','ready') returning * into c;
  insert into public.tg_videos(id,cover_id,owner_id,path,mime,duration,width,height,bytes) values(vid,cid,uid,video_path,metadata->>'mime',(metadata->>'duration')::double precision,(metadata->>'width')::integer,(metadata->>'height')::integer,(metadata->>'bytes')::integer);
  return jsonb_build_object('cover',tg_private.cover_view(c));
end $$;
revoke all on function public.tg_video_finalize(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.tg_video_finalize(uuid,uuid,uuid,text,text,jsonb) to service_role;

alter function public.tg_api(text,jsonb) rename to tg_api_before_video;
revoke all on function public.tg_api_before_video(text,jsonb) from public,anon,authenticated;
create function public.tg_api(route text,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if route='profile/save' and exists(select 1 from public.tg_videos where cover_id=nullif(payload->>'avatarId','')::uuid) then raise exception 'Choose a still image for your profile photo.'; end if;
  return public.tg_api_before_video(route,payload);
end $$;
revoke all on function public.tg_api(text,jsonb) from public;
grant execute on function public.tg_api(text,jsonb) to anon,authenticated;
