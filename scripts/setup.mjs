import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
if (existsSync('.env.local')) {
  console.log('.env.local already exists. Existing credentials were preserved.');
} else {
  const password = randomBytes(18).toString('base64url');
  writeFileSync(
    '.env.local',
    `APP_URL=http://127.0.0.1:3000\nADMIN_EMAIL=owner@example.com\nADMIN_PASSWORD=${password}\nDATA_DIR=./data\nSEED_CATALOG=false\nINSTAGRAM_PUBLISH_ENABLED=false\nINSTAGRAM_GRAPH_VERSION=\nDAILY_POST_LIMIT=0\n`,
    { mode: 0o600 },
  );
  console.log(
    'Created .env.local with unique credentials. Open that file locally to get your studio login.',
  );
}
