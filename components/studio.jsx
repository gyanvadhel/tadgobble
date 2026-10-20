'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Layers,
  Clapperboard,
  CalendarClock,
  Inbox,
  Plug,
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Play,
  Upload,
  Download,
  LoaderCircle,
  Eye,
  Bookmark,
  Users,
  ExternalLink,
  AlertCircle,
  Clock,
  RefreshCw,
  LogOut,
  Video,
  FileText,
} from 'lucide-react';
import { Brand } from './art';
import { api, Field, Modal } from './platform';
import CoverEditor, { useProductCover } from './cover-editor';
import { cloudMode } from '../lib/client-api.mjs';
const labels = {
  draft: 'Draft',
  render_pending: 'Waiting to render',
  rendering: 'Rendering',
  rendered: 'Ready for review',
  approved: 'Approved',
  queued: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Needs a fix',
  needs_attention: 'Check publication',
  archived: 'Archived',
};
function ResolveForm({ job, action, busy }) {
  return (
    <form
      className="studio-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        await action(
          'resolve',
          { ...data, id: job.id, confirmed: !!data.confirmed },
          'Publication outcome recorded.',
        );
      }}
    >
      <h3>Reconcile with the Instagram account</h3>
      <p>
        Open the account and check whether this exact Reel was published before choosing an outcome.
      </p>
      <Field label="Confirmed outcome">
        <select name="outcome">
          <option value="published">It was published — record the media ID</option>
          <option value="not_published">It was not published — return to approved</option>
        </select>
      </Field>
      <Field label="Published Instagram media ID">
        <input name="mediaId" inputMode="numeric" placeholder="Required when published" />
      </Field>
      <Field label="How did you confirm the outcome?">
        <textarea name="evidence" minLength={10} maxLength={1000} required rows={2} />
      </Field>
      <label className="check-field">
        <input type="checkbox" name="confirmed" required /> I checked the account and confirmed this
        result.
      </label>
      <button className="button button-dark" disabled={busy}>
        Record resolution
      </button>
    </form>
  );
}
function Status({ value }) {
  return <span className={`status status-${value}`}>{labels[value] || value}</span>;
}
function Empty({ icon: Icon = Clapperboard, title, children }) {
  return (
    <div className="studio-empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export default function Studio({ user, loading, onLogin, notify, onLogout }) {
  const [data, setData] = useState(null),
    [tab, setTab] = useState('Overview'),
    [productStatus, setProductStatus] = useState('pending'),
    [selected, setSelected] = useState(null),
    [review, setReview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requested = [
      'Overview',
      'Products',
      'Content',
      'Queue',
      'Inbox',
      'Connection',
    ].find((value) => value.toLowerCase() === (params.get('tab') === 'partnerships' ? 'inbox' : params.get('tab')));
    if (requested) setTab(requested);
    if (['all', 'pending', 'published', 'rejected', 'archived'].includes(params.get('status')))
      setProductStatus(params.get('status'));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const d = await api('studio');
      setData(d);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (user?.role === 'admin') {
      refresh();
      const t = setInterval(refresh, 10_000);
      return () => clearInterval(t);
    }
  }, [user?.role, refresh]);
  async function action(route, body, success) {
    setBusy(true);
    try {
      const result = await api('studio/' + route, body);
      await refresh();
      if (success) notify(success);
      return result;
    } catch (e) {
      notify(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="studio-gate">
        <LoaderCircle className="spin" /> Opening the studio…
      </div>
    );
  if (user?.role !== 'admin')
    return (
      <div className="studio-gate">
        <Brand />
        <span className="eyebrow">THE WORK BEHIND THE DISCOVERIES</span>
        <h1>
          Your content
          <br />
          <em>control room.</em>
        </h1>
        <p>Review products, prepare videos, and manage your publishing workflow.</p>
        {!user ? (
          <button className="button button-dark" onClick={onLogin}>
            Sign in to the studio <ArrowRight size={17} />
          </button>
        ) : (
          <p className="form-error">This account doesn’t have studio access.</p>
        )}
        <small>{cloudMode ? 'Only the studio owner can review submissions.' : 'The owner account is configured in your local environment file.'}</small>
        <a href="/discover">← Back to discoveries</a>
      </div>
    );
  const nav = [
    ['Overview', LayoutDashboard],
    ['Products', Layers],
    ['Content', Clapperboard],
    ['Queue', CalendarClock],
    ['Inbox', Inbox],
    ['Connection', Plug],
  ];
  const job = data?.jobs.find((j) => j.id === selected);
  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <Brand light studio />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => {
                setTab(name);
                const url = new URL(location.href);
                url.searchParams.set('tab', name.toLowerCase());
                history.replaceState(null, '', url);
              }}
            >
              <Icon size={19} />
              {name}
              {name === 'Products' && data?.products.some((p) => p.status === 'pending') && (
                <span className="sidebar-count">
                  {data.products.filter((p) => p.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="studio-sidebar-bottom">
          <div className="studio-mode">
            <span className={`small-dot ${data?.connection.publishingEnabled ? 'on' : ''}`} />
            {data?.connection.publishingEnabled ? 'Publishing enabled' : 'Publishing disconnected'}
          </div>
          <a href="/discover">
            View public site <ArrowUpRight size={16} />
          </a>
          <button onClick={onLogout}>
            Sign out <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="studio-main">
        <header className="studio-header">
          <div>
            <span className="eyebrow">TADGOBBLE STUDIO</span>
            <h1>{tab}</h1>
          </div>
          <div>
            {!cloudMode && <button
              className="button"
              disabled={busy}
              onClick={async () => {
                const r = await action('tick', {});
                if (r)
                  notify(
                    r.action === 'idle' ? r.reason : `Automation: ${r.action.replaceAll('_', ' ')}`,
                  );
              }}
            >
              {busy ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />} Run one
              workflow step
            </button>}
            <div className="avatar">{user.name[0]}</div>
          </div>
        </header>
        {error && <p className="form-error">{error}</p>}
        {!data ? (
          <div className="loading">
            <LoaderCircle className="spin" /> Loading your workspace…
          </div>
        ) : (
          <>
            {tab === 'Overview' && (
              <>
                <section className="studio-welcome">
                  <div>
                    <span className="eyebrow">A LITTLE SYSTEM. A LOT OF POSSIBILITIES.</span>
                    <h2>Make discovery a daily habit.</h2>
                    <p>Your products, content, and audience signals in one place.</p>
                  </div>
                  <div className="welcome-decoration">✳</div>
                </section>
                <div className="metrics-grid">
                  {[
                    ['Visitors', data.analytics.visitors, 'Unique visitors · last 30 days', Eye],
                    [
                      'Product visits',
                      data.analytics.productVisits,
                      'Outbound clicks · last 30 days',
                      ArrowUpRight,
                    ],
                    [
                      'Returning visitors',
                      data.analytics.returning,
                      'Visited on more than one day',
                      Users,
                    ],
                    ['Saved products', data.analytics.saves, 'Across member collections', Bookmark],
                  ].map(([name, value, note, Icon]) => (
                    <div className="metric-card" key={name}>
                      <div>
                        <span>{name}</span>
                        <Icon size={18} />
                      </div>
                      <strong>{value}</strong>
                      <small>{note}</small>
                    </div>
                  ))}
                </div>
                {!cloudMode && <section className="studio-panel">
                  <div className="panel-title">
                    <div>
                      <h2>From a discovery to a daily post</h2>
                      <p>Every step has a clear state. Start with a product you’ve checked.</p>
                    </div>
                    <button className="text-button" onClick={() => setTab('Content')}>
                      Open content <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="pipeline">
                    {[
                      ['Review', data.products.filter((p) => p.status === 'pending').length],
                      ['Draft', data.jobs.filter((j) => j.status === 'draft').length],
                      [
                        'Render',
                        data.jobs.filter((j) =>
                          ['render_pending', 'rendering', 'rendered'].includes(j.status),
                        ).length,
                      ],
                      ['Approved', data.jobs.filter((j) => j.status === 'approved').length],
                      ['Scheduled', data.jobs.filter((j) => j.status === 'queued').length],
                      ['Published', data.jobs.filter((j) => j.status === 'published').length],
                    ].map(([name, count], i) => (
                      <div className="pipeline-step" key={name}>
                        <span>0{i + 1}</span>
                        <strong>{count}</strong>
                        <small>{name}</small>
                      </div>
                    ))}
                  </div>
                </section>}
                <div className="studio-two-col">
                  <section className="studio-panel">
                    <div className="panel-title">
                      <h2>What’s bringing people here?</h2>
                    </div>
                    {data.analytics.sources.length ? (
                      data.analytics.sources.map((s) => (
                        <div className="data-row" key={s.source}>
                          <span>{s.source}</span>
                          <strong>{s.visitors} visitors</strong>
                          <small>{s.clicks} product visits</small>
                        </div>
                      ))
                    ) : (
                      <Empty icon={Eye} title="Your first signals are still ahead.">
                        Campaign sources appear when people arrive through your tracked links.
                      </Empty>
                    )}
                  </section>
                  <section className="studio-panel">
                    <div className="panel-title">
                      <h2>Recent activity</h2>
                    </div>
                    {data.audit.length ? (
                      data.audit.slice(0, 5).map((a) => (
                        <div className="activity" key={a.id}>
                          <span className="small-dot" />
                          <div>
                            <strong>{a.action.replaceAll('_', ' ')}</strong>
                            <small>{new Date(a.created_at).toLocaleString()}</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty icon={Clock} title="A fresh start.">
                        Your workflow history will appear here as you review products and prepare
                        content.
                      </Empty>
                    )}
                  </section>
                </div>
                <p className="studio-footnote">
                  These are recorded activity counts. Product visits don’t prove signups or
                  purchases. No estimated revenue is presented as earned revenue.
                </p>
              </>
            )}
            {tab === 'Products' && (
              <section className="studio-panel">
                <div className="panel-title">
                  <div>
                    <h2>A collection worth sharing</h2>
                    <p>Check the source facts before preparing a public feature.</p>
                  </div>
                  <label className="studio-status-filter">
                    Show{' '}
                    <select
                      aria-label="Listing status"
                      value={productStatus}
                      onChange={(event) => {
                        setProductStatus(event.target.value);
                        const url = new URL(location.href);
                        url.searchParams.set('status', event.target.value);
                        history.replaceState(null, '', url);
                      }}
                    >
                      {['pending', 'published', 'rejected', 'archived', 'all'].map((value) => (
                        <option key={value} value={value}>
                          {value === 'all'
                            ? 'All listings'
                            : value[0].toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Audience</th>
                        <th>Listing</th>
                        <th>Source review</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.products
                        .filter((p) => productStatus === 'all' || p.status === productStatus)
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="table-product">
                                <span className={`product-monogram mono-${p.color}`}>
                                  {p.name[0]}
                                </span>
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.editorial
                                      ? 'Editorial starter listing'
                                      : `Submitted by ${p.owner_name || 'a member'}`}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{p.audience}</td>
                            <td>
                              <Status value={p.status} />
                            </td>
                            <td>
                              {p.verified_at ? (
                                <span className="verified">
                                  <Check size={14} /> Checked
                                </span>
                              ) : (
                                <span className="muted">Needs review</span>
                              )}
                            </td>
                            <td>
                              <button className="button button-small" onClick={() => setReview(p)}>
                                Review <ArrowRight size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!data.products.some(
                    (p) => productStatus === 'all' || p.status === productStatus,
                  ) && (
                    <Empty title="Nothing in this queue.">
                      Choose another listing status to see the rest of the collection.
                    </Empty>
                  )}
                </div>
              </section>
            )}
            {cloudMode && ['Content', 'Queue', 'Connection'].includes(tab) && (
              <section className="studio-panel">
                <h2>Your desktop handles the heavy lifting.</h2>
                <p>Website previews run through your local worker. Video editing, rendering, and publishing stay in the desktop studio for the free launch.</p>
                <p>Last preview worker check: {data.connection.worker ? new Date(data.connection.worker).toLocaleString() : 'Waiting for the worker.'}</p>
                <p>Run <code>npm run worker:cloud</code> on your computer for queued website previews. Run <code>npm run sync:cloud</code> before preparing videos to refresh the desktop catalog.</p>
                <a className="button button-dark" href="http://127.0.0.1:3000/studio" target="_blank" rel="noreferrer">Open desktop studio <ArrowUpRight size={16} /></a>
              </section>
            )}
            {!cloudMode && tab === 'Content' && (
              <>
                <section className="studio-panel new-draft">
                  <div>
                    <h2>One good product. One clear story.</h2>
                    <p>
                      Generate a script, caption, and shot list from the listing’s recorded facts.
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const r = await action(
                        'draft',
                        { productId: new FormData(e.currentTarget).get('productId') },
                        'Content draft prepared.',
                      );
                      if (r?.job) setSelected(r.job.id);
                    }}
                  >
                    <select name="productId" aria-label="Product for content draft">
                      {data.products
                        .filter((p) => p.status === 'published')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <button className="button button-dark" disabled={busy}>
                      <Plus size={16} /> Prepare draft
                    </button>
                  </form>
                </section>
                <div className="content-grid">
                  {data.jobs
                    .filter((j) => j.status !== 'archived')
                    .map((j) => (
                      <button className="content-card" key={j.id} onClick={() => setSelected(j.id)}>
                        <div className={`content-thumb art-${j.color}`}>
                          <Video size={40} />
                          <strong>{j.product_name}</strong>
                          <span>REEL · PORTRAIT</span>
                        </div>
                        <div className="content-card-meta">
                          <Status value={j.status} />
                          <ArrowUpRight size={17} />
                        </div>
                        <h3>{j.product_name}</h3>
                        <p>{j.caption.split('\n')[0]}</p>
                      </button>
                    ))}
                </div>
                {!data.jobs.some((j) => j.status !== 'archived') && (
                  <Empty title="Your first feature starts here.">
                    Pick a product above. Its draft will have a script, caption, and shot list ready
                    for your review.
                  </Empty>
                )}
              </>
            )}
            {!cloudMode && tab === 'Queue' && (
              <section className="studio-panel">
                <div className="panel-title">
                  <div>
                    <h2>A little consistency, planned ahead.</h2>
                    <p>Times display in your browser’s timezone. The daily cap uses UTC dates.</p>
                  </div>
                  <span className="soft-tag">{data.connection.dailyLimit} post / day</span>
                </div>
                {!data.connection.publishingEnabled && (
                  <div className="info-note">
                    <Plug size={18} />
                    <p>
                      Queued posts stay queued until the Instagram connection is configured and
                      publishing is enabled.
                    </p>
                  </div>
                )}
                {data.jobs.some((j) =>
                  ['queued', 'publishing', 'published', 'needs_attention'].includes(j.status),
                ) ? (
                  data.jobs
                    .filter((j) =>
                      ['queued', 'publishing', 'published', 'needs_attention'].includes(j.status),
                    )
                    .map((j) => (
                      <div className="queue-row" key={j.id}>
                        <CalendarClock size={22} />
                        <div>
                          <strong>{j.product_name}</strong>
                          <small>
                            {j.scheduled_at
                              ? new Date(j.scheduled_at).toLocaleString()
                              : 'No scheduled time'}
                          </small>
                          {j.last_error && <p className="form-error">{j.last_error}</p>}
                        </div>
                        <Status value={j.status} />
                        {j.status === 'queued' && (
                          <button
                            className="button button-small"
                            onClick={() =>
                              action('unschedule', { id: j.id }, 'Returned to approved drafts.')
                            }
                          >
                            Unschedule
                          </button>
                        )}
                        {j.status === 'needs_attention' && (
                          <button className="button button-small" onClick={() => setSelected(j.id)}>
                            Resolve
                          </button>
                        )}
                        {j.permalink && (
                          <a href={j.permalink} target="_blank" rel="noreferrer">
                            View Reel <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))
                ) : (
                  <Empty icon={CalendarClock} title="Your calendar is a clean slate.">
                    Review a rendered video, approve it, then choose its publishing time.
                  </Empty>
                )}
              </section>
            )}
            {tab === 'Inbox' && (
              <>
                <section className="studio-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Your inbox.</h2>
                      <p>
                        Private support, privacy, and partnership requests from the public site.
                        Partnership inquiries are leads, not paid orders.
                      </p>
                    </div>
                    <span className="soft-tag">{data.inquiries.length} inquiries</span>
                  </div>
                  {data.inquiries.length ? (
                    data.inquiries.map((q) => (
                      <article className="inquiry" key={q.id}>
                        <h3>{q.name}</h3>
                        <span>{q.email}</span>
                        <a href={q.product_url} target="_blank" rel="noreferrer">
                          {q.product_url}
                          <ExternalLink size={13} />
                        </a>
                        <p>{q.message}</p>
                        <small>{new Date(q.created_at).toLocaleString()}</small>
                      </article>
                    ))
                  ) : (
                    <Empty icon={Inbox} title="All quiet in here.">
                      Messages from the contact and partnership forms will appear here.
                    </Empty>
                  )}
                </section>
                <section className="studio-panel revenue-note">
                  <h2>The first revenue experiment</h2>
                  <p>
                    Offer one clearly labelled sponsored discovery to a product that fits the
                    audience. Agree on the video, placement dates, and a report of observed visits.
                    Set the price after understanding your production costs and audience results.
                  </p>
                  <p>
                    The app captures inquiries and labels sponsored listings. Payment collection,
                    invoices, and refunds are not connected in this version.
                  </p>
                </section>
              </>
            )}
            {!cloudMode && tab === 'Connection' && (
              <>
                <section className="studio-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Connect the last mile.</h2>
                      <p>The publishing adapter uses Meta’s official API with Facebook Login.</p>
                    </div>
                    <Status value={data.connection.publishingEnabled ? 'published' : 'draft'} />
                  </div>
                  <div className="connection-row">
                    <div className="connection-icon">◎</div>
                    <div>
                      <h3>Instagram</h3>
                      <p>
                        {data.connection.connected
                          ? 'Credentials configured; a live account test is still required.'
                          : 'Professional Instagram account linked to a Facebook Page required.'}
                      </p>
                    </div>
                    <span className="soft-tag">
                      {data.connection.publishingEnabled ? 'Enabled' : 'Not enabled'}
                    </span>
                  </div>
                  <ol className="setup-list">
                    <li>
                      <strong>Set up the professional account and Meta app.</strong>
                      <p>
                        Use the official Facebook Login flow and grant the required publishing
                        permissions. For accounts outside your app roles, Meta access review may be
                        required.
                      </p>
                    </li>
                    <li>
                      <strong>Add credentials to the server environment.</strong>
                      <p>
                        <code>INSTAGRAM_ACCOUNT_ID</code>, <code>INSTAGRAM_ACCESS_TOKEN</code>, and
                        a currently supported <code>INSTAGRAM_GRAPH_VERSION</code>. The token stays
                        on the server.
                      </p>
                    </li>
                    <li>
                      <strong>Host the app and media over HTTPS.</strong>
                      <p>
                        Set <code>APP_URL</code> and <code>PUBLIC_MEDIA_ORIGIN</code> to your
                        deployed origin. Meta fetches approved videos from the public media route.
                      </p>
                    </li>
                    <li>
                      <strong>Enable publishing and run the worker.</strong>
                      <p>
                        Set <code>INSTAGRAM_PUBLISH_ENABLED=true</code>. Run{' '}
                        <code>npm run worker</code> in a persistent process. Only approved,
                        scheduled content is eligible.
                      </p>
                    </li>
                  </ol>
                  <a
                    className="button"
                    href="https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Meta’s publishing documentation <ArrowUpRight size={15} />
                  </a>
                </section>
                <div className="studio-two-col">
                  <section className="studio-panel">
                    <h3>Worker heartbeat</h3>
                    <p>
                      {data.connection.worker
                        ? new Date(data.connection.worker).toLocaleString()
                        : 'No worker activity recorded yet.'}
                    </p>
                    <small>
                      Use “Run one workflow step” for a manual local run, or keep the worker process
                      running for continuous automation.
                    </small>
                  </section>
                  <section className="studio-panel">
                    <h3>Daily limit</h3>
                    <p>{data.connection.dailyLimit} post(s) per UTC day.</p>
                    <small>
                      Change <code>DAILY_POST_LIMIT</code> in the environment. Uncertain
                      publications stop automatic retries until investigated.
                    </small>
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>
      {job && (
        <Modal wide onClose={() => setSelected(null)}>
          <JobEditor
            key={job.id}
            job={job}
            busy={busy}
            action={action}
            refresh={refresh}
            notify={notify}
            onClose={() => setSelected(null)}
          />
        </Modal>
      )}
      {review && (
        <Modal wide onClose={() => setReview(null)}>
          <ProductReview
            product={review}
            busy={busy}
            action={action}
            onClose={() => setReview(null)}
          />
        </Modal>
      )}
    </div>
  );
}
function ProductReview({ product: p, busy, action, onClose }) {
  const coverState = useProductCover(p.cover);
  const [savedCoverId, setSavedCoverId] = useState(p.cover?.id || null);
  const coverChanged = (coverState.cover?.id || null) !== savedCoverId;
  const [checked, setChecked] = useState(false);
  const [sponsored, setSponsored] = useState(p.sponsored);
  return (
    <div>
      <span className="eyebrow">PRODUCT REVIEW</span>
      <h2>{p.name}</h2>
      <p className="form-intro">{p.description}</p>
      <div className="studio-cover">
        <CoverEditor state={coverState} website={p.url} name={p.name} />
        {coverChanged && (
          <button
            className="button"
            disabled={busy || coverState.busy}
            onClick={async () => {
              const coverId = coverState.cover?.id || null;
              if (
                await action(
                  'product',
                  { id: p.id, action: 'cover', coverId },
                  'Product cover saved.',
                )
              )
                setSavedCoverId(coverId);
            }}
          >
            Save cover
          </button>
        )}
        {coverChanged && (
          <p className="form-intro">
            Save this change before approving. For a published listing, saving updates the public
            cover.
          </p>
        )}
      </div>
      <div className="review-meta">
        <span className="soft-tag">{p.category}</span>
        <span className="soft-tag">{p.audience}</span>
        <span className="soft-tag">{p.pricing}</span>
      </div>
      {!!p.submission?.platforms?.length && (
        <p>Available on: {p.submission.platforms.join(', ')}</p>
      )}
      {p.submission?.demoUrl && (
        <p>
          <a className="button" href={p.submission.demoUrl} target="_blank" rel="noreferrer">
            Open demo <ExternalLink size={15} />
          </a>
        </p>
      )}
      <h3>Recorded source facts</h3>
      <ul className="facts-list">
        {p.facts.map((f) => (
          <li key={f}>
            <Check size={15} />
            {f}
          </li>
        ))}
      </ul>
      {!p.facts.length && (
        <p className="form-intro">
          No separate capabilities were added. Review the description and product website.
        </p>
      )}
      <a className="button" href={p.source} target="_blank" rel="noreferrer">
        Open source <ExternalLink size={15} />
      </a>
      <label className="check-field review-check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I
        checked these details against the source and they accurately describe the product.
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={sponsored}
          onChange={(e) => setSponsored(e.target.checked)}
        />
        This is a paid placement. Label the listing and its video as sponsored.
      </label>
      <div className="action-row">
        <button
          className="button button-dark"
          disabled={!checked || busy || coverState.busy || coverChanged}
          onClick={async () => {
            if (sponsored !== p.sponsored) {
              const updated = await action('product', {
                id: p.id,
                action: 'sponsor',
                enabled: sponsored,
              });
              if (!updated) return;
            }
            const r = await action(
              'product',
              { id: p.id, action: 'verify', confirmed: true },
              'Product facts checked and listing published.',
            );
            if (r) onClose();
          }}
        >
          <Check size={16} /> Verify & publish listing
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            if (
              confirm('Remove this listing from discovery and archive its unpublished content?')
            ) {
              const r = await action('product', { id: p.id, action: 'reject' }, 'Listing removed.');
              if (r) onClose();
            }
          }}
        >
          Remove listing
        </button>
      </div>
    </div>
  );
}
function JobEditor({ job: j, busy, action, refresh, notify, onClose }) {
  const [script, setScript] = useState(j.script),
    [caption, setCaption] = useState(j.caption),
    [rights, setRights] = useState(false),
    [uploading, setUploading] = useState(false),
    [time, setTime] = useState('');
  const editable = ['draft', 'rendered', 'approved', 'failed'].includes(j.status);
  return (
    <div className="job-editor">
      <div className="job-title">
        <div>
          <span className="eyebrow">CONTENT WORKSPACE</span>
          <h2>{j.product_name}</h2>
        </div>
        <Status value={j.status} />
      </div>
      {j.last_error && (
        <p className="form-error">
          <AlertCircle size={16} />
          {j.last_error}
        </p>
      )}
      {j.status === 'needs_attention' && <ResolveForm job={j} action={action} busy={busy} />}
      <div className="job-editor-grid">
        <div>
          <Field label="Voiceover script · included in the export">
            <textarea
              value={script}
              disabled={!editable}
              onChange={(e) => setScript(e.target.value)}
              rows={6}
              maxLength={5000}
            />
          </Field>
          <Field label="Instagram caption">
            <textarea
              value={caption}
              disabled={!editable}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              maxLength={2200}
            />
          </Field>
          <span className="caption-count">{caption.length}/2,200 characters</span>
          <button
            className="button button-small"
            disabled={busy || !editable}
            onClick={() =>
              action(
                'edit',
                { id: j.id, script, caption },
                'Draft saved. Any earlier approval was cleared.',
              )
            }
          >
            Save text
          </button>
          <h3 className="shot-list-heading">Your shot list</h3>
          <div className="shot-list">
            {j.storyboard.map((s) => (
              <div key={s.time}>
                <span>{s.time}</span>
                <strong>{s.label}</strong>
                <p>{s.direction}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="video-workspace">
          {j.output_file ? (
            <video controls src={'/media/' + j.output_file} className="reel-preview" />
          ) : (
            <div className="video-placeholder">
              <Video size={36} />
              <strong>Your product, in motion.</strong>
              <p>Add a real demo clip. We’ll create a branded portrait Reel around it.</p>
              <span>1080 × 1920 · up to 30 seconds</span>
            </div>
          )}
          <p className="video-note">
            The renderer creates a silent video with your demo and a branded frame. The script is
            exported separately for recording a voiceover.
          </p>
          {editable && (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />{' '}
                I have permission to publish this demo clip.
              </label>
              <label className={`button upload-button ${!rights ? 'disabled' : ''}`}>
                <Upload size={15} />
                {uploading
                  ? 'Uploading…'
                  : j.source_file
                    ? 'Replace demo clip'
                    : 'Upload demo clip'}
                <input
                  type="file"
                  accept="video/mp4"
                  disabled={!rights || uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const f = new FormData();
                      f.append('jobId', j.id);
                      f.append('rights', 'true');
                      f.append('file', file);
                      const r = await fetch('/api/studio/upload', { method: 'POST', body: f });
                      const d = await r.json();
                      if (!r.ok) throw new Error(d.error);
                      await refresh();
                      notify('Demo uploaded. Ready to render.');
                    } catch (e) {
                      notify(e.message);
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <small>MP4 · 3–30 seconds recommended · maximum 50 MB</small>
            </>
          )}
          <div className="video-actions">
            {editable && j.source_file && (
              <button
                className="button button-dark button-full"
                disabled={busy}
                onClick={() =>
                  action(
                    'render',
                    { id: j.id },
                    'Render queued. Run a workflow step or start the worker.',
                  )
                }
              >
                <Clapperboard size={16} /> {j.output_file ? 'Render again' : 'Render Reel'}
              </button>
            )}
            {j.status === 'rendered' && (
              <button
                className="button button-full"
                disabled={busy || script !== j.script || caption !== j.caption}
                onClick={() =>
                  action(
                    'approve',
                    { id: j.id },
                    'Content approved. Choose its publishing time below.',
                  )
                }
              >
                <Check size={16} /> I reviewed this video & caption
              </button>
            )}
            {j.status === 'approved' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await action(
                    'schedule',
                    { id: j.id, time: new Date(time).toISOString() },
                    'Post added to the publishing queue.',
                  );
                }}
              >
                <Field label="Publish at · your local timezone">
                  <input
                    type="datetime-local"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
                <button className="button button-dark button-full" disabled={busy}>
                  <CalendarClock size={16} /> Schedule approved post
                </button>
              </form>
            )}
            {['render_pending', 'rendering'].includes(j.status) && (
              <p className="info-note">
                <LoaderCircle className="spin" size={17} />{' '}
                {j.status === 'render_pending'
                  ? 'Waiting for the worker.'
                  : 'Rendering your video…'}
              </p>
            )}
            {j.output_file && (
              <a className="button button-full" download href={'/media/' + j.output_file}>
                <Download size={16} /> Download video
              </a>
            )}
            <button
              className="button button-full"
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      {
                        product: j.product_name,
                        script: j.script,
                        caption: j.caption,
                        storyboard: j.storyboard,
                        video: j.output_file,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${j.slug}-content-package.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <FileText size={16} /> Export content package
            </button>
            {!['publishing', 'published', 'needs_attention', 'rendering'].includes(j.status) && (
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  const r = await action('archive', { id: j.id }, 'Content archived.');
                  if (r) onClose();
                }}
              >
                Archive this content
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
