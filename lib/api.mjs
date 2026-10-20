import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  all,
  get,
  run,
  id,
  now,
  transaction,
  parseProduct,
  listProducts,
  listJobs,
  mediaDir,
  audit,
} from './db.mjs';
import {
  AppError,
  checkOrigin,
  currentUser,
  requireUser,
  hashPassword,
  verifyPassword,
  createSession,
  sessionCookie,
  ensureAdmin,
  textField,
  webUrl,
  rateLimit,
  cookie,
  digest,
} from './auth.mjs';
import {
  createDraft,
  updateDraft,
  requestRender,
  approveJob,
  scheduleJob,
  unscheduleJob,
  jobById,
  analytics,
  connectionStatus,
  resolvePublication,
} from './workflow.mjs';
import { tick } from './worker.mjs';
import { automaticCover, uploadCover, ownedCover, coverResponse } from './covers.mjs';
import {
  categories,
  audiences,
  platforms,
  pricingModels,
  productColors,
} from './product-options.mjs';
const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function visitor(req) {
  const existing = cookie(req, 'ap_visitor');
  return existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : id();
}
export function visitorCookie(value) {
  return `ap_visitor=${value}; SameSite=Lax; HttpOnly; Path=/; Max-Age=2592000${process.env.APP_URL?.startsWith('https:') ? '; Secure' : ''}`;
}
function recordEvent(req, body) {
  const v = visitor(req);
  const kind = ['visit', 'detail', 'outbound'].includes(body.kind) ? body.kind : 'visit';
  const productId =
    body.productId &&
    get("SELECT id FROM products WHERE id=? AND status='published'", body.productId)
      ? body.productId
      : null;
  const source =
    String(body.source || 'direct')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'direct';
  const campaign = String(body.campaign || '').slice(0, 80);
  const cutoff =
    kind === 'outbound' ? new Date(Date.now() - 5 * 60_000).toISOString() : now().slice(0, 10);
  const duplicate = get(
    "SELECT id FROM events WHERE visitor=? AND kind=? AND coalesce(product_id,'')=? AND created_at>?",
    digest(v),
    kind,
    productId || '',
    cutoff,
  );
  if (!duplicate && currentUser(req)?.role !== 'admin')
    run(
      'INSERT INTO events VALUES (?,?,?,?,?,?,?)',
      id(),
      kind,
      productId,
      digest(v),
      source,
      campaign,
      now(),
    );
  return v;
}
export { recordEvent };

export async function handle(req, segments) {
  const route = segments.join('/');
  try {
    ensureAdmin();
    if (req.method === 'GET') {
      const user = currentUser(req);
      if (segments.length === 2 && segments[0] === 'covers')
        return coverResponse(segments[1], user);
      if (route === 'bootstrap')
        return json({
          user,
          products: listProducts(user?.id),
          catalogLabel: 'Independent product discoveries',
          source: 'Real products. Listings are not endorsements or partnerships.',
        });
      if (route.startsWith('products/')) {
        const slug = segments[1];
        const p = listProducts(user?.id).find((p) => p.slug === slug);
        if (!p) throw new AppError('Product not found.', 404);
        const comments = all(
          'SELECT c.id,c.body,c.created_at,u.name,u.id as user_id FROM comments c JOIN users u ON c.user_id=u.id WHERE c.product_id=? ORDER BY c.created_at DESC LIMIT 100',
          p.id,
        );
        return json({ product: p, comments });
      }
      if (route === 'studio') {
        requireUser(req, true);
        return json({
          products: all(
            'SELECT p.*,u.name as owner_name FROM products p LEFT JOIN users u ON p.owner_id=u.id ORDER BY p.created_at DESC',
          ).map(parseProduct),
          jobs: listJobs(),
          analytics: analytics(),
          connection: connectionStatus(),
          inquiries: all('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100'),
          audit: all('SELECT * FROM audit ORDER BY created_at DESC LIMIT 30'),
        });
      }
      if (route.startsWith('studio/package/')) {
        requireUser(req, true);
        const j = jobById(segments[2]);
        return json({
          script: j.script,
          caption: j.caption,
          storyboard: JSON.parse(j.storyboard),
          video: j.output_file ? `/media/${j.output_file}` : null,
        });
      }
      if (route === 'health') return json({ ok: true });
      throw new AppError('Not found.', 404);
    }
    if (req.method !== 'POST') throw new AppError('Method not allowed.', 405);
    checkOrigin(req);
    const user = currentUser(req);
    const clientKey = user?.id || digest(cookie(req, 'ap_visitor') || 'anonymous');
    rateLimit(`route:${route}:${clientKey}`, route === 'events' ? 120 : 30);
    if (route === 'covers/upload') {
      const u = requireUser(req);
      return json({ cover: await uploadCover(req, u.id) });
    }
    if (route === 'studio/upload') {
      requireUser(req, true);
      const length = Number(req.headers.get('content-length'));
      if (!length || length > 55 * 1024 * 1024)
        throw new AppError('Upload an MP4 smaller than 50 MB.', 413);
      const form = await req.formData();
      const jobId = String(form.get('jobId') || '');
      const j = jobById(jobId);
      if (!['draft', 'rendered', 'approved', 'failed'].includes(j.status))
        throw new AppError('Unschedule this content before replacing its video.');
      const file = form.get('file');
      if (!file || typeof file === 'string' || file.size > 50 * 1024 * 1024 || file.size < 24)
        throw new AppError('Upload an MP4 smaller than 50 MB.');
      if (form.get('rights') !== 'true')
        throw new AppError('Confirm you have permission to publish the clip.');
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.toString('ascii', 4, 8) !== 'ftyp')
        throw new AppError('This file is not an MP4 video.');
      const filename = `${id()}.mp4`;
      writeFileSync(path.join(mediaDir, filename), bytes);
      run(
        "UPDATE jobs SET source_file=?,rights_confirmed=1,output_file=NULL,container_id=NULL,status='draft',approved_at=NULL,updated_at=? WHERE id=?",
        filename,
        now(),
        jobId,
      );
      audit(jobId, 'clip_uploaded', 'Operator confirmed rights to the source clip.');
      return json({ ok: true });
    }
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 64 * 1024) throw new AppError('Request too large.', 413);
    let body;
    try {
      const reader = req.body?.getReader();
      let size = 0;
      const chunks = [];
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 64 * 1024) {
            await reader.cancel();
            throw new AppError('Request too large.', 413);
          }
          chunks.push(Buffer.from(value));
        }
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('Send a valid JSON request.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new AppError('Invalid request.');
    if (route === 'covers/capture') {
      const u = requireUser(req);
      return json({ cover: await automaticCover(webUrl(body.url), u.id, body.refresh === true) });
    }
    if (route === 'auth/register' || route === 'auth/login') {
      const email = textField(body.email, 'Email', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new AppError('Enter a valid email address.');
      rateLimit(`auth:${digest(email)}`, 10, 15 * 60_000);
      const password = textField(body.password, 'Password', 128, 12);
      let found = get('SELECT * FROM users WHERE email=?', email);
      if (route === 'auth/register') {
        if (found) throw new AppError('This email is already registered. Sign in instead.', 409);
        const name = textField(body.name, 'Name', 60, 2);
        const userId = id();
        run(
          'INSERT INTO users VALUES (?,?,?,?,?,?)',
          userId,
          email,
          name,
          hashPassword(password),
          'member',
          now(),
        );
        found = get('SELECT * FROM users WHERE id=?', userId);
      } else if (!found || !verifyPassword(password, found.password))
        throw new AppError('Email or password was not recognised.', 401);
      const token = createSession(found.id);
      return json(
        { user: { id: found.id, email: found.email, name: found.name, role: found.role } },
        200,
        { 'Set-Cookie': sessionCookie(token) },
      );
    }
    if (route === 'auth/logout') {
      const token = cookie(req, 'ap_session');
      if (token) run('DELETE FROM sessions WHERE token=?', digest(token));
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
    }
    if (route === 'events') {
      const v = recordEvent(req, body);
      return json({ ok: true }, 200, { 'Set-Cookie': visitorCookie(v) });
    }
    if (route === 'save') {
      const u = requireUser(req);
      const p = get(
        "SELECT id FROM products WHERE id=? AND status='published'",
        String(body.productId || ''),
      );
      if (!p) throw new AppError('Product not found.', 404);
      const exists = get('SELECT * FROM saves WHERE user_id=? AND product_id=?', u.id, p.id);
      if (exists) run('DELETE FROM saves WHERE user_id=? AND product_id=?', u.id, p.id);
      else run('INSERT INTO saves VALUES (?,?,?)', u.id, p.id, now());
      return json({ saved: !exists });
    }
    if (route === 'comment') {
      const u = requireUser(req);
      const p = get(
        "SELECT id FROM products WHERE id=? AND status='published'",
        String(body.productId || ''),
      );
      if (!p) throw new AppError('Product not found.', 404);
      run(
        'INSERT INTO comments VALUES (?,?,?,?,?)',
        id(),
        p.id,
        u.id,
        textField(body.body, 'Comment', 1500, 2),
        now(),
      );
      return json({ ok: true });
    }
    if (route === 'comment/delete') {
      const u = requireUser(req);
      const c = get('SELECT * FROM comments WHERE id=?', String(body.id));
      if (!c || !(c.user_id === u.id || u.role === 'admin'))
        throw new AppError('You cannot remove this comment.', 403);
      run('DELETE FROM comments WHERE id=?', c.id);
      return json({ ok: true });
    }
    if (route === 'submit') {
      const u = requireUser(req);
      rateLimit(`submit:${u.id}`, 5, 86400_000);
      const name = textField(body.name, 'Product name', 60);
      const productId = id();
      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60) +
        '-' +
        productId.slice(0, 6);
      if (!categories.includes(body.category))
        throw new AppError('Choose a category from the list.');
      if (!audiences.includes(body.audience || 'Everyone'))
        throw new AppError('Choose an audience from the list.');
      const category = body.category,
        audience = body.audience || 'Everyone';
      const tagline = textField(body.tagline, 'Tagline', 100);
      const url = webUrl(body.url);
      const facts = textField(body.facts || '', 'Product capabilities', 1500, 0)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const selectedPlatforms = body.platforms || [];
      if (
        !Array.isArray(selectedPlatforms) ||
        selectedPlatforms.length > platforms.length ||
        selectedPlatforms.some((value) => !platforms.includes(value))
      )
        throw new AppError('Choose platforms from the available options.');
      if (body.pricingModel && !pricingModels.includes(body.pricingModel))
        throw new AppError('Choose a pricing model from the list.');
      const color = productColors.some((option) => option.value === body.color)
        ? body.color
        : 'lilac';
      const submission = {
        platforms: [...new Set(selectedPlatforms)],
        pricingModel: body.pricingModel || '',
        demoUrl: body.demoUrl ? webUrl(body.demoUrl, 'Demo URL') : '',
      };
      if (body.ownership !== true)
        throw new AppError('Confirm you are the maker or authorised to submit this product.');
      run(
        'INSERT INTO products (id,slug,name,tagline,description,url,category,audience,pricing,color,icon,source,facts,owner_id,created_at,submission_details,cover_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        productId,
        slug,
        name,
        tagline,
        textField(String(body.description || '').trim() || tagline, 'Description', 2000),
        url,
        category,
        audience,
        textField(body.pricing || body.pricingModel || 'See current pricing', 'Pricing', 100),
        color,
        'spark',
        body.source ? webUrl(body.source, 'Source URL') : url,
        JSON.stringify(facts),
        u.id,
        now(),
        JSON.stringify(submission),
        ownedCover(body.coverId, u.id),
      );
      return json({ ok: true, slug });
    }
    if (route === 'sponsor') {
      rateLimit('sponsor:' + clientKey, 3, 3600_000);
      const email = textField(body.email, 'Email', 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email.');
      run(
        'INSERT INTO inquiries VALUES (?,?,?,?,?,?)',
        id(),
        textField(body.name, 'Name', 80),
        email,
        webUrl(body.url),
        textField(body.message, 'Message', 2000, 10),
        now(),
      );
      return json({ ok: true });
    }
    if (route === 'account/delete') {
      const u = requireUser(req);
      if (u.role === 'admin')
        throw new AppError('The studio owner cannot delete their account here.');
      transaction(() => {
        run('DELETE FROM sessions WHERE user_id=?', u.id);
        run('DELETE FROM saves WHERE user_id=?', u.id);
        run('DELETE FROM comments WHERE user_id=?', u.id);
        run('UPDATE products SET owner_id=NULL WHERE owner_id=?', u.id);
        run('DELETE FROM users WHERE id=?', u.id);
      });
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', true) });
    }
    if (route.startsWith('studio/')) {
      const admin = requireUser(req, true);
      if (route === 'studio/product') {
        const p = get('SELECT * FROM products WHERE id=?', String(body.id));
        if (!p) throw new AppError('Product not found.', 404);
        if (body.action === 'verify') {
          if (!body.confirmed)
            throw new AppError('Confirm that you checked the listed facts against the source.');
          run("UPDATE products SET status='published',verified_at=? WHERE id=?", now(), p.id);
        } else if (body.action === 'reject') {
          run("UPDATE products SET status='rejected' WHERE id=?", p.id);
          run(
            "UPDATE jobs SET status='archived',updated_at=? WHERE product_id=? AND status IN ('draft','rendered','approved','queued','render_pending','failed')",
            now(),
            p.id,
          );
        } else if (body.action === 'cover') {
          run(
            'UPDATE products SET cover_id=? WHERE id=?',
            ownedCover(body.coverId, admin.id),
            p.id,
          );
          audit(null, 'product_cover_changed', p.id);
        } else if (body.action === 'sponsor') {
          if (
            get(
              "SELECT id FROM jobs WHERE product_id=? AND status IN ('publishing','rendering','needs_attention')",
              p.id,
            )
          )
            throw new AppError(
              'Finish or reconcile the active workflow before changing sponsorship.',
            );
          run('UPDATE products SET sponsored=? WHERE id=?', body.enabled ? 1 : 0, p.id);
          const drafts = all(
            "SELECT id,caption FROM jobs WHERE product_id=? AND status IN ('draft','rendered','approved','queued','render_pending','failed')",
            p.id,
          );
          for (const draft of drafts) {
            const original = draft.caption.replace(/^Paid feature\.\s*/, '');
            const caption = (body.enabled ? 'Paid feature.\n\n' : '') + original;
            run('UPDATE jobs SET caption=? WHERE id=?', caption.slice(0, 2200), draft.id);
          }
          run(
            "UPDATE jobs SET status='draft',output_file=NULL,approved_at=NULL,container_id=NULL,updated_at=? WHERE product_id=? AND status IN ('draft','rendered','approved','queued','render_pending','failed')",
            now(),
            p.id,
          );
        } else throw new AppError('Unknown product action.');
        return json({ ok: true });
      }
      if (route === 'studio/draft') return json({ job: createDraft(String(body.productId)) });
      if (route === 'studio/edit') {
        updateDraft(String(body.id), body);
        return json({ ok: true });
      }
      if (route === 'studio/render') {
        requestRender(String(body.id));
        return json({ ok: true });
      }
      if (route === 'studio/approve') {
        approveJob(String(body.id));
        return json({ ok: true });
      }
      if (route === 'studio/schedule') {
        scheduleJob(String(body.id), body.time);
        return json({ ok: true });
      }
      if (route === 'studio/unschedule') {
        unscheduleJob(String(body.id));
        return json({ ok: true });
      }
      if (route === 'studio/resolve') {
        resolvePublication(String(body.id), body);
        return json({ ok: true });
      }
      if (route === 'studio/tick') return json(await tick());
      if (route === 'studio/archive') {
        const j = jobById(String(body.id));
        if (['publishing', 'needs_attention', 'published', 'rendering'].includes(j.status))
          throw new AppError('This state requires investigation and cannot be archived here.');
        run("UPDATE jobs SET status='archived',updated_at=? WHERE id=?", now(), j.id);
        audit(j.id, 'archived');
        return json({ ok: true });
      }
    }
    throw new AppError('Not found.', 404);
  } catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    console.error('Request failed:', error.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
