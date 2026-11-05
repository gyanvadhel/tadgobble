// Emails for tadgobble: what they say, the signed unsubscribe link, and the loop that sends the queue.
// Plain JS on Web Crypto only, so Deno (Edge Functions) and Node (tests) both run it.

const DEFAULT_SITE = 'https://tadgobble.in';
const CREAM = '#fdf6e9';
const INK = '#2a2118';
const PLUM = '#6b3fa0';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const oneLine = (value) => String(value ?? '').split(/\s+/).join(' ').trim();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function content(row, site) {
  const data = row.data || {};
  const name = row.product?.name || 'your work';
  const link = row.product?.slug ? `${site}/product/${encodeURIComponent(row.product.slug)}` : `${site}/my-work`;
  const edit = !!data.edit;
  const note = oneLine(data.note) && String(data.note).trim();
  switch (row.kind) {
    case 'first_save':
      return {
        subject: 'Someone saved your work 💜',
        heading: 'Someone saved your work 💜',
        lines: [
          `Pehli baar? Perfect. Someone on tadgobble just saved ${name}.`,
          'Savers stay anonymous, but now you know it is landing.',
        ],
        button: 'See your work',
        href: link,
      };
    case 'comment':
      return {
        subject: `${oneLine(data.actor) || 'Someone'} commented on ${name}`,
        heading: `${oneLine(data.actor) || 'Someone'} commented on ${name}`,
        lines: [],
        quote: data.preview,
        button: 'Read and reply',
        href: link,
      };
    case 'review': {
      const out = data.outcome;
      if (out === 'approved')
        return {
          subject: edit ? `Your edit to ${name} is live` : `${name} is live on tadgobble`,
          heading: edit ? `Your edit to ${name} is live` : `${name} is live`,
          lines: [edit ? 'The new version is out for everyone to see.' : 'Everyone can find it now. Go say hi.'],
          button: 'See it live',
          href: link,
        };
      if (out === 'changes')
        return {
          subject: edit ? `A small change to your edit of ${name}` : `A small change before ${name} goes live`,
          heading: edit ? `A small change to your edit of ${name}` : `A small change before ${name} goes live`,
          lines: ['We looked it over and need one thing before it can go up.'],
          quote: note || null,
          button: 'Make the change',
          href: link,
        };
      return {
        subject: edit ? `About your edit to ${name}` : `About ${name}`,
        heading: edit ? `About your edit to ${name}` : `About ${name}`,
        lines: ["We couldn't put this one up."],
        quote: note || null,
        button: 'See details',
        href: link,
      };
    }
    case 'roundup': {
      const saves = Number(data.saves) || 0;
      const comments = Number(data.comments) || 0;
      const replies = Number(data.replies) || 0;
      const works = Array.isArray(data.works) ? data.works : [];
      return {
        subject: 'Your week on tadgobble',
        heading: 'Your week on tadgobble',
        lines: [`${plural(saves, 'save')}, ${plural(comments, 'comment')} and ${plural(replies, 'reply')} this week.`],
        works: works.map((w) => ({
          name: w.name,
          href: `${site}/product/${encodeURIComponent(w.slug)}`,
          summary: `${plural(Number(w.saves) || 0, 'save')}, ${plural(Number(w.comments) || 0, 'comment')}, ${plural(Number(w.replies) || 0, 'reply')}`,
        })),
        button: 'Open your work',
        href: `${site}/my-work`,
      };
    }
    case 'admin_queue': {
      const what = { new: 'sent a new work', edit: 'edited a live work', resubmission: 'sent a work back after changes' }[data.what] || 'sent something';
      return {
        subject: `New in the review queue: ${oneLine(data.name)}`,
        heading: `New in the review queue: ${oneLine(data.name)}`,
        lines: [`${oneLine(data.maker) || 'A maker'} ${what}.`],
        button: 'Open the studio',
        href: `${site}/studio`,
      };
    }
    default:
      return { subject: 'tadgobble', heading: 'tadgobble', lines: [], button: 'Open tadgobble', href: site };
  }
}

export function renderEmail(row, { site = DEFAULT_SITE, unsubscribeUrl = null } = {}) {
  const c = content(row, site);
  const subject = oneLine(c.subject);
  const hello = row.name && row.kind !== 'admin_queue' ? `Hi ${row.name},` : '';
  const footerText = unsubscribeUrl
    ? `You're getting this because you post on tadgobble. Turn these off: ${unsubscribeUrl} · Settings: ${site}/settings`
    : '';

  const para = (s) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55">${escapeHtml(s)}</p>`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};color:${INK};font-family:Georgia,'Times New Roman',serif">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 22px;font-size:15px;letter-spacing:.04em;color:${PLUM}">tadgobble</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25">${escapeHtml(c.heading)}</h1>
${hello ? para(hello) : ''}${c.lines.map(para).join('')}${
    c.quote ? `<blockquote style="margin:0 0 18px;padding:10px 14px;border-left:3px solid ${PLUM};background:#fff8ec;font-size:16px;line-height:1.5">${escapeHtml(c.quote)}</blockquote>` : ''
  }${
    c.works?.length
      ? `<ul style="margin:0 0 18px;padding-left:20px">${c.works
          .map((w) => `<li style="margin:0 0 6px"><a href="${escapeHtml(w.href)}" style="color:${PLUM}">${escapeHtml(w.name)}</a> — ${escapeHtml(w.summary)}</li>`)
          .join('')}</ul>`
      : ''
  }
<p style="margin:22px 0 28px"><a href="${escapeHtml(c.href)}" style="display:inline-block;background:${PLUM};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:16px">${escapeHtml(c.button)}</a></p>
${
    unsubscribeUrl
      ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#7a6a58">You're getting this because you post on tadgobble. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#7a6a58">Turn these off</a> · <a href="${escapeHtml(site)}/settings" style="color:#7a6a58">Settings</a></p>`
      : ''
  }
</div></body></html>`;

  const text = [
    c.heading,
    hello,
    ...c.lines,
    c.quote ? `"${String(c.quote).trim()}"` : '',
    ...(c.works || []).map((w) => `- ${w.name} (${w.summary}): ${w.href}`),
    `${c.button}: ${c.href}`,
    footerText,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { subject, html, text };
}

// ---- Signed unsubscribe links: "<userId>.<base64url HMAC-SHA256(userId)>" ----

const encoder = new TextEncoder();
const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = async (message, secret) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
};

export async function signUnsubscribe(userId, secret) {
  return `${userId}.${await hmac(userId, secret)}`;
}

export async function verifyUnsubscribe(token, secret) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;
  const userId = token.slice(0, dot);
  const given = encoder.encode(token.slice(dot + 1));
  const expected = encoder.encode(await hmac(userId, secret));
  if (given.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given[i] ^ expected[i];
  return diff === 0 ? userId : null;
}

// ---- Sending the queue ----

// Sends one batch. A failure on one row is recorded against that row only; the rest still go out.
export async function drainOutbox({ claim, done, send, render, unsubscribeUrlFor, adminEmail, pauseMs = 0, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const rows = await claim();
  let sent = 0;
  let failed = 0;
  const finish = async (id, error) => {
    try {
      await done(id, error);
    } catch {
      // The row stays queued and is tried again; the rest of the batch carries on.
    }
  };
  let first = true;
  for (const row of rows) {
    // Resend allows about two requests a second; a short gap keeps a big batch from being rejected.
    if (!first && pauseMs > 0) await sleep(pauseMs);
    first = false;
    try {
      const maker = !!row.to;
      const unsubscribeUrl = maker ? await unsubscribeUrlFor(row.user) : null;
      const { subject, html, text } = render(row, { unsubscribeUrl });
      const headers = maker
        ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : {};
      await send({ to: row.to || adminEmail, subject, html, text, headers });
    } catch (error) {
      failed++;
      await finish(row.id, String(error?.message || error).slice(0, 500));
      continue;
    }
    sent++;
    await finish(row.id, null);
  }
  return { sent, failed };
}

// One tick of the cron job: queue the weekly roundup if due, then send. A broken roundup must never stop other mail.
export async function runCycle({ roundup, drain }) {
  let queued = 0;
  let roundupError;
  try {
    queued = Number(await roundup()) || 0;
  } catch (error) {
    roundupError = String(error?.message || error).slice(0, 300);
  }
  const { sent, failed } = await drain();
  return roundupError ? { queued, sent, failed, roundupError } : { queued, sent, failed };
}

// The page behind the unsubscribe link. Opening the link only asks; the button does it,
// so mail scanners that prefetch links cannot unsubscribe anyone.
export function unsubscribePage(kind) {
  const body =
    kind === 'ask'
      ? `Stop emailing you about your work?</p><form method="post"><button type="submit" style="font:inherit;font-size:16px;padding:10px 18px;border:1px solid #2a2118;border-radius:999px;background:#6b3fa0;color:#fff;cursor:pointer">Yes, stop emailing me</button></form><p>`
      : 'Done. Gobble will stop emailing you. You can turn emails back on in Settings.';
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>tadgobble</title></head>' +
    "<body style=\"margin:0;background:#fdf6e9;color:#2a2118;font-family:Georgia,'Times New Roman',serif\">" +
    '<main style="max-width:480px;margin:0 auto;padding:64px 20px"><p style="color:#6b3fa0;letter-spacing:.04em">tadgobble</p>' +
    `<p style="font-size:20px;line-height:1.5">${body}</p>` +
    '<p><a href="https://tadgobble.in/settings" style="color:#6b3fa0">Open Settings</a></p></main></body></html>'
  );
}
