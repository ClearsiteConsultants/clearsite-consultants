import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
}

// ─── SEO defaults — update these to change site-wide meta content ─────────────
const SITE = {
  baseUrl: 'https://clearsiteconsultants.com',
  name: 'ClearSite Consultants',
  defaultTitle: 'ClearSite Consultants - Affordable Custom Technology for Small Businesses',
  defaultDescription:
    'ClearSite Consultants builds professional websites, mobile apps, and AI automation solutions for small businesses at flat, affordable rates. Based in Eagle Mountain, UT — serving clients remotely nationwide.',
  defaultImage: '/og-image.png', // place a 1200×630 image in /public for social sharing
  twitterHandle: '@clearsiteconsultants',
  telephone: '+18017091872',
  email: 'hello@clearsiteconsultants.com',
  address: {
    locality: 'Eagle Mountain',
    region: 'UT',
    country: 'US',
  },
};
// ─────────────────────────────────────────────────────────────────────────────

const SEO = ({
  title,
  description,
  image = SITE.defaultImage,
  type = 'website',
}: SEOProps) => {
  const location = useLocation();
  const currentUrl = `${SITE.baseUrl}${location.pathname}`;

  const seoTitle = title || SITE.defaultTitle;
  const seoDescription = description || SITE.defaultDescription;
  const seoImage = image.startsWith('http') ? image : `${SITE.baseUrl}${image}`;

  // Structured data — LocalBusiness + ProfessionalService
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    name: SITE.name,
    image: seoImage,
    description: SITE.defaultDescription,
    url: SITE.baseUrl,
    telephone: SITE.telephone,
    email: SITE.email,
    priceRange: '$–$$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    serviceType: [
      'Small Business Website Design',
      'E-Commerce Development',
      'Custom Mobile App Development',
      'AI Automation & Lead Generation',
      'Online Scheduling Integration',
      'Custom Software Development',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Technology Services for Small Businesses',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Basic Business Website',
            description: 'Professional, mobile-friendly website optimized for Google search',
          },
          price: '500',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Feature-Rich Website or App',
            description:
              'Full-featured website or app with e-commerce, scheduling, customer tracking, and more',
          },
          price: '2000',
          priceCurrency: 'USD',
        },
      ],
    },
  };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seoTitle}</title>
      <meta name="title" content={seoTitle} />
      <meta name="description" content={seoDescription} />
      <meta name="author" content={SITE.name} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:site_name" content={SITE.name} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      {/* Structured Data */}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
};

export default SEO;
