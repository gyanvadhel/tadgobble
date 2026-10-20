import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { chromium } from 'playwright';

const blocked4 = new BlockList();
for (const [address, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  blocked4.addSubnet(address, bits, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
const blocked6 = new BlockList();
for (const [address, bits] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
])
  blocked6.addSubnet(address, bits, 'ipv6');

export function isPublicAddress(address) {
  if (isIP(address) === 4) return !blocked4.check(address, 'ipv4');
  if (isIP(address) === 6)
    return global6.check(address, 'ipv6') && !blocked6.check(address, 'ipv6');
  return false;
}

export function captureUrl(value) {
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new Error('Use a public HTTP or HTTPS website.');
  url.hash = '';
  return url;
}

export async function publicTarget(value, resolve = lookup) {
  const url = captureUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolve(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
    throw new Error('Only public websites can be captured.');
  return { url, ...(addresses.find((a) => a.family === 4) || addresses[0]) };
}

// Every document, redirect, and subresource uses a checked, pinned IP. Chromium
// cannot fall back to its own network: its proxy denies all unhandled requests.
export async function readPublicResource(value, { signal, headers = {}, budget } = {}) {
  const target = await publicTarget(value);
  if (signal?.aborted) throw new Error('Capture cancelled.');
  return new Promise((resolve, reject) => {
    const client = target.url.protocol === 'https:' ? https : http;
    const request = client.get(
      target.url,
      {
        signal,
        agent: false,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [{ address: target.address, family: target.family }]);
          else callback(null, target.address, target.family);
        },
        headers: {
          'user-agent': headers['user-agent'] || 'Mozilla/5.0 TadgobblePreview/1.0',
          accept: headers.accept || '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'identity',
        },
        timeout: 8000,
        maxHeaderSize: 32 * 1024,
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (budget) budget.bytes += chunk.length;
          if (size > 8 * 1024 * 1024 || (budget && budget.bytes > 32 * 1024 * 1024)) {
            request.destroy(new Error('This page is too large to capture.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          const responseHeaders = {};
          for (const [key, val] of Object.entries(response.headers)) {
            if (
              ![
                'connection',
                'transfer-encoding',
                'content-length',
                'set-cookie',
                'content-security-policy-report-only',
                'report-to',
                'nel',
              ].includes(key) &&
              val != null
            )
              responseHeaders[key] = Array.isArray(val) ? val.join(', ') : String(val);
          }
          resolve({
            status: response.statusCode,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on('timeout', () =>
      request.destroy(new Error('This website took too long to respond.')),
    );
    request.on('error', reject);
  });
}

let active = false;
export async function captureWebsite(value) {
  if (active) throw new Error('The camera is busy. Try again in a moment, or upload a cover.');
  active = true;
  let browser;
  const controller = new AbortController();
  const sockets = new Set();
  const blocker = http.createServer((_req, res) => res.writeHead(403).end());
  blocker.on('connect', (_req, socket) => socket.destroy());
  blocker.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  const timer = setTimeout(() => {
    controller.abort();
    void browser?.close();
  }, 25000);
  try {
    const { url } = await publicTarget(value);
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      headless: true,
      timeout: 10000,
      proxy: { server: `http://127.0.0.1:${blocker.address().port}`, bypass: '<-loopback>' },
      args: ['--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: 'light',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());
    const budget = { bytes: 0, requests: 0 };
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (
        ++budget.requests > 120 ||
        request.method() !== 'GET' ||
        ['media', 'eventsource'].includes(request.resourceType())
      )
        return route.abort().catch(() => {});
      try {
        const result = await readPublicResource(request.url(), {
          signal: controller.signal,
          headers: request.headers(),
          budget,
        });
        await route.fulfill(result);
      } catch {
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.on('dialog', (dialog) => void dialog.dismiss());
    context.on('page', (other) => {
      if (other !== page) void other.close();
    });
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response?.ok()) throw new Error('This website did not return a page we can preview.');
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    await page.evaluate(() =>
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]),
    );
    await page.waitForTimeout(600);
    const image = await page.screenshot({ type: 'png', animations: 'disabled', timeout: 4000 });
    return { image, url: page.url() };
  } finally {
    clearTimeout(timer);
    controller.abort();
    await browser?.close().catch(() => {});
    for (const socket of sockets) socket.destroy();
    if (blocker.listening) await new Promise((resolve) => blocker.close(resolve));
    active = false;
  }
}
