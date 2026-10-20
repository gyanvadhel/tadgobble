import { all, get, run, id, now, audit, parseProduct, transaction } from './db.mjs';
import { AppError, textField } from './auth.mjs';
import { brand } from './brand.mjs';

export function createDraft(productId) {
  const p = parseProduct(get('SELECT * FROM products WHERE id=?', productId));
  if (!p) throw new AppError('Product not found.', 404);
  if (p.status !== 'published')
    throw new AppError('Publish the product listing before creating its content.');
  const active = get(
    "SELECT id FROM jobs WHERE product_id=? AND status NOT IN ('published','archived')",
    productId,
  );
  if (active) throw new AppError('This product already has an active content draft.', 409);
  const jobId = id();
  const capabilities = p.facts.length ? p.facts : [p.tagline];
  const script = `Your next internet side quest: ${p.name}. ${p.tagline}\n\nHere is what to explore: ${capabilities.join('. ')}.\n\nFind ${p.name} on ${brand.name}. Visit the maker for current pricing and availability.`;
  const caption = `${p.sponsored ? 'Paid feature.\n\n' : ''}${p.name}: ${p.tagline}\n\n${p.description}\n\nFind it in our Seen on Instagram collection — link in bio.\n\nSource: ${p.source}\n#ProductDiscovery #IndependentProducts`;
  const storyboard = [
    {
      time: '0–3s',
      label: 'Show the result',
      direction: `Open with an actual result from ${p.name}. Overlay: ${p.tagline}`,
    },
    {
      time: '3–22s',
      label: 'Show the product',
      direction: `Record the real interface. Demonstrate one of these sourced capabilities: ${capabilities.join('; ')}.`,
    },
    {
      time: '22–30s',
      label: 'Invite exploration',
      direction: `Show ${p.name} and “On the ${brand.name} menu · link in bio”. Include a paid-feature disclosure when sponsored.`,
    },
  ];
  run(
    'INSERT INTO jobs (id,product_id,script,caption,storyboard,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    jobId,
    productId,
    script,
    caption,
    JSON.stringify(storyboard),
    now(),
    now(),
  );
  audit(jobId, 'draft_created', 'Drafted from the product’s recorded source facts.');
  return get('SELECT * FROM jobs WHERE id=?', jobId);
}
export function jobById(jobId) {
  const j = get('SELECT * FROM jobs WHERE id=?', jobId);
  if (!j) throw new AppError('Content item not found.', 404);
  return j;
}
export function updateDraft(jobId, data) {
  const j = jobById(jobId);
  if (!['draft', 'rendered', 'approved', 'failed'].includes(j.status))
    throw new AppError('Unschedule this item before editing it.', 409);
  const script = textField(data.script, 'Script', 5000);
  const caption = textField(data.caption, 'Caption', 2200);
  run(
    'UPDATE jobs SET script=?,caption=?,status=?,approved_at=NULL,container_id=NULL,last_error=NULL,updated_at=? WHERE id=?',
    script,
    caption,
    j.output_file ? 'rendered' : 'draft',
    now(),
    jobId,
  );
  audit(jobId, 'draft_edited', 'Approval cleared after the edit.');
}
export function requestRender(jobId) {
  const j = jobById(jobId);
  if (!['draft', 'rendered', 'approved', 'failed'].includes(j.status))
    throw new AppError('This item cannot be rendered in its current state.', 409);
  if (!j.source_file || !j.rights_confirmed)
    throw new AppError('Upload a demo clip you have permission to publish.');
  run(
    "UPDATE jobs SET status='render_pending',approved_at=NULL,container_id=NULL,scheduled_at=NULL,last_error=NULL,updated_at=? WHERE id=?",
    now(),
    jobId,
  );
  audit(jobId, 'render_requested');
}
export function approveJob(jobId) {
  const j = jobById(jobId);
  const p = get('SELECT * FROM products WHERE id=?', j.product_id);
  if (j.status !== 'rendered' || !j.output_file)
    throw new AppError('Render and review the video before approval.');
  if (p.status !== 'published' || !p.verified_at)
    throw new AppError('Verify the product facts and source in the submissions panel first.');
  if (!j.rights_confirmed) throw new AppError('Confirm permission to publish the demo.');
  if (p.sponsored && !j.caption.startsWith('Paid feature.'))
    throw new AppError('Sponsored content must start with “Paid feature.”');
  run(
    "UPDATE jobs SET status='approved',approved_at=?,updated_at=? WHERE id=?",
    now(),
    now(),
    jobId,
  );
  audit(
    jobId,
    'approved',
    'Operator reviewed the source facts, rights, caption, and rendered video.',
  );
}
export function scheduleJob(jobId, time) {
  const t = new Date(time);
  if (Number.isNaN(t.getTime()) || t.getTime() < Date.now() - 60_000)
    throw new AppError('Choose a future publishing time.');
  transaction(() => {
    const j = jobById(jobId);
    if (j.status !== 'approved') throw new AppError('Only approved content can enter the queue.');
    const day = t.toISOString().slice(0, 10);
    const cap = Math.max(1, Math.min(20, Number(process.env.DAILY_POST_LIMIT) || 1));
    const n = get(
      "SELECT count(*) as n FROM jobs WHERE status IN ('queued','publishing','published','needs_attention') AND substr(scheduled_at,1,10)=?",
      day,
    ).n;
    if (n >= cap)
      throw new AppError(`The limit of ${cap} post(s) for this UTC date is already reserved.`);
    run(
      "UPDATE jobs SET status='queued',scheduled_at=?,updated_at=? WHERE id=?",
      t.toISOString(),
      now(),
      jobId,
    );
    audit(jobId, 'scheduled', t.toISOString());
  });
}
export function unscheduleJob(jobId) {
  const j = jobById(jobId);
  if (j.status !== 'queued') throw new AppError('Only queued content can be unscheduled.');
  run(
    "UPDATE jobs SET status='approved',scheduled_at=NULL,container_id=NULL,updated_at=? WHERE id=?",
    now(),
    jobId,
  );
  audit(jobId, 'unscheduled');
}
export function connectionStatus() {
  const connected = !!(
    process.env.INSTAGRAM_ACCOUNT_ID &&
    process.env.INSTAGRAM_ACCESS_TOKEN &&
    process.env.INSTAGRAM_GRAPH_VERSION &&
    process.env.PUBLIC_MEDIA_ORIGIN?.startsWith('https:')
  );
  return {
    connected,
    publishingEnabled: connected && process.env.INSTAGRAM_PUBLISH_ENABLED === 'true',
    dailyLimit: Math.max(1, Number(process.env.DAILY_POST_LIMIT) || 1),
    publicOrigin: process.env.PUBLIC_MEDIA_ORIGIN || null,
    loginMethod: 'Facebook Login (linked professional Instagram account)',
    worker: get("SELECT value FROM settings WHERE key='worker_heartbeat'")?.value || null,
  };
}
export function resolvePublication(jobId, data) {
  const j = jobById(jobId);
  if (j.status !== 'needs_attention')
    throw new AppError('Only uncertain publications can be resolved here.');
  if (!data.confirmed)
    throw new AppError('Check the Instagram account before resolving an uncertain publication.');
  const evidence = textField(data.evidence, 'Resolution note', 1000, 10);
  if (data.outcome === 'published') {
    const mediaId = textField(data.mediaId, 'Instagram media ID', 50);
    if (!/^\d+$/.test(mediaId))
      throw new AppError('Enter the numeric media ID confirmed by Instagram.');
    run(
      "UPDATE jobs SET status='published',media_id=?,published_at=?,last_error=NULL,updated_at=? WHERE id=?",
      mediaId,
      now(),
      now(),
      jobId,
    );
  } else if (data.outcome === 'not_published') {
    run(
      "UPDATE jobs SET status='approved',container_id=NULL,scheduled_at=NULL,last_error=NULL,updated_at=? WHERE id=?",
      now(),
      jobId,
    );
  } else throw new AppError('Choose a resolution.');
  audit(jobId, `resolved_${data.outcome}`, evidence);
}
export function analytics() {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const visitors = get(
    "SELECT count(DISTINCT visitor) as n FROM events WHERE kind='visit' AND created_at>?",
    since,
  ).n;
  const returning = get(
    "SELECT count(*) as n FROM (SELECT visitor FROM events WHERE kind='visit' AND created_at>? GROUP BY visitor HAVING count(DISTINCT substr(created_at,1,10))>1)",
    since,
  ).n;
  return {
    visitors,
    returning,
    productVisits: get(
      "SELECT count(*) as n FROM events WHERE kind='outbound' AND created_at>?",
      since,
    ).n,
    saves: get('SELECT count(*) as n FROM saves').n,
    members: get("SELECT count(*) as n FROM users WHERE role='member'").n,
    inquiries: get('SELECT count(*) as n FROM inquiries').n,
    sources: all(
      "SELECT source,count(DISTINCT visitor) as visitors,sum(CASE WHEN kind='outbound' THEN 1 ELSE 0 END) as clicks FROM events WHERE created_at>? GROUP BY source ORDER BY visitors DESC",
      since,
    ),
    products: all(
      "SELECT p.name,count(e.id) as clicks FROM products p LEFT JOIN events e ON p.id=e.product_id AND e.kind='outbound' AND e.created_at>? GROUP BY p.id ORDER BY clicks DESC",
      since,
    ),
  };
}
