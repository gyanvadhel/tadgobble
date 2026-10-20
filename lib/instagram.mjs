import { connectionStatus } from './workflow.mjs';
export function instagramClient(fetcher = fetch) {
  const version = process.env.INSTAGRAM_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/.test(version || ''))
    throw new Error('Set INSTAGRAM_GRAPH_VERSION to a supported version from your Meta dashboard.');
  const root = `https://graph.facebook.com/${version}`;
  async function call(endpoint, method = 'GET', data = {}) {
    const url = new URL(`${root}/${endpoint}`);
    const options = {
      method,
      headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(30_000),
    };
    if (method === 'GET') for (const [k, v] of Object.entries(data)) url.searchParams.set(k, v);
    else {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = new URLSearchParams(data);
    }
    const response = await fetcher(url, options);
    const body = await response.json();
    if (!response.ok || body.error)
      throw new Error(
        `Instagram rejected the request (HTTP ${response.status}, code ${body.error?.code || 'unknown'}). Check the account, permissions, token, and video requirements.`,
      );
    return body;
  }
  return {
    create: async (job) => {
      const origin = process.env.PUBLIC_MEDIA_ORIGIN?.replace(/\/$/, '');
      if (!connectionStatus().publishingEnabled)
        throw new Error('Instagram publishing is not enabled.');
      const r = await call(`${process.env.INSTAGRAM_ACCOUNT_ID}/media`, 'POST', {
        media_type: 'REELS',
        video_url: `${origin}/media/${job.output_file}`,
        caption: job.caption,
        share_to_feed: 'true',
      });
      if (!r.id) throw new Error('Instagram did not return a media container.');
      return r.id;
    },
    status: async (containerId) =>
      (await call(containerId, 'GET', { fields: 'status_code' })).status_code,
    publish: async (containerId) => {
      const r = await call(`${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`, 'POST', {
        creation_id: containerId,
      });
      if (!r.id) throw new Error('Instagram did not confirm a published media ID.');
      return r.id;
    },
    permalink: async (mediaId) => (await call(mediaId, 'GET', { fields: 'permalink' })).permalink,
  };
}
