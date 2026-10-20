import { cpSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
if (existsSync('.env.local')) loadEnvFile('.env.local');
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[name]) throw new Error(`${name} must be configured before building.`);
}
cpSync('public', 'hosting/public', { recursive: true });
cpSync('app/icon.svg', 'hosting/app/icon.svg');
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', 'hosting'], {
  stdio: 'inherit', env: { ...process.env, APP_URL: process.env.CLOUD_APP_URL || 'https://tadgobble.web.app', NEXT_PUBLIC_DEPLOYMENT_TARGET: 'firebase' },
});
if (result.status) process.exit(result.status);
if (!existsSync('hosting/out/index.html')) throw new Error('The static export was not created.');
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
if (firebase.hosting.public !== 'hosting/out' || Object.keys(firebase).some((key) => key !== 'hosting'))
  throw new Error('Deployment configuration must contain Hosting only.');
console.log('Static Hosting export ready. No Firebase Functions or App Hosting are deployed.');
