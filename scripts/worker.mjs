import { tick } from '../lib/worker.mjs';
import { brand } from '../lib/brand.mjs';
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
console.log(
  `${brand.name} worker running. Checks every 20 seconds; only approved queued posts can publish.`,
);
while (!stopping) {
  try {
    const r = await tick();
    if (r.action !== 'idle') console.log(new Date().toISOString(), JSON.stringify(r));
  } catch (e) {
    console.error('Worker error:', e.message);
  }
  await new Promise((resolve) => setTimeout(resolve, 20_000));
}
