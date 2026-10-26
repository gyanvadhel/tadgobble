// Shared by the submission UI, server validation, public filters, and review tools.
export const artCategories = [
  'Art & design',
  'Painting',
  'Drawing & sketching',
  'Illustration',
  'Graphic design',
  'UI & UX design',
  '3D & animation',
  'Photography',
  'Crafts & sculpture',
  'Fashion & textiles',
  'Architecture',
  'Other creative work',
];
export const appCategories = [
  'AI assistants',
  'Automation',
  'Design',
  'Developer tools',
  'Productivity',
  'Writing',
  'Marketing',
  'Sales & CRM',
  'Business',
  'Data & analytics',
  'No-code',
  'Video',
  'Audio & music',
  'Photography',
  'Education',
  'Research',
  'Finance',
  'Health & wellness',
  'Games',
  'Play',
  'Lifestyle',
  'Community',
];
export const categories = [...new Set([...artCategories, ...appCategories])];
export const isArtwork = (work) => work.submission?.kind === 'art';
export const workImageAlt = (work) =>
  work.submission?.imageDescription || (isArtwork(work) ? work.name : `${work.name} preview`);
export const audiences = [
  'Everyone',
  'Creators',
  'Businesses',
  'Developers',
  'Freelancers',
  'Students',
  'Educators',
  'Teams',
];
export const platforms = [
  'Web app',
  'iOS',
  'Android',
  'Desktop app',
  'Browser extension',
  'API',
  'Command line',
];
export const pricingModels = [
  'Free',
  'Free plan + paid upgrades',
  'Free trial',
  'Paid subscription',
  'One-time purchase',
  'Pay what you want',
];
export const productColors = [
  { value: 'lilac', name: 'Lavender', hex: '#c5b5f5' },
  { value: 'blue', name: 'Sky', hex: '#bfdcf5' },
  { value: 'rose', name: 'Pink', hex: '#f9b7cb' },
  { value: 'lime', name: 'Lime', hex: '#d5f568' },
  { value: 'peach', name: 'Peach', hex: '#ffab7d' },
  { value: 'mint', name: 'Mint', hex: '#b8dac7' },
];
