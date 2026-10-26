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
  withPendingEdit,
  listProducts,
  listJobs,
  mediaDir,
  audit,
  creatorProfile,
  onboardingState,
} from './db.mjs';
import { profileFields, creditFields } from './creators.mjs';
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
import {
  automaticCover,
  uploadCover,
  ownedCover,
  coverResponse,
  releaseCovers,
} from './covers.mjs';
import { uploadVideo, videoResponse, videoLink } from './videos.mjs';
import { blobChoice, starterPreferences } from './blob-options.mjs';
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

function applyEdit(productId, edit) {
  run(
    "UPDATE products SET name=?,tagline=?,description=?,url=?,category=?,audience=?,pricing=?,source=?,facts=?,submission_details=?,cover_id=?,pending_edit='' WHERE id=?",
    edit.name,
    edit.tagline,
    edit.description,
    edit.url,
    edit.category,
    edit.audience,
    edit.pricing,
    edit.source,
    edit.facts,
    edit.submission_details,
    edit.cover_id,
    productId,
  );
}

export async function handle(req, segments) {
  const route = segments.join('/');
  try {
    ensureAdmin();
    if (req.method === 'GET') {
      const user = currentUser(req);
      if (segments.length === 2 && segments[0] === 'videos')
        return videoResponse(req, segments[1], user);
      if (segments.length === 2 && segments[0] === 'covers')
        return coverResponse(segments[1], user);
      if (route === 'bootstrap')
        return json({
          user: user
            ? { ...user, profile: creatorProfile(user.id), onboarding: onboardingState(user.id) }
            : null,
          products: listProducts(user?.id),
          catalogLabel: 'Independent product discoveries',
          source: 'Real products. Listings are not endorsements or partnerships.',
        });
      if (route.startsWith('products/')) {
        const slug = segments[1];
        const p = listProducts(user?.id).find((p) => p.slug === slug);
        if (!p) throw new AppError('Product not found.', 404);
        const comments = all(
          `SELECT c.id,c.body,c.created_at,c.parent_id,c.removed,u.name,u.id as user_id FROM comments c JOIN users u ON c.user_id=u.id
           WHERE c.product_id=? AND (c.id IN (SELECT id FROM comments WHERE product_id=? AND parent_id IS NULL ORDER BY created_at DESC LIMIT 100)
             OR c.parent_id IN (SELECT id FROM comments WHERE product_id=? AND parent_id IS NULL ORDER BY created_at DESC LIMIT 100))
           ORDER BY c.created_at DESC`,
          p.id,
          p.id,
          p.id,
        );
        return json({
          product: p,
          comments: comments.map((c) => {
            // A removed comment keeps its place so the replies under it still make sense.
            if (c.removed)
              return { id: c.id, parent_id: null, created_at: c.created_at, removed: true };
            const profile = creatorProfile(c.user_id);
            return {
              ...c,
              removed: false,
              profile: profile?.visible
                ? { name: profile.name, avatar: profile.avatar, blob: profile.blob }
                : null,
            };
          }),
        });
      }
      if (route.startsWith('profiles/')) {
        const record = get(
          'SELECT user_id FROM creator_profiles WHERE username=? AND visible=1',
          segments[1].toLowerCase(),
        );
        if (!record) throw new AppError('This profile is unavailable.', 404);
        const profile = creatorProfile(record.user_id);
        return json({
          profile,
          products: listProducts(user?.id).filter((p) => p.creator_username === profile.username),
        });
      }
      if (route === 'my-work') {
        const u = requireUser(req);
        return json({
          products: all(
            'SELECT * FROM products WHERE owner_id=? ORDER BY created_at DESC',
            u.id,
          ).map(withPendingEdit),
        });
      }
      if (route === 'studio') {
        requireUser(req, true);
        return json({
          products: all(
            'SELECT p.*,u.name as owner_name FROM products p LEFT JOIN users u ON p.owner_id=u.id ORDER BY p.created_at DESC',
          )
            .map(withPendingEdit)
            // An edit to live work joins the review queue; the live version stays up meanwhile.
            .map((p) => (p.pendingEdit ? { ...p, status: 'pending' } : p)),
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
    if (route === 'videos/upload')
      return json({ cover: await uploadVideo(req, requireUser(req).id) });
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
    if (route === 'videos/play') return json({ video: videoLink(String(body.id), user) });
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
        {
          user: {
            id: found.id,
            email: found.email,
            name: found.name,
            role: found.role,
            profile: creatorProfile(found.id),
            onboarding: onboardingState(found.id),
          },
        },
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
      let parent = null;
      if (body.parentId) {
        const target = get(
          'SELECT id,parent_id FROM comments WHERE id=? AND product_id=?',
          String(body.parentId),
          p.id,
        );
        if (!target) throw new AppError('That comment is no longer here.', 404);
        // Replies stay one level deep: answering a reply joins its thread.
        parent = target.parent_id || target.id;
      }
      run(
        'INSERT INTO comments(id,product_id,user_id,body,created_at,parent_id) VALUES (?,?,?,?,?,?)',
        id(),
        p.id,
        u.id,
        textField(body.body, 'Comment', 1500, 2),
        now(),
        parent,
      );
      return json({ ok: true });
    }
    if (route === 'comment/delete') {
      const u = requireUser(req);
      const c = get('SELECT * FROM comments WHERE id=?', String(body.id));
      if (!c || c.removed || !(c.user_id === u.id || u.role === 'admin'))
        throw new AppError('You cannot remove this comment.', 403);
      transaction(() => {
        if (get('SELECT id FROM comments WHERE parent_id=?', c.id))
          run("UPDATE comments SET removed=1,body='[removed]' WHERE id=?", c.id);
        else run('DELETE FROM comments WHERE id=?', c.id);
        // A removed comment with nothing left under it can go entirely.
        if (c.parent_id)
          run(
            'DELETE FROM comments WHERE id=? AND removed=1 AND NOT EXISTS (SELECT 1 FROM comments WHERE parent_id=?)',
            c.parent_id,
            c.parent_id,
          );
      });
      return json({ ok: true });
    }
    if (route === 'onboarding/skip') {
      const u = requireUser(req);
      creatorProfile(u.id);
      run('UPDATE creator_profiles SET setup_completed=1 WHERE user_id=?', u.id);
      return json({ onboarding: onboardingState(u.id) });
    }
    if (route === 'profile/save' || route === 'onboarding/complete') {
      const u = requireUser(req);
      if (
        body.avatarId &&
        get('SELECT id FROM video_assets WHERE cover_id=?', String(body.avatarId))
      )
        throw new AppError('Choose a still image for your profile photo.');
      const fields = profileFields(body);
      creatorProfile(u.id);
      let blob, preferences;
      try {
        blob = blobChoice(Object.hasOwn(body, 'blob') ? body.blob : creatorProfile(u.id).blob);
        preferences = starterPreferences(
          Object.hasOwn(body, 'preferences') ? body.preferences : onboardingState(u.id),
        );
      } catch (error) {
        throw new AppError(error.message);
      }
      if (
        get(
          'SELECT user_id FROM creator_profiles WHERE username=? AND user_id<>?',
          fields.username,
          u.id,
        )
      )
        throw new AppError('That username is taken. Try another.');
      const avatarId = ownedCover(body.avatarId, u.id);
      if (
        avatarId &&
        get('SELECT kind FROM product_covers WHERE id=?', avatarId)?.kind !== 'upload'
      )
        throw new AppError('Choose an uploaded profile photo.');
      transaction(() => {
        run('UPDATE users SET name=? WHERE id=?', fields.name, u.id);
        run(
          'UPDATE creator_profiles SET username=?,bio=?,specialty=?,instagram=?,website=?,color=?,visible=?,avatar_id=? WHERE user_id=?',
          fields.username,
          fields.bio,
          fields.specialty,
          fields.instagram,
          fields.website,
          fields.color,
          fields.visible ? 1 : 0,
          avatarId,
          u.id,
        );
        run(
          'UPDATE creator_profiles SET blob_avatar=?,setup_intent=?,setup_interests=?,setup_completed=CASE WHEN ? THEN 1 ELSE setup_completed END WHERE user_id=?',
          JSON.stringify(blob),
          preferences.intent,
          JSON.stringify(preferences.interests),
          route === 'onboarding/complete' ? 1 : 0,
          u.id,
        );
      });
      return json({ profile: creatorProfile(u.id), onboarding: onboardingState(u.id) });
    }
    if (route === 'submit' || route === 'works/update') {
      const u = requireUser(req);
      const existing =
        route === 'works/update'
          ? get('SELECT * FROM products WHERE id=? AND owner_id=?', String(body.id), u.id)
          : null;
      if (route === 'works/update' && !existing) throw new AppError('Work not found.', 404);
      if (
        existing &&
        get(
          "SELECT id FROM jobs WHERE product_id=? AND status IN ('publishing','rendering','needs_attention')",
          existing.id,
        )
      )
        throw new AppError(
          'This work has an active studio feature. Contact the studio before editing.',
        );
      rateLimit(
        `${existing ? 'edit' : 'submit'}:${u.id}`,
        existing ? 20 : 5,
        existing ? 3600000 : 86400_000,
      );
      const kind = body.kind || 'app';
      if (!['art', 'app'].includes(kind)) throw new AppError('Choose art or an app.');
      // Edits are touch-ups: a piece of art can't be turned into an app listing, or back.
      if (existing && kind !== (JSON.parse(existing.submission_details || '{}').kind || 'app'))
        throw new AppError('You can’t change what kind of work this is. Share it as a new post.');
      const art = kind === 'art';
      const name = textField(body.name, art ? 'Title' : 'Product name', 60);
      const chosenCategory = body.category || (art ? 'Art & design' : 'Design');
      const productId = id();
      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60) +
        '-' +
        productId.slice(0, 6);
      if (!categories.includes(chosenCategory))
        throw new AppError('Choose a category from the list.');
      if (!audiences.includes(body.audience || 'Everyone'))
        throw new AppError('Choose an audience from the list.');
      const category = chosenCategory,
        audience = body.audience || 'Everyone';
      const tagline = textField(body.tagline || (art ? category : ''), 'Tagline', 100);
      const url = art && !String(body.url || '').trim() ? '' : webUrl(body.url);
      const coverId =
        existing && body.coverId === existing.cover_id
          ? existing.cover_id
          : ownedCover(body.coverId, u.id);
      if (
        art &&
        (!coverId || get('SELECT kind FROM product_covers WHERE id=?', coverId)?.kind !== 'upload')
      )
        throw new AppError('Add a photo of your work before sending it.');
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
        ...creditFields(body),
        kind,
        imageDescription: textField(body.imageDescription || '', 'Image description', 400, 0),
        platforms: [...new Set(selectedPlatforms)],
        pricingModel: body.pricingModel || '',
        demoUrl: body.demoUrl ? webUrl(body.demoUrl, 'Demo URL') : '',
      };
      if (body.ownership !== true)
        throw new AppError('Confirm this is your work or you have permission to share it.');
      if (existing) {
        const edit = {
          name,
          tagline,
          description: textField(
            String(body.description || '').trim() || tagline,
            'Description',
            2000,
          ),
          url,
          category,
          audience,
          pricing: textField(
            art ? 'Creative work' : body.pricing || body.pricingModel || 'See current pricing',
            'Pricing',
            100,
          ),
          source: body.source ? webUrl(body.source, 'Source URL') : url,
          facts: JSON.stringify(facts),
          submission_details: JSON.stringify(submission),
          cover_id: coverId,
        };
        // Live work stays up while the edit waits for review; it's applied on approval.
        if (existing.status === 'published') {
          run(
            "UPDATE products SET pending_edit=?,review_note='' WHERE id=?",
            JSON.stringify(edit),
            existing.id,
          );
          audit(null, 'work_edit_submitted', existing.id);
          return json({ ok: true, slug: existing.slug, live: true });
        }
        transaction(() => {
          applyEdit(existing.id, edit);
          run(
            "UPDATE products SET status='pending',review_note='',reviewed_at=NULL,verified_at=NULL WHERE id=?",
            existing.id,
          );
          run(
            "UPDATE jobs SET status='archived',updated_at=? WHERE product_id=? AND status IN ('draft','rendered','approved','queued','render_pending','failed')",
            now(),
            existing.id,
          );
          audit(null, 'work_resubmitted', existing.id);
        });
        return json({ ok: true, slug: existing.slug });
      }
      creatorProfile(u.id);
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
        textField(
          art ? 'Creative work' : body.pricing || body.pricingModel || 'See current pricing',
          'Pricing',
          100,
        ),
        color,
        'spark',
        body.source ? webUrl(body.source, 'Source URL') : url,
        JSON.stringify(facts),
        u.id,
        now(),
        JSON.stringify(submission),
        coverId,
      );
      return json({ ok: true, slug });
    }
    if (route === 'works/delete') {
      const u = requireUser(req);
      const work = get('SELECT * FROM products WHERE id=? AND owner_id=?', String(body.id), u.id);
      if (!work) throw new AppError('Work not found.', 404);
      if (
        get(
          "SELECT id FROM jobs WHERE product_id=? AND status IN ('publishing','rendering','needs_attention')",
          work.id,
        )
      )
        throw new AppError(
          'This work has an active studio feature. Contact the studio before deleting.',
        );
      rateLimit(`delete:${u.id}`, 20, 3600000);
      transaction(() => {
        run('DELETE FROM saves WHERE product_id=?', work.id);
        run('DELETE FROM comments WHERE product_id=?', work.id);
        run('DELETE FROM events WHERE product_id=?', work.id);
        run('DELETE FROM jobs WHERE product_id=?', work.id);
        run('DELETE FROM products WHERE id=?', work.id);
        audit(null, 'work_deleted', work.id);
      });
      const pending = work.pending_edit ? JSON.parse(work.pending_edit).cover_id : null;
      releaseCovers([work.cover_id, pending], u.id);
      return json({ ok: true });
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
        // Reviewing an edit to live work acts on the edit; the live version stays put.
        const edit = p.pending_edit ? JSON.parse(p.pending_edit) : null;
        const art = JSON.parse((edit || p).submission_details || '{}').kind === 'art';
        if (body.action === 'verify') {
          if (!body.confirmed)
            throw new AppError('Confirm that you checked the listed facts against the source.');
          const coverId = edit ? edit.cover_id : p.cover_id;
          if (
            art &&
            (!coverId ||
              get('SELECT kind FROM product_covers WHERE id=?', coverId)?.kind !== 'upload')
          )
            throw new AppError('Artwork needs an uploaded image before approval.');
          transaction(() => {
            if (edit) applyEdit(p.id, edit);
            run(
              "UPDATE products SET status='published',verified_at=?,reviewed_at=?,review_note='' WHERE id=?",
              now(),
              now(),
              p.id,
            );
          });
        } else if (edit && (body.action === 'reject' || body.action === 'changes')) {
          run(
            "UPDATE products SET pending_edit='',review_note=?,reviewed_at=? WHERE id=?",
            textField(
              body.feedback ||
                (body.action === 'reject'
                  ? 'These edits were not accepted. Your post is unchanged.'
                  : ''),
              'Feedback',
              1000,
              3,
            ),
            now(),
            p.id,
          );
        } else if (body.action === 'reject' || body.action === 'changes') {
          const note = textField(
            body.feedback ||
              (body.action === 'reject' ? 'This work was not selected for publication.' : ''),
            'Feedback',
            1000,
            3,
          );
          run(
            'UPDATE products SET status=?,review_note=?,reviewed_at=? WHERE id=?',
            body.action === 'changes' ? 'needs_changes' : 'rejected',
            note,
            now(),
            p.id,
          );
          run(
            "UPDATE jobs SET status='archived',updated_at=? WHERE product_id=? AND status IN ('draft','rendered','approved','queued','render_pending','failed')",
            now(),
            p.id,
          );
        } else if (body.action === 'cover') {
          const coverId = ownedCover(body.coverId, admin.id);
          if (
            art &&
            (!coverId ||
              get('SELECT kind FROM product_covers WHERE id=?', coverId)?.kind !== 'upload')
          )
            throw new AppError('Replace artwork with an uploaded image.');
          if (edit)
            run(
              'UPDATE products SET pending_edit=? WHERE id=?',
              JSON.stringify({ ...edit, cover_id: coverId }),
              p.id,
            );
          else run('UPDATE products SET cover_id=? WHERE id=?', coverId, p.id);
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
