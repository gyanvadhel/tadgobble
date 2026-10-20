import Platform from '../../../components/platform';
import { get } from '../../../lib/db.mjs';
import { brand } from '../../../lib/brand.mjs';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }) {
  const p = get("SELECT * FROM products WHERE slug=? AND status='published'", (await params).slug);
  return {
    title: p ? `${p.name} — ${brand.name}` : `Product not found — ${brand.name}`,
    description: p?.description,
  };
}
export default async function Page({ params }) {
  return <Platform initialSlug={(await params).slug} />;
}
