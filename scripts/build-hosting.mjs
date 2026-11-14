import { cpSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { llmsText, loadCatalog, sitemapXml, supabaseCaller } from '../lib/public-catalog.mjs';
if (existsSync('.env.local')) loadEnvFile('.env.local');
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[name]) throw new Error(`${name} must be configured before building.`);
}
cpSync('public', 'hosting/public', { recursive: true });
cpSync('app/icon.svg', 'hosting/app/icon.svg');
// Read the public catalog now so every page ships with text crawlers and AI readers can see.
const site = process.env.CLOUD_APP_URL || 'https://tadgobble.in';
let catalog = { products: [], profiles: [] };
try {
  catalog = await loadCatalog(
    supabaseCaller(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
  console.log(`Catalog: ${catalog.products.length} works, ${catalog.profiles.length} makers.`);
} catch (error) {
  console.warn(`Catalog could not be read (${error.message}); pages ship without listed work.`);
}
writeFileSync('hosting/catalog.json', JSON.stringify(catalog));
writeFileSync('hosting/public/llms.txt', llmsText(catalog, site));
writeFileSync('hosting/public/sitemap.xml', sitemapXml(catalog, site, new Date().toISOString().slice(0, 10)));
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', 'hosting'], {
  stdio: 'inherit', env: { ...process.env, APP_URL: site, NEXT_PUBLIC_DEPLOYMENT_TARGET: 'firebase' },
});
if (result.status) process.exit(result.status);
if (!existsSync('hosting/out/index.html')) throw new Error('The static export was not created.');
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
if (firebase.hosting.public !== 'hosting/out' || Object.keys(firebase).some((key) => key !== 'hosting'))
  throw new Error('Deployment configuration must contain Hosting only.');
console.log('Static Hosting export ready. No Firebase Functions or App Hosting are deployed.');
