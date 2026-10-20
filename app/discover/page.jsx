import Platform from '../../components/platform';
import { brand } from '../../lib/brand.mjs';
export const metadata = { title: `The good stuff — ${brand.name}` };
export default function Page() {
  return <Platform />;
}
