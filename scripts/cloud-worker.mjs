import sharp from 'sharp';
import { captureWebsite } from '../lib/capture.mjs';
import { cloudSession } from './cloud-session.mjs';
const { client, rpc } = await cloudSession();
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
console.log('Cloud preview worker ready. The public website stays online when this computer is off; previews wait in the queue.');
do {
  try {
    const { cover } = await rpc('worker/claim');
    if (cover) {
      try {
        const { image: bytes } = await captureWebsite(cover.source_url);
        const image = await sharp(bytes, { limitInputPixels: 25_000_000 }).resize(1600, 1200, { fit: 'cover' }).flatten({ background: '#ffffff' }).webp({ quality: 84 }).toBuffer();
        // A previous lease may have uploaded successfully before losing its connection.
        const { error } = await client.storage.from('covers').upload(cover.path, image, { contentType: 'image/webp', upsert: false });
        if (error && String(error.statusCode) !== '409') throw error;
        await rpc('worker/complete', { id: cover.id, lease: cover.lease });
        console.log('Website preview ready:', cover.id);
      } catch {
        await rpc('worker/complete', { id: cover.id, lease: cover.lease, error: 'Capture failed' });
        console.error('Website preview could not be captured:', cover.id);
      }
    }
  } catch (error) { console.error('Worker:', error.message); }
  if (process.argv.includes('--once')) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
} while (!stopping);
await client.auth.signOut();
