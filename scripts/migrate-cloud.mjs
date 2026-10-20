import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { backup } from 'node:sqlite';
import { db, all, get, dataDir } from '../lib/db.mjs';
import { cloudAdmin, check } from './cloud-admin.mjs';

const admin=cloudAdmin();
const backupDir=path.join(dataDir,'backups'); mkdirSync(backupDir,{recursive:true});
await backup(db,path.join(backupDir,`before-cloud-${Date.now()}.sqlite`));
const remote=check(await admin.auth.admin.listUsers({perPage:1000}),'List cloud users').users;
const mapping=new Map();
for(const u of all('SELECT * FROM users')) {
  let existing=remote.find((x)=>x.email?.toLowerCase()===u.email.toLowerCase());
  if (!existing) {
    const isOwner=u.role==='admin' && u.email.toLowerCase()===process.env.ADMIN_EMAIL.toLowerCase();
    existing=check(await admin.auth.admin.createUser({id:u.id,email:u.email,password:isOwner?process.env.ADMIN_PASSWORD:randomBytes(48).toString('base64url'),email_confirm:true,user_metadata:{name:u.name}}),'Migrate user').user;
    if (!isOwner) check(await admin.rpc('tg_import_legacy_password',{user_id:existing.id,password_hash:u.password}),'Prepare legacy login');
  }
  mapping.set(u.id,existing.id);
  check(await admin.from('tg_profiles').update({name:u.name,role:u.role}).eq('id',existing.id),'Set profile');
}
const products=all('SELECT * FROM products');
for(const c of all('SELECT * FROM product_covers WHERE id IN (SELECT cover_id FROM products WHERE cover_id IS NOT NULL)')) {
  const owner=mapping.get(c.owner_id)||null;
  const objectPath=`${owner||'imported'}/${c.id}.webp`;
  const bytes=readFileSync(path.join(dataDir,'covers',c.filename));
  const upload=await admin.storage.from('covers').upload(objectPath,bytes,{contentType:'image/webp',upsert:false});
  if(upload.error && String(upload.error.statusCode)!=='409') check(upload,'Upload cover');
  check(await admin.from('tg_covers').upsert({id:c.id,owner_id:owner,path:objectPath,kind:c.kind,source_url:c.source_url,status:'ready',created_at:c.created_at},{onConflict:'id',ignoreDuplicates:true}),'Migrate cover');
}
const transformed=products.map(p=>({...p,owner_id:mapping.get(p.owner_id)||null,facts:JSON.parse(p.facts),submission_details:JSON.parse(p.submission_details||'{}'),featured:!!p.featured,sponsored:!!p.sponsored,editorial:!!p.editorial}));
check(await admin.from('tg_products').upsert(transformed,{onConflict:'id',ignoreDuplicates:true}),'Migrate products');
for(const [source,target] of [['saves','tg_saves'],['comments','tg_comments']]) {
  const rows=all(`SELECT * FROM ${source}`).map(row=>({...row,user_id:mapping.get(row.user_id)}));
  if(rows.length) check(await admin.from(target).upsert(rows,{ignoreDuplicates:true}),'Migrate member activity');
}
const inquiries=all('SELECT * FROM inquiries');
if(inquiries.length)check(await admin.from('tg_inquiries').upsert(inquiries,{ignoreDuplicates:true}),'Migrate inquiries');
const publicProducts=check(await admin.from('tg_products').select('name,status').eq('status','published'),'Verify catalog');
console.log(JSON.stringify({users:mapping.size,products:products.length,publicProducts:publicProducts.map(p=>p.name),backupCreated:true,localDataPreserved:true}));
