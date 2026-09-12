import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    // ⚠️ `/paylas/` her tur için ayrı bir URL doğuruyor; sayfaların kendi
    // metadata'sında `noindex` var ama taramayı da boşa harcatmanın anlamı yok.
    rules: { userAgent: '*', allow: '/', disallow: ['/dev/', '/yonetim', '/paylas/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
