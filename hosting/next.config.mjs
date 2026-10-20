import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export default {
  output: 'export',
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: { root },
  env: { NEXT_PUBLIC_DEPLOYMENT_TARGET: 'firebase' },
};
