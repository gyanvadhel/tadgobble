// One HTML file per public maker profile; newer profiles open through /profile.html.
import CreatorPage from '../../../../components/creator-pages';
import { placeholder, readCatalog, StaticProfile } from '../../../static-copy';
import { brand } from '../../../../lib/brand.mjs';

export const dynamicParams = false;
const find = async (params) => {
  const { username } = await params;
  return readCatalog().profiles.find((m) => m.username === username);
};

export function generateStaticParams() {
  const { profiles } = readCatalog();
  return profiles.length
    ? profiles.map((m) => ({ username: m.username }))
    : [{ username: placeholder }];
}

export async function generateMetadata({ params }) {
  const m = await find(params);
  if (!m) return { title: brand.searchTitle };
  const title = `${m.name || m.username} (@${m.username}) | ${brand.name}`;
  const description =
    [m.specialty, m.bio].filter(Boolean).join('. ').slice(0, 200) ||
    `${m.name || m.username} shares their work on ${brand.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/profile/${m.username}` },
    openGraph: { title, description, type: 'profile', url: `/profile/${m.username}` },
    twitter: { title, description },
  };
}

export default async function Page({ params }) {
  const m = await find(params);
  return (
    <>
      {m && <StaticProfile profile={m} />}
      <CreatorPage />
    </>
  );
}
