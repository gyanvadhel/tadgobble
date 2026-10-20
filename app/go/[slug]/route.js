import { get } from '../../../lib/db.mjs';
import { recordEvent, visitorCookie } from '../../../lib/api.mjs';
import { brand } from '../../../lib/brand.mjs';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }) {
  const p = get("SELECT * FROM products WHERE slug=? AND status='published'", (await params).slug);
  if (!p) return new Response('Product not found', { status: 404 });
  const input = new URL(req.url);
  const visitor = recordEvent(req, {
    kind: 'outbound',
    productId: p.id,
    source: input.searchParams.get('source') || 'website',
    campaign: input.searchParams.get('campaign') || '',
  });
  const destination = new URL(p.url);
  destination.searchParams.set('utm_source', brand.slug);
  destination.searchParams.set('utm_medium', 'discovery');
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.href,
      'Set-Cookie': visitorCookie(visitor),
      'Cache-Control': 'no-store',
    },
  });
}
