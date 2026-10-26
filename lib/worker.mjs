import { get, run, now, audit, parseProduct, transaction } from './db.mjs';
import { connectionStatus, dailyPostLimit } from './workflow.mjs';
import { renderReel } from './render.mjs';
import { instagramClient } from './instagram.mjs';

export async function tick({ render = renderReel, client, forceConnection = false } = {}) {
  run('INSERT OR REPLACE INTO settings VALUES (?,?)', 'worker_heartbeat', now());
  run('DELETE FROM events WHERE created_at<?', new Date(Date.now() - 90 * 86400_000).toISOString());
  run('DELETE FROM sessions WHERE expires_at<?', now());
  run('DELETE FROM rate_limits WHERE reset_at<?', Date.now() - 86400_000);
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  run(
    "UPDATE jobs SET status='needs_attention',last_error='Worker stopped during publication. Check Instagram before resolving this item.',updated_at=? WHERE status='publishing' AND updated_at<?",
    now(),
    stale,
  );
  run(
    "UPDATE jobs SET status='failed',last_error='Rendering was interrupted. You can render this draft again.',updated_at=? WHERE status='rendering' AND updated_at<?",
    now(),
    stale,
  );
  const rendering = transaction(() => {
    const j = get("SELECT * FROM jobs WHERE status='render_pending' ORDER BY created_at LIMIT 1");
    if (j) run("UPDATE jobs SET status='rendering',updated_at=? WHERE id=?", now(), j.id);
    return j;
  });
  if (rendering) {
    try {
      const p = parseProduct(get('SELECT * FROM products WHERE id=?', rendering.product_id));
      const file = await render(rendering, p);
      run(
        "UPDATE jobs SET status='rendered',output_file=?,last_error=NULL,updated_at=? WHERE id=?",
        file,
        now(),
        rendering.id,
      );
      audit(rendering.id, 'rendered', file);
      return { action: 'rendered', id: rendering.id };
    } catch (e) {
      run(
        "UPDATE jobs SET status='failed',last_error=?,updated_at=? WHERE id=?",
        e.message,
        now(),
        rendering.id,
      );
      audit(rendering.id, 'render_failed', e.message);
      return { action: 'failed', error: e.message };
    }
  }
  if (!forceConnection && !connectionStatus().publishingEnabled)
    return { action: 'idle', reason: 'Instagram publishing is not connected and enabled.' };
  const job = transaction(() => {
    const today = now().slice(0, 10);
    const cap = dailyPostLimit();
    if (
      cap !== null &&
      get(
        "SELECT count(*) as n FROM jobs WHERE status IN ('publishing','needs_attention') OR (status='published' AND substr(published_at,1,10)=?)",
        today,
      ).n >= cap
    )
      return null;
    const j = get(
      "SELECT * FROM jobs WHERE status='queued' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 1",
      now(),
    );
    if (j)
      run(
        "UPDATE jobs SET status='publishing',attempts=attempts+1,updated_at=? WHERE id=?",
        now(),
        j.id,
      );
    return j;
  });
  if (!job) return { action: 'idle', reason: 'No approved posts are due.' };
  let publishingAttempted = false;
  try {
    const ig = client || instagramClient();
    let container = job.container_id;
    if (!container) {
      container = await ig.create(job);
      run('UPDATE jobs SET container_id=?,updated_at=? WHERE id=?', container, now(), job.id);
    }
    const status = await ig.status(container);
    if (status === 'IN_PROGRESS') {
      if (job.attempts >= 29)
        throw new Error(
          'Instagram has not finished processing after 30 polls. Inspect the container before scheduling again.',
        );
      run(
        "UPDATE jobs SET status='queued',scheduled_at=?,updated_at=? WHERE id=?",
        new Date(Date.now() + 60_000).toISOString(),
        now(),
        job.id,
      );
      return { action: 'processing', id: job.id };
    }
    if (status !== 'FINISHED')
      throw new Error(`Instagram container status: ${status}. Review the video before retrying.`);
    publishingAttempted = true;
    audit(job.id, 'publish_requested', container);
    const mediaId = await ig.publish(container);
    run(
      "UPDATE jobs SET status='published',media_id=?,published_at=?,updated_at=?,last_error=NULL WHERE id=?",
      mediaId,
      now(),
      now(),
      job.id,
    );
    audit(job.id, 'published', mediaId);
    try {
      const link = await ig.permalink(mediaId);
      if (link) run('UPDATE jobs SET permalink=? WHERE id=?', link, job.id);
    } catch {
      /* The successful publish must not be retried for a missing permalink. */
    }
    return { action: 'published', id: job.id };
  } catch (e) {
    const status = publishingAttempted ? 'needs_attention' : 'failed';
    run(
      'UPDATE jobs SET status=?,last_error=?,updated_at=? WHERE id=?',
      status,
      publishingAttempted
        ? 'Publication result is uncertain. Check Instagram before taking any further action.'
        : e.message,
      now(),
      job.id,
    );
    audit(job.id, status, e.message);
    return { action: status, id: job.id, error: e.message };
  }
}
