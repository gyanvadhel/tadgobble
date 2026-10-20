import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
let db;
const owner='11111111-1111-4111-8111-111111111111', maker='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333';
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant select,insert on storage.objects to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/202610210001_tadgobble.sql','utf8'));
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6),($7,$8,$9)',[owner,'owner@example.test',{name:'Owner'},maker,'maker@example.test',{name:'Maker',role:'admin'},other,'other@example.test',{name:'Other'}]);
  await db.query("update tg_profiles set role='admin' where id=$1",[owner]);
});
after(async () => db?.close());
async function api(user,route,payload={}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
  await db.exec(`set role ${user?'authenticated':'anon'}`);
  try { return (await db.query('select public.tg_api($1,$2) as data',[route,payload])).rows[0].data; }
  finally { await db.exec('reset role'); }
}
const product = {name:'Cloud check',tagline:'A real test discovery',description:'Useful product details.',url:'https://example.com',category:'Developer tools',audience:'Everyone',pricing:'Free',color:'lilac',ownership:true,platforms:['Web app'],facts:'A useful thing'};
let pending,cover;
test('member metadata cannot grant studio access; raw tables are closed',async()=>{
  assert.equal((await api(maker,'bootstrap')).user.role,'member');
  await assert.rejects(()=>api(maker,'studio'),/Studio access/);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select * from public.tg_profiles'),/permission denied/);
  await db.exec('reset role');
});
test('pending submission stays private and only admin can approve it',async()=>{
  pending=await api(maker,'submit',product);
  assert.equal((await api(null,'bootstrap')).products.length,0);
  await assert.rejects(()=>api(null,'products/'+pending.slug),/not found/);
  const {products}=await api(owner,'studio');
  pending.id=products[0].id;
  await assert.rejects(()=>api(maker,'studio/product',{id:pending.id,action:'verify',confirmed:true}),/Studio access/);
  await assert.rejects(()=>api(owner,'studio/product',{id:pending.id,action:'verify'}),/Confirm/);
  await api(owner,'studio/product',{id:pending.id,action:'verify',confirmed:true});
  assert.equal((await api(null,'bootstrap')).products.length,1);
});
test('saves and comments enforce account ownership',async()=>{
  assert.equal((await api(maker,'save',{productId:pending.id})).saved,true);
  assert.equal((await api(maker,'bootstrap')).products[0].saved,true);
  assert.equal((await api(other,'bootstrap')).products[0].saved,false);
  await api(maker,'comment',{productId:pending.id,body:'This is useful.'});
  const {comments}=await api(null,'products/'+pending.slug);
  await assert.rejects(()=>api(other,'comment/delete',{id:comments[0].id}),/cannot remove/);
  await api(maker,'comment/delete',{id:comments[0].id});
  assert.equal((await api(null,'products/'+pending.slug)).comments.length,0);
});
test('covers remain private until attached to an approved listing',async()=>{
  ({cover}=await api(maker,'covers/prepare'));
  await db.query("insert into storage.objects(bucket_id,name) values('covers',$1)",[cover.path]);
  await api(maker,'covers/complete',{id:cover.id});
  await assert.rejects(()=>api(other,'covers/status',{id:cover.id}),/not found/);
  await api(null,'health');
  assert.equal((await db.query('select tg_cover_read($1) as readable',[cover.path])).rows[0].readable,false);
  await assert.rejects(()=>api(other,'submit',{...product,coverId:cover.id}),/belonging/);
  const x=await api(maker,'submit',{...product,coverId:cover.id});
  const p=(await api(owner,'studio')).products.find(p=>p.slug===x.slug);
  await api(owner,'studio/product',{id:p.id,action:'verify',confirmed:true});
  await api(null,'health');
  assert.equal((await db.query('select tg_cover_read($1) as readable',[cover.path])).rows[0].readable,true);
  await api(owner,'studio/product',{id:p.id,action:'reject'});
  await api(null,'health');
  assert.equal((await db.query('select tg_cover_read($1) as readable',[cover.path])).rows[0].readable,false);
});
test('worker claims are exclusive and require an admin and matching lease',async()=>{
  await api(maker,'covers/capture',{url:'https://example.com'});
  await assert.rejects(()=>api(maker,'worker/claim'),/Studio access/);
  const {cover:c}=await api(owner,'worker/claim');
  assert.ok(c.lease);
  assert.equal((await api(owner,'worker/claim')).cover,null);
  await assert.rejects(()=>api(owner,'worker/complete',{id:c.id,lease:maker}),/lease/);
  await api(owner,'worker/complete',{id:c.id,lease:c.lease,error:'failed'});
  assert.equal((await api(maker,'covers/status',{id:c.id})).cover.status,'failed');
});
test('invalid URLs, categories and forged publishing fields are rejected or ignored',async()=>{
  await assert.rejects(()=>api(maker,'submit',{...product,url:'javascript:alert(1)'}),/http/);
  await assert.rejects(()=>api(maker,'submit',{...product,category:'made up'}),/category/);
  const x=await api(other,'submit',{...product,status:'published',featured:true,sponsored:true});
  const p=(await api(owner,'studio')).products.find(p=>p.slug===x.slug);
  assert.equal(p.status,'pending'); assert.equal(p.featured,false); assert.equal(p.sponsored,false);
});
test('account deletion preserves product listings and removes personal activity',async()=>{
  await api(maker,'account/delete');
  await assert.rejects(()=>api(maker,'save',{productId:pending.id}),/Sign in/);
  const p=(await api(null,'products/'+pending.slug)).product;
  assert.equal(p.owner_name,null); assert.equal(p.save_count,0);
  await assert.rejects(()=>api(owner,'account/delete'),/studio owner/);
});
