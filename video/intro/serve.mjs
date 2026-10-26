import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('.');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};
http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const route = pathname === '/' ? '/video/intro/editor.html' : pathname;
    if (
      !['/video/intro/', '/data/intro/', '/public/fonts/', '/deliverables/'].some((p) =>
        route.startsWith(p),
      ) ||
      /session\.json|\/demo\//.test(route)
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const bytes = readFileSync(file),
      range = req.headers.range;
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    if (range) {
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = Number(a),
        end = b ? Number(b) : bytes.length - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      res.end(bytes.subarray(start, end + 1));
    } else {
      res.writeHead(200, { 'Content-Length': bytes.length, 'Cache-Control': 'no-cache' });
      res.end(bytes);
    }
  })
  .listen(4188, '127.0.0.1', () => console.log('Intro editing workspace: http://127.0.0.1:4188'));
