const WEEK = 7 * 86400000;

// "new" badge: posted within the last 7 days. Bad or future dates are never new.
export function isNew(createdAt, now = Date.now()) {
  const time = Date.parse(createdAt ?? '');
  if (Number.isNaN(time)) return false;
  const age = now - time;
  return age >= 0 && age <= WEEK;
}

// Newest first, regardless of featured status.
export function freshProducts(products) {
  return [...products].sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
}
