import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run, id, now, transaction } from './db.mjs';
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
export function rateLimit(key, max = 20, windowMs = 60_000) {
  const t = Date.now();
  transaction(() => {
    const row = get('SELECT * FROM rate_limits WHERE key=?', key);
    if (!row || row.reset_at < t)
      run('INSERT OR REPLACE INTO rate_limits VALUES (?,?,?)', key, 1, t + windowMs);
    else {
      if (row.count >= max) throw new AppError('Please slow down and try again shortly.', 429);
      run('UPDATE rate_limits SET count=count+1 WHERE key=?', key);
    }
  });
}
export function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return;
  if (!get('SELECT id FROM users WHERE email=?', email))
    run(
      'INSERT INTO users VALUES (?,?,?,?,?,?)',
      id(),
      email,
      'Studio owner',
      hashPassword(password),
      'admin',
      now(),
    );
}
export const digest = (v) => createHash('sha256').update(v).digest('hex');
export function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  run(
    'INSERT INTO sessions VALUES (?,?,?)',
    digest(token),
    userId,
    new Date(Date.now() + 30 * 86400_000).toISOString(),
  );
  return token;
}
export function cookie(req, name) {
  const v = (req.headers.get('cookie') || '')
    .split(';')
    .find((v) => v.trim().startsWith(name + '='));
  return v?.trim().slice(name.length + 1);
}
export function currentUser(req) {
  const token = cookie(req, 'ap_session');
  return token
    ? get(
        'SELECT u.id,u.email,u.name,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?',
        digest(token),
        now(),
      ) || null
    : null;
}
export function requireUser(req, admin = false) {
  const u = currentUser(req);
  if (!u) throw new AppError('Sign in to continue.', 401);
  if (admin && u.role !== 'admin') throw new AppError('Studio access is required.', 403);
  return u;
}
export function sessionCookie(token, remove = false) {
  return `ap_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${remove ? 0 : 30 * 86400}${process.env.APP_URL?.startsWith('https:') ? '; Secure' : ''}`;
}
export function checkOrigin(req) {
  const origin = req.headers.get('origin');
  const allowed = new URL(process.env.APP_URL || 'http://127.0.0.1:3000').origin;
  if (origin !== allowed) throw new AppError('This request must come from the application.', 403);
}
export function textField(value, name, max = 500, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new AppError(`${name} must be between ${min} and ${max} characters.`);
  return value.trim();
}
export function webUrl(value, name = 'URL') {
  const raw = textField(value, name, 2000);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(`${name} must be a valid URL.`);
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new AppError(`${name} must be an HTTP or HTTPS URL without credentials.`);
  return url.href;
}
