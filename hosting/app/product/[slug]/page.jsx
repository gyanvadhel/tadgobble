// One HTML file per published work, so its link opens with the work's own text.
// Works published after the last deploy still open through /product.html.
import { CloudProduct } from '../../../components';
import { placeholder, readCatalog, StaticWork } from '../../../static-copy';
import { workSummary } from '../../../../lib/public-catalog.mjs';
import { brand } from '../../../../lib/brand.mjs';

export const dynamicParams = false;
const find = async (params) => {
  const { slug } = await params;
  return readCatalog().products.find((p) => p.slug === slug);
};

export function generateStaticParams() {
  const { products } = readCatalog();
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: placeholder }];
}

export async function generateMetadata({ params }) {
  const p = await find(params);
  if (!p) return { title: brand.searchTitle };
  const title = `${p.name}${p.owner_name ? ` by ${p.owner_name}` : ''} | ${brand.name}`;
  const description = workSummary(p) || brand.description;
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title, description, type: 'article', url: `/product/${p.slug}` },
    twitter: { title, description },
  };
}

export default async function Page({ params }) {
  const p = await find(params);
  return (
    <>
      {p && <StaticWork product={p} />}
      <CloudProduct />
    </>
  );
}
