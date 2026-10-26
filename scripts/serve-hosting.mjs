import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('hosting/out');
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.json': 'application/json',
};
http
  .createServer((req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (name.startsWith('/product/')) name = '/product.html';
      else if (name.startsWith('/profile/')) name = '/profile.html';
      else if (name.startsWith('/go/')) name = '/go.html';
      else if (name === '/') name = '/index.html';
      let file = path.resolve(root, '.' + name);
      if (!file.startsWith(root + path.sep)) throw new Error();
      if ((!existsSync(file) || !statSync(file).isFile()) && !path.extname(file)) file += '.html';
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(400);
      res.end('Invalid request');
    }
  })
  .listen(Number(process.env.PORT) || 4173, '127.0.0.1', () =>
    console.log('Static cloud preview ready'),
  );
