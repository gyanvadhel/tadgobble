-- Creative work requires an owned, ready image; website links are optional.
-- Replaces the RPC without changing its grants, existing listings, or review rules.
create or replace function public.tg_api(route text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); u public.tg_profiles; p public.tg_products; c public.tg_covers;
  art boolean := false; admin boolean := false; result jsonb; items jsonb; comments jsonb; analytics jsonb;
  pid text; cid uuid; name_value text; slug_value text; facts_value jsonb; fields jsonb;
  visitor_value text; source_value text; kind_value text; actor text; saved_value boolean;
begin
  if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>65536 then raise exception 'Invalid request.'; end if;
  select * into u from public.tg_profiles where id=uid;
  admin := coalesce(u.role='admin',false);
  actor := coalesce(uid::text,md5(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for','anonymous')));
  if route='health' then return jsonb_build_object('ok',true,'backend','supabase'); end if;
  if route='bootstrap' then
    select coalesce(jsonb_agg(tg_private.product_view(x) order by x.featured desc,x.created_at desc),'[]') into items from public.tg_products x where x.status='published';
    return jsonb_build_object('products',items,'user',case when u.id is null then null else jsonb_build_object('id',u.id,'name',u.name,'role',u.role,'email',(select email from auth.users where id=uid)) end);
  end if;
  if route like 'products/%' then
    select * into p from public.tg_products where slug=substring(route from 10) and status='published';
    if p.id is null then raise exception 'Product not found.'; end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into comments from
      (select a.id,a.body,a.created_at,b.name,a.user_id from public.tg_comments a join public.tg_profiles b on a.user_id=b.id where a.product_id=p.id order by a.created_at desc limit 100) x;
    return jsonb_build_object('product',tg_private.product_view(p),'comments',comments);
  end if;
  if route='events' then
    if admin then return jsonb_build_object('ok',true); end if;
    kind_value := case when payload->>'kind' in ('visit','detail','outbound') then payload->>'kind' else 'visit' end;
    visitor_value := md5(tg_private.field(payload->>'visitor','Visitor',80));
    source_value := coalesce(nullif(left(regexp_replace(coalesce(payload->>'source','direct'),'[^a-zA-Z0-9_-]','','g'),40),''),'direct');
    select id into pid from public.tg_products where id=payload->>'productId' and status='published';
    perform tg_private.rate('events:'||actor,120,3600);
    perform tg_private.rate('events:global',20000,86400);
    if not exists(select 1 from public.tg_events where visitor=visitor_value and kind=kind_value and coalesce(product_id,'')=coalesce(pid,'') and
      created_at > case when kind_value='outbound' then now()-interval '5 minutes' else date_trunc('day',now()) end) then
      insert into public.tg_events(kind,product_id,visitor,source,campaign) values(kind_value,pid,visitor_value,source_value,left(coalesce(payload->>'campaign',''),80));
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if route='sponsor' then
    perform tg_private.rate('inquiry:'||actor,3,3600);
    perform tg_private.rate('inquiry:global',100,86400);
    if coalesce(payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email.'; end if;
    insert into public.tg_inquiries(name,email,product_url,message) values(tg_private.field(payload->>'name','Name',80),tg_private.field(payload->>'email','Email',254),tg_private.web_url(payload->>'url'),tg_private.field(payload->>'message','Message',2000,10));
    return jsonb_build_object('ok',true);
  end if;
  if uid is null or u.id is null then raise exception 'Sign in to continue.'; end if;
  if (route like 'studio%' or route like 'worker/%') and not admin then raise exception 'Studio access is required.'; end if;

  if route='save' or route='comment' then
    select * into p from public.tg_products where id=payload->>'productId' and status='published';
    if p.id is null then raise exception 'Product not found.'; end if;
    perform tg_private.rate(route||':'||actor,30,60);
    if route='save' then
      perform pg_advisory_xact_lock(hashtext(uid::text||p.id));
      delete from public.tg_saves where user_id=uid and product_id=p.id;
      saved_value := not found;
      if saved_value then insert into public.tg_saves(user_id,product_id) values(uid,p.id); end if;
      return jsonb_build_object('saved',saved_value);
    end if;
    insert into public.tg_comments(product_id,user_id,body) values(p.id,uid,tg_private.field(payload->>'body','Comment',1500,2));
    return jsonb_build_object('ok',true);
  end if;
  if route='comment/delete' then
    delete from public.tg_comments where id=(payload->>'id')::uuid and (user_id=uid or admin);
    if not found then raise exception 'You cannot remove this comment.'; end if;
    return jsonb_build_object('ok',true);
  end if;
  if route='covers/prepare' or route='covers/capture' then
    perform tg_private.rate('covers:'||actor,20,3600);
    perform tg_private.rate('covers:global',1000,86400);
    cid := gen_random_uuid();
    if route='covers/capture' then
      name_value := tg_private.web_url(payload->>'url');
      if not coalesce((payload->>'refresh')::boolean,false) then
        select * into c from public.tg_covers where owner_id=uid and source_url=name_value and kind='capture' and status in ('queued','capturing','ready') and created_at>now()-interval '24 hours' order by created_at desc limit 1;
        if c.id is not null then return jsonb_build_object('cover',tg_private.cover_view(c)); end if;
      end if;
    end if;
    insert into public.tg_covers(id,owner_id,path,kind,source_url,status) values(cid,uid,uid::text||'/'||cid::text||'.webp',
      case when route='covers/capture' then 'capture' else 'upload' end,coalesce(name_value,''),case when route='covers/capture' then 'queued' else 'uploading' end) returning * into c;
    return jsonb_build_object('cover',tg_private.cover_view(c));
  end if;
  if route='covers/status' or route='covers/complete' then
    select * into c from public.tg_covers where id=(payload->>'id')::uuid and (owner_id=uid or admin);
    if c.id is null then raise exception 'Cover not found.'; end if;
    if route='covers/complete' then
      if c.kind<>'upload' or c.status<>'uploading' or not exists(select 1 from storage.objects where bucket_id='covers' and name=c.path) then raise exception 'Upload the cover before using it.'; end if;
      update public.tg_covers set status='ready' where id=c.id returning * into c;
    end if;
    return jsonb_build_object('cover',tg_private.cover_view(c));
  end if;
  if route='submit' then
    perform tg_private.rate('submit:'||actor,5,86400);
    if payload->'ownership' is distinct from 'true'::jsonb then raise exception 'Confirm you are the maker or authorised to submit.'; end if;
    kind_value := coalesce(payload->>'kind','app');
    if kind_value not in ('art','app') then raise exception 'Choose art or an app.'; end if;
    art := kind_value='art';
    payload := payload || jsonb_build_object('category',coalesce(nullif(payload->>'category',''),case when art then 'Art & design' else 'Design' end));
    name_value := tg_private.field(payload->>'name',case when art then 'Title' else 'Product name' end,60);
    if art then
      payload := payload || jsonb_build_object('tagline',coalesce(nullif(payload->>'tagline',''),payload->>'category'));
    end if;
    if not coalesce(payload->>'category'=any(array['Art & design','Painting','Drawing & sketching','Illustration','Graphic design','UI & UX design','3D & animation','Photography','Crafts & sculpture','Fashion & textiles','Architecture','Other creative work','AI assistants','Automation','Design','Developer tools','Productivity','Writing','Marketing','Sales & CRM','Business','Data & analytics','No-code','Video','Audio & music','Education','Research','Finance','Health & wellness','Games','Play','Lifestyle','Community']),false) then raise exception 'Choose a category from the list.'; end if;
    if not coalesce(coalesce(payload->>'audience','Everyone')=any(array['Everyone','Creators','Businesses','Developers','Freelancers','Students','Educators','Teams']),false) then raise exception 'Choose an audience from the list.'; end if;
    fields := coalesce(payload->'platforms','[]'::jsonb);
    if jsonb_typeof(fields)<>'array' then raise exception 'Choose platforms from the list.'; end if;
    if jsonb_array_length(fields)>7 or exists(select 1 from jsonb_array_elements_text(fields) as v where v<>all(array['Web app','iOS','Android','Desktop app','Browser extension','API','Command line'])) then raise exception 'Choose platforms from the list.'; end if;
    if coalesce(payload->>'pricingModel','')<>'' and payload->>'pricingModel'<>all(array['Free','Free plan + paid upgrades','Free trial','Paid subscription','One-time purchase','Pay what you want']) then raise exception 'Choose a pricing model from the list.'; end if;
    if coalesce(payload->>'demoUrl','')<>'' then perform tg_private.web_url(payload->>'demoUrl'); end if;
    cid := nullif(payload->>'coverId','')::uuid;
    if cid is not null and not exists(select 1 from public.tg_covers where id=cid and owner_id=uid and status in ('queued','capturing','ready','failed')) then raise exception 'Choose a cover belonging to your account.'; end if;
    if art and (cid is null or not exists(select 1 from public.tg_covers where id=cid and owner_id=uid and kind='upload' and status='ready')) then raise exception 'Add a photo of your work before sending it.'; end if;
    select coalesce(jsonb_agg(v),'[]') into facts_value from (select trim(v) as v from regexp_split_to_table(tg_private.field(payload->>'facts','Capabilities',1500,0),E'\n') as v where trim(v)<>'' limit 5) x;
    pid := gen_random_uuid()::text;
    slug_value := trim(both '-' from left(regexp_replace(lower(name_value),'[^a-z0-9]+','-','g'),60))||'-'||left(pid,6);
    insert into public.tg_products(id,slug,name,tagline,description,url,category,audience,pricing,color,source,facts,owner_id,cover_id,submission_details)
    values(pid,slug_value,name_value,tg_private.field(payload->>'tagline','Tagline',100),tg_private.field(coalesce(nullif(trim(payload->>'description'),''),payload->>'tagline'),'Description',2000),
      case when art and coalesce(trim(payload->>'url'),'')='' then '' else tg_private.web_url(payload->>'url') end,payload->>'category',coalesce(payload->>'audience','Everyone'),tg_private.field(case when art then 'Creative work' else coalesce(nullif(payload->>'pricing',''),'See current pricing') end,'Pricing',100),
      case when payload->>'color'=any(array['lilac','blue','rose','lime','peach','mint']) then payload->>'color' else 'lilac' end,
      case when art and coalesce(nullif(trim(payload->>'source'),''),trim(payload->>'url'),'')='' then '' else tg_private.web_url(coalesce(nullif(payload->>'source',''),payload->>'url')) end,facts_value,uid,cid,
      jsonb_build_object('kind',kind_value,'imageDescription',tg_private.field(payload->>'imageDescription','Image description',400,0),'platforms',fields,'pricingModel',coalesce(payload->>'pricingModel',''),'demoUrl',coalesce(payload->>'demoUrl','')));
    return jsonb_build_object('ok',true,'slug',slug_value);
  end if;
  if route='account/delete' then
    if admin then raise exception 'The studio owner cannot delete their account here.'; end if;
    delete from auth.users where id=uid;
    return jsonb_build_object('ok',true);
  end if;
  if route='studio/product' then
    select * into p from public.tg_products where id=payload->>'id';
    if p.id is null then raise exception 'Product not found.'; end if;
    if payload->>'action'='verify' then
      if payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm that you checked the source and facts.'; end if;
      if p.submission_details->>'kind'='art' and (p.cover_id is null or not exists(select 1 from public.tg_covers where id=p.cover_id and kind='upload' and status='ready')) then raise exception 'Artwork needs an uploaded image before approval.'; end if;
      update public.tg_products set status='published',verified_at=now() where id=p.id;
    elsif payload->>'action'='reject' then
      update public.tg_products set status='rejected' where id=p.id;
    elsif payload->>'action'='sponsor' then
      update public.tg_products set sponsored=coalesce((payload->>'enabled')::boolean,false) where id=p.id;
    elsif payload->>'action'='cover' then
      cid := nullif(payload->>'coverId','')::uuid;
      if cid is not null and not exists(select 1 from public.tg_covers where id=cid and (owner_id=uid or owner_id=p.owner_id) and status in ('queued','capturing','ready','failed')) then raise exception 'Choose a cover prepared for this product.'; end if;
      if p.submission_details->>'kind'='art' and (cid is null or not exists(select 1 from public.tg_covers where id=cid and kind='upload' and status='ready')) then raise exception 'Replace artwork with an uploaded image.'; end if;
      update public.tg_products set cover_id=cid where id=p.id;
    else raise exception 'Unknown product action.'; end if;
    insert into public.tg_audit(action,detail) values('product_'||(payload->>'action'),p.id);
    return jsonb_build_object('ok',true);
  end if;
  if route='studio' then
    select coalesce(jsonb_agg(tg_private.product_view(x) order by x.created_at desc),'[]') into items from public.tg_products x;
    analytics := jsonb_build_object(
      'visitors',(select count(distinct visitor) from public.tg_events where kind='visit' and created_at>now()-interval '30 days'),
      'returning',(select count(*) from (select visitor from public.tg_events where kind='visit' and created_at>now()-interval '30 days' group by visitor having count(distinct created_at::date)>1) x),
      'productVisits',(select count(*) from public.tg_events where kind='outbound' and created_at>now()-interval '30 days'),
      'saves',(select count(*) from public.tg_saves),'members',(select count(*) from public.tg_profiles where role='member'),
      'inquiries',(select count(*) from public.tg_inquiries),
      'sources',(select coalesce(jsonb_agg(x),'[]') from (select source,count(distinct visitor) as visitors,count(*) filter(where kind='outbound') as clicks from public.tg_events where created_at>now()-interval '30 days' group by source order by visitors desc) x),
      'products',(select coalesce(jsonb_agg(x),'[]') from (select a.name,count(b.id) as clicks from public.tg_products a left join public.tg_events b on a.id=b.product_id and b.kind='outbound' and b.created_at>now()-interval '30 days' group by a.id order by clicks desc) x));
    return jsonb_build_object('products',items,'jobs','[]'::jsonb,'analytics',analytics,'cloud',true,
      'connection',jsonb_build_object('connected',false,'publishingEnabled',false,'dailyLimit',1,'publicOrigin',null,'loginMethod','Desktop studio','worker',(select value from public.tg_settings where key='worker_heartbeat')),
      'inquiries',(select coalesce(jsonb_agg(x),'[]') from (select * from public.tg_inquiries order by created_at desc limit 100) x),
      'audit',(select coalesce(jsonb_agg(x),'[]') from (select * from public.tg_audit order by created_at desc limit 30) x));
  end if;
  if route='worker/claim' then
    insert into public.tg_settings(key,value) values('worker_heartbeat',now()::text) on conflict(key) do update set value=excluded.value;
    delete from public.tg_rate_limits where reset_at<now()-interval '1 day';
    delete from public.tg_events where created_at<now()-interval '90 days';
    select * into c from public.tg_covers where status='queued' or (status='capturing' and claimed_at<now()-interval '2 minutes') order by created_at for update skip locked limit 1;
    if c.id is null then return jsonb_build_object('cover',null); end if;
    update public.tg_covers set status='capturing',lease=gen_random_uuid(),claimed_at=now() where id=c.id returning * into c;
    return jsonb_build_object('cover',to_jsonb(c));
  end if;
  if route='worker/complete' then
    select * into c from public.tg_covers where id=(payload->>'id')::uuid and lease=(payload->>'lease')::uuid and status='capturing' for update;
    if c.id is null then raise exception 'The capture lease is no longer valid.'; end if;
    if coalesce(payload->>'error','')<>'' then
      update public.tg_covers set status='failed',lease=null,last_error='This website could not be captured. Upload an image instead.' where id=c.id;
    else
      if not exists(select 1 from storage.objects where bucket_id='covers' and name=c.path) then raise exception 'The captured image has not been uploaded.'; end if;
      update public.tg_covers set status='ready',lease=null,last_error=null where id=c.id;
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if route like 'studio/%' then raise exception 'Open the desktop studio to prepare and publish videos.'; end if;
  raise exception 'Not found.';
end $$;
