import type { MetadataRoute } from 'next'
import { CHIPS } from '@/data/categories'
import { SITE_URL } from '@/lib/siteUrl'

/**
 * ⚠️ Alan adı SABİT KODLANMAZ. Önceden burada `tahmin.net` yazılıydı, yani her
 * Vercel önizlemesi canlı adresi işaret eden bir sitemap yayınlıyordu.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${SITE_URL}/unlu`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    ...CHIPS.map((c) => ({
      url: `${SITE_URL}/seckiler/${c.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/nasil-oynanir`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/hakkinda`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
  ]
}
