import type { MetadataRoute } from 'next'
import { CHIPS } from '@/data/categories'
import { sanatcilariGetir } from '@/lib/sanatcilar'
import { SITE_URL } from '@/lib/siteUrl'

/** Sanatçı listesi havuzla birlikte tazeleniyor; site haritası da saatte bir. */
export const revalidate = 3600

/**
 * ⚠️ Alan adı SABİT KODLANMAZ. Önceden burada `tahmin.in` yazılıydı, yani her
 * Vercel önizlemesi canlı adresi işaret eden bir sitemap yayınlıyordu.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const sanatcilar = await sanatcilariGetir()

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${SITE_URL}/unlu`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/kapak`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gunluk`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gizlilik`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/yayin`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    ...CHIPS.map((c) => ({
      url: `${SITE_URL}/seckiler/${c.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/sanatci`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...sanatcilar.map((s) => ({
      url: `${SITE_URL}/sanatci/${s.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
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
