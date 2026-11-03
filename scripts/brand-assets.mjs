import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { brand } from '../lib/brand.mjs';
import { blobPath } from '../lib/mascot.mjs';
import { sitePalette as colors } from '../lib/design-tokens.mjs';

const name = brand.name.replace(/[<>&"']/g, '');
const blob = `<path d="${blobPath}" fill="${colors.acid}"/>
  <ellipse cx="34" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="61" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="37" cy="42" rx="4" ry="8" fill="#242424"/>
  <ellipse cx="64" cy="42" rx="4" ry="8" fill="#242424"/>
  <path d="M37 63Q50 75 65 61" stroke="#242424" stroke-width="4" fill="none" stroke-linecap="round"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${colors.cream}"/>
  <text x="65" y="85" font-family="Arial" font-weight="bold" font-size="38" fill="${colors.ink}">${name}</text>
  <text x="57" y="270" font-family="Arial" font-size="160" font-weight="bold" letter-spacing="-8" fill="${colors.ink}">GOOD FINDS.</text>
  <text x="65" y="380" font-family="Arial" font-weight="bold" font-size="40" letter-spacing="-1" fill="${colors.ink}">Your next “wait, this exists?”</text>
  <text x="65" y="445" font-family="Arial" font-size="23" fill="${colors.ink}">Useful apps. Oddly brilliant tools.</text>
  <text x="65" y="478" font-family="Arial" font-size="23" fill="${colors.ink}">A new obsession, probably.</text>
  <g transform="translate(870 325) rotate(6)">
    <circle cx="95" cy="90" r="112" fill="${colors.purple}"/>
    <g transform="translate(-5 0) scale(2)">${blob}</g>
  </g>
  <rect y="584" width="1200" height="46" fill="${colors.ink}"/>
  <text x="65" y="613" font-family="Arial" font-size="14" letter-spacing="3" fill="${colors.cream}">OPEN ANOTHER TAB. FIND SOMETHING GOOD.</text>
</svg>`;
await sharp(Buffer.from(svg))
  .png()
  .toFile(fileURLToPath(new URL('../public/social-card.png', import.meta.url)));
await writeFile(
  new URL('../app/icon.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="25" fill="${colors.ink}"/><g transform="translate(5 10) scale(.9)">${blob}</g></svg>\n`,
);
console.log(`Updated ${brand.name} blob icon and social preview.`);
