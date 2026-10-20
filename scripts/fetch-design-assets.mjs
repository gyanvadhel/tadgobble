import { mkdir, writeFile } from 'node:fs/promises';

const folder = new URL('../public/fonts/', import.meta.url);
await mkdir(folder, { recursive: true });
const url =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap';
const response = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
});
if (!response.ok) throw new Error(`Font CSS: ${response.status}`);
const source = await response.text();
const latin = [...source.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map((m) => m[1]);
if (!latin.length) throw new Error('No Latin font definitions returned.');
const downloaded = new Map();
let stylesheet = '';
for (let block of latin) {
  const remote = block.match(/url\(([^)]+)\)/)?.[1];
  if (!remote) continue;
  let filename = downloaded.get(remote);
  if (!filename) {
    filename = `font-${downloaded.size + 1}.woff2`;
    const asset = await fetch(remote);
    if (!asset.ok) throw new Error(`Font download: ${asset.status}`);
    await writeFile(new URL(filename, folder), Buffer.from(await asset.arrayBuffer()));
    downloaded.set(remote, filename);
  }
  stylesheet += block.replace(remote, `/fonts/${filename}`) + '\n';
}
await writeFile(new URL('fonts.css', folder), stylesheet);
for (const name of ['bricolagegrotesque', 'dmsans', 'instrumentserif']) {
  const license = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${name}/OFL.txt`,
  );
  if (!license.ok) throw new Error(`License download: ${name}`);
  await writeFile(new URL(`${name}-OFL.txt`, folder), await license.text());
}
console.log(`Saved ${downloaded.size} font assets and their licenses locally.`);
