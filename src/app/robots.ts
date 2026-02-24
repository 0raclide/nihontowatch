import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og'],
        disallow: [
          '/admin/',
          '/api/',
          '/saved',
          '/profile',
          '/auth/',
          '/favorites',
          '/saved-searches',
          '/alerts',
          '/collection',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
