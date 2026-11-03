import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { brand } from '../lib/brand.mjs';
import { blobPath } from '../lib/mascot.mjs';
import { sitePalette as colors } from '../lib/design-tokens.mjs';

const name = brand.name.replace(/[<>&"']/g, '');
const blob = `<path d="${blobPath}" fill="${colors.lilac}"/>
  <ellipse cx="34" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="61" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="37" cy="42" rx="4" ry="8" fill="#242424"/>
  <ellipse cx="64" cy="42" rx="4" ry="8" fill="#242424"/>
  <path d="M37 63Q50 75 65 61" stroke="#242424" stroke-width="4" fill="none" stroke-linecap="round"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${colors.bg}"/>
  <rect width="1200" height="110" fill="${colors.yellow}"/>
  <text x="65" y="72" font-family="Arial" font-weight="bold" font-size="42" fill="${colors.onYellow}">${name}</text>
  <text x="62" y="300" font-family="Arial" font-size="104" font-weight="bold" letter-spacing="-4" fill="${colors.text}">Fresh from</text>
  <rect x="55" y="325" width="640" height="120" rx="14" fill="${colors.violet}"/>
  <text x="70" y="420" font-family="Arial" font-size="104" font-weight="bold" letter-spacing="-4" fill="${colors.onViolet}">first-timers.</text>
  <text x="65" y="520" font-family="Arial" font-size="30" fill="${colors.muted}">India's newest makers. Go say something nice.</text>
  <g transform="translate(850 210) rotate(-6)">
    <g transform="scale(2.8)">${blob}</g>
  </g>
</svg>`;
await sharp(Buffer.from(svg))
  .png()
  .toFile(fileURLToPath(new URL('../public/social-card.png', import.meta.url)));
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="25" fill="${colors.bg}"/><g transform="translate(5 10) scale(.9)">${blob}</g></svg>\n`;
await writeFile(new URL('../app/icon.svg', import.meta.url), icon);
await sharp(Buffer.from(icon))
  .resize(312, 312)
  .jpeg({ quality: 92 })
  .toFile(fileURLToPath(new URL('../app/icon.jpg', import.meta.url)));
console.log(`Updated ${brand.name} blob icon and social preview.`);
