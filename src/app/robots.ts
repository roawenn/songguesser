import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/dev/' },
    sitemap: 'https://nakarat.app/sitemap.xml',
    host: 'https://nakarat.app',
  }
}
