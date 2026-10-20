import { writeFileSync } from 'node:fs';
import { brand } from '../lib/brand.mjs';
const results = [];
for (const name of [brand.slug]) {
  const endpoint = `https://rdap.verisign.com/com/v1/domain/${name}.com`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
    results.push({
      domain: `${name}.com`,
      source: endpoint,
      status: res.status,
      finding:
        res.status === 404
          ? 'No domain registration record returned; purchase availability not confirmed.'
          : res.ok
            ? 'Domain has a registration record.'
            : 'Inconclusive.',
    });
  } catch (e) {
    results.push({
      domain: `${name}.com`,
      source: endpoint,
      finding: `Inconclusive: ${e.message}`,
    });
  }
}
const report = {
  checkedAt: new Date().toISOString(),
  domains: results,
  socialHandles: {
    instagram: 'Exact username availability unconfirmed. No handle claimed.',
    tiktok: 'Exact username availability unconfirmed. No handle claimed.',
    youtube: 'Exact username availability unconfirmed. No handle claimed.',
    x: 'Exact username availability unconfirmed. No handle claimed.',
  },
  notes:
    'This script checks the selected name in the domain registry only. Registry responses do not prove purchase or username availability. No domain or account was registered.',
};
writeFileSync('docs/brand-checks.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
