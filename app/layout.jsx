import './globals.css';
import { brand } from '../lib/brand.mjs';
export const metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://127.0.0.1:3000'),
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.description,
  openGraph: {
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    type: 'website',
    siteName: brand.name,
    images: [{ url: '/social-card.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@tadgobble',
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    images: ['/social-card.png'],
  },
};
// Tells search engines who tadgobble is, so the brand name ties to the site, logo and X account.
const site = 'https://tadgobble.in';
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${site}/#organization`,
      name: brand.name,
      url: site,
      logo: `${site}/brand/tadgobble-logo.png`,
      description: brand.description,
      email: 'hello@tadgobble.in',
      sameAs: ['https://x.com/tadgobble'],
    },
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      name: brand.name,
      url: site,
      publisher: { '@id': `${site}/#organization` },
    },
  ],
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/font-1.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/font-2.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
