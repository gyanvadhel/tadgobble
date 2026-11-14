import Platform from '../../../components/platform';
import { StaticCatalog } from '../../static-copy';
export { metadata } from '../../../app/discover/page';
export default function Page() {
  return (
    <>
      <StaticCatalog heading="Discover new work on tadgobble" />
      <Platform />
    </>
  );
}
