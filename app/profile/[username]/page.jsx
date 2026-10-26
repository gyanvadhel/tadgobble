import CreatorPage from '../../../components/creator-pages';
export default async function Page({ params }) { const { username } = await params; return <CreatorPage username={username} />; }
