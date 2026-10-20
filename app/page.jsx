import Launch from '../components/launch';
import { listProducts } from '../lib/db.mjs';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }) {
  const params = await searchParams;
  // Keep saved collections and existing Instagram links working after the move.
  if (params.from || params.saved || params.submit || params.signin || params.privacy) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    redirect(`/discover?${query}`);
  }
  return <Launch products={listProducts().map(({ owner_id, ...product }) => product)} />;
}
