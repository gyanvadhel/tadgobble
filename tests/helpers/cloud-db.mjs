// A throwaway Postgres (PGlite) with Supabase's auth and storage stand-ins and every
// migration applied, plus helpers to call tg_api as a member, a visitor or the service.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export async function openCloudDb() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant select,insert on storage.objects to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort())
    await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));

  async function api(user, route, payload = {}) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
    await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
    try {
      return (await db.query('select public.tg_api($1,$2) as data', [route, payload])).rows[0].data;
    } finally {
      await db.exec('reset role');
    }
  }
  async function addUser(id, name) {
    await db.query(
      'insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,now())',
      [id, name.toLowerCase() + '@example.test', { name }],
    );
  }
  return { db, api, addUser };
}
