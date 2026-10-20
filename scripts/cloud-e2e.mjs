import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { cloudAdmin, check } from './cloud-admin.mjs';
const origin=process.env.CLOUD_TEST_URL||'http://127.0.0.1:4173';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin=cloudAdmin(), users=[], covers=[], products=[];
const name=`Cloud QA ${Date.now()}`, email=`launch-qa-${Date.now()}@example.com`, password=randomBytes(24).toString('base64url');
const evidence='test-results/cloud-launch';mkdirSync(evidence,{recursive:true});
const result=[];
let browser;
const anon=createClient(url,key,{auth:{persistSession:false}});
async function rpc(client,route,payload={}) {return check(await client.rpc('tg_api',{route,payload}),route);}
try {
  const user=check(await admin.auth.admin.createUser({email,password:randomBytes(24).toString('base64url'),email_confirm:true,user_metadata:{name,role:'admin'}}),'Create QA account').user;
  users.push(user.id);
  const salt=randomBytes(16).toString('hex');
  check(await admin.rpc('tg_import_legacy_password',{user_id:user.id,password_hash:`${salt}:${scryptSync(password,salt,64).toString('hex')}`}));
  const bad=await anon.functions.invoke('legacy-login',{body:{email,password:'not-the-right-password'}});
  assert.ok(bad.error);
  const migrated=check(await anon.functions.invoke('legacy-login',{body:{email,password}}),'Legacy login');
  assert.equal(migrated.ok,true);
  assert.ok((await anon.functions.invoke('legacy-login',{body:{email,password}})).error,'legacy hash must be removed after migration');
  const maker=createClient(url,key,{auth:{persistSession:false}});
  check(await maker.auth.signInWithPassword({email,password}));
  assert.equal((await rpc(maker,'bootstrap')).user.role,'member');
  assert.ok((await maker.rpc('tg_api',{route:'studio'})).error);
  assert.ok((await maker.from('tg_profiles').select('*')).error);
  result.push('Legacy password upgrades once; member metadata cannot grant admin access.');
  const initial=await rpc(anon,'bootstrap');
  assert.deepEqual(initial.products.map(p=>p.name),['Argus']);
  const argus=initial.products[0];
  const signed=check(await anon.storage.from('covers').createSignedUrl(argus.cover.path,60));
  assert.equal((await fetch(signed.signedUrl)).status,200);
  result.push('Argus is the only public listing and its actual website preview loads.');

  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/rest/v1/rpc/tg_api',async route=>{
    if(route.request().postDataJSON()?.route==='events') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    return route.continue();
  });
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:/GOOD FINDS/i}).waitFor();
  await page.screenshot({path:`${evidence}/landing-desktop.png`,fullPage:false});
  await page.goto(origin+'/discover',{waitUntil:'networkidle'});
  await page.locator('.catalog-product-title').filter({hasText:'Argus'}).waitFor();
  await page.getByRole('button',{name:/Sign in/}).first().click();
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('dialog').getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Open account'}).waitFor();
  await page.getByRole('button',{name:'Save Argus',exact:true}).click();
  await page.getByRole('button',{name:'Unsave Argus',exact:true}).waitFor();
  await page.getByRole('button',{name:'Share your product',exact:true}).first().click();
  await page.getByLabel('Product name',{exact:true}).fill(name);
  await page.getByLabel('Product website',{exact:true}).fill('https://example.com');
  await page.getByLabel('One sentence that says it all').fill('Testing the real cloud submission flow.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('group',{name:'Product category',exact:true}).getByRole('button',{name:'Developer tools',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const upload=await sharp({create:{width:640,height:480,channels:3,background:'#c5b5f5'}}).png().toBuffer();
  await page.getByLabel('Upload cover image').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:upload});
  await page.getByText('Your uploaded cover',{exact:true}).waitFor({timeout:20000});
  await page.locator('.submission-modal').screenshot({path:`${evidence}/submission-cover.png`});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('checkbox',{name:/maker or have permission/}).check();
  await page.getByRole('button',{name:'Send for review',exact:true}).click();
  await page.getByText('In the review queue',{exact:true}).waitFor();
  const submitted=check(await admin.from('tg_products').select('*').eq('name',name).single()); products.push(submitted.id);
  const owned=check(await admin.from('tg_covers').select('*').eq('owner_id',user.id));covers.push(...owned);
  assert.equal(submitted.status,'pending');
  assert.equal((await rpc(anon,'bootstrap')).products.length,1);
  const cover=owned.find(c=>c.id===submitted.cover_id);
  assert.equal(cover.kind,'upload');
  assert.ok((await anon.storage.from('covers').createSignedUrl(cover.path,60)).error);
  await page.screenshot({path:`${evidence}/submission-success.png`});
  result.push('Browser sign-in, saving Argus, creative submission and uploaded private cover work.');

  const owner=createClient(url,key,{auth:{persistSession:false}});
  check(await owner.auth.signInWithPassword({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}));
  await rpc(owner,'studio/product',{id:submitted.id,action:'verify',confirmed:true});
  assert.equal((await rpc(anon,'products/'+submitted.slug)).product.cover.id,submitted.cover_id);
  const publicCover=check(await anon.storage.from('covers').createSignedUrl(cover.path,60));
  assert.equal((await fetch(publicCover.signedUrl)).status,200);
  await page.goto(origin+'/product/'+submitted.slug,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name,exact:true}).waitFor();
  assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.some(i=>i.complete&&i.naturalWidth>0)));
  await rpc(owner,'studio/product',{id:submitted.id,action:'reject'});
  assert.ok((await anon.storage.from('covers').createSignedUrl(cover.path,60)).error);
  result.push('Admin approval exposes the listing and cover; rejection removes public access.');

  const capture=owned.find(c=>c.kind==='capture');
  if(capture){
    for(let i=0;i<20;i++){
      const current=check(await admin.from('tg_covers').select('status').eq('id',capture.id).single());
      if(current.status==='ready')break;
      if(current.status==='failed')throw new Error('Real capture worker failed.');
      await new Promise(r=>setTimeout(r,1000));
    }
    assert.equal(check(await admin.from('tg_covers').select('status').eq('id',capture.id).single()).status,'ready');
    result.push('Desktop worker captured a real website and uploaded it into private cloud storage.');
  }
  const adminPage=await context.newPage();
  await adminPage.goto(origin+'/studio?tab=products&status=pending',{waitUntil:'networkidle'});
  await adminPage.getByText('This account doesn’t have studio access.').waitFor();
  // A new context verifies owner login without changing the member session.
  const ownerContext=await browser.newContext({viewport:{width:1440,height:1000}});
  const ownerPage=await ownerContext.newPage();
  await ownerPage.goto(origin+'/studio?tab=products&status=pending',{waitUntil:'networkidle'});
  await ownerPage.getByRole('button',{name:'Sign in to the studio'}).click();
  await ownerPage.getByLabel('Email',{exact:true}).fill(process.env.ADMIN_EMAIL);
  await ownerPage.getByLabel('Password',{exact:true}).fill(process.env.ADMIN_PASSWORD);
  await ownerPage.getByRole('dialog').getByRole('button',{name:'Sign in',exact:true}).click();
  await ownerPage.getByRole('heading',{name:'Products',exact:true}).waitFor();
  await ownerPage.screenshot({path:`${evidence}/admin-review.png`});
  result.push('The deployed-style admin route admits the owner and blocks members.');
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    await page.goto(origin+'/discover',{waitUntil:'networkidle'});
    await page.locator('.catalog-product-title').filter({hasText:'Argus'}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${evidence}/discover-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  result.push('Desktop, 390px and 320px pages load without JavaScript errors or horizontal overflow.');
  await owner.auth.signOut(); await maker.auth.signOut();
  writeFileSync(`${evidence}/report.json`,JSON.stringify({passed:result},null,2));
  console.log(JSON.stringify({passed:result,evidence},null,2));
} catch(error) {
  if(browser) {
    const page=browser.contexts()[0]?.pages()[0];
    if(page) { await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{}); writeFileSync(`${evidence}/failure.txt`,await page.locator('body').innerText().catch(()=>'')); }
  }
  throw error;
} finally {
  if(browser)await browser.close();
  // Remove only this run's QA data; imported user records and listings are untouched.
  if(users.length){
    const rows=check(await admin.from('tg_products').select('id').in('owner_id',users));
    if(rows.length)check(await admin.from('tg_products').delete().in('id',rows.map(r=>r.id)));
    const rowsC=check(await admin.from('tg_covers').select('id,path').in('owner_id',users));
    if(rowsC.length){check(await admin.storage.from('covers').remove(rowsC.map(c=>c.path)));check(await admin.from('tg_covers').delete().in('id',rowsC.map(c=>c.id)));}
    for(const id of users)check(await admin.auth.admin.deleteUser(id));
  }
}
