import { spawn } from 'node:child_process';
import path from 'node:path';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3115'],
  {
    env: {
      ...process.env,
      DATA_DIR: path.resolve('data/intro/demo'),
      APP_URL: 'http://127.0.0.1:3115',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      SEED_CATALOG: 'false',
      INSTAGRAM_PUBLISH_ENABLED: 'false',
      INSTAGRAM_ACCESS_TOKEN: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    windowsHide: true,
    stdio: 'inherit',
  },
);
process.on('SIGINT', () => server.kill());
process.on('SIGTERM', () => server.kill());
server.on('exit', (code) => process.exit(code || 0));
