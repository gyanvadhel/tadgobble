import Platform from '../../components/platform';
import { brand } from '../../lib/brand.mjs';
export const metadata = {
  title: `The good stuff — ${brand.name}`,
  alternates: { canonical: '/discover' },
};
export default function Page() {
  return <Platform />;
}
