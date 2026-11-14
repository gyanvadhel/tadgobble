import { CloudLanding } from '../components';
import { StaticCatalog } from '../static-copy';
export const metadata = { alternates: { canonical: '/' } };
export default function Page() {
  return (
    <>
      <StaticCatalog />
      <CloudLanding />
    </>
  );
}
