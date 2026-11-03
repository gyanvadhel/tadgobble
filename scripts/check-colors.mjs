// Flags raw colours in stylesheets so every colour goes through the palette variables.
// Skips the :root block (where the variables live), comments, and any line carrying /* art */.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|(?<![-\w])(?:white|black)(?![-\w])/g;

export function findStrayColors(files) {
  const found = [];
  for (const file of files) {
    let inRoot = false,
      inComment = false;
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((text, i) => {
        if (/^\s*:root\s*\{/.test(text)) inRoot = true;
        if (inRoot) {
          if (/\}\s*$/.test(text)) inRoot = false;
          return;
        }
        if (/\/\*\s*art\s*\*\//.test(text)) return;
        let code = '';
        for (let at = 0; at < text.length; ) {
          if (inComment) {
            const end = text.indexOf('*/', at);
            if (end < 0) break;
            inComment = false;
            at = end + 2;
          } else {
            const start = text.indexOf('/*', at);
            code += text.slice(at, start < 0 ? undefined : start);
            if (start < 0) break;
            inComment = true;
            at = start + 2;
          }
        }
        for (const match of code.matchAll(RAW)) found.push({ file, line: i + 1, value: match[0] });
      });
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = findStrayColors(process.argv.slice(2));
  for (const { file, line, value } of found) console.log(`${file}:${line} ${value}`);
  process.exit(found.length ? 1 : 0);
}
