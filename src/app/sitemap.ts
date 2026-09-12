import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://tahmin.net'
  const now = new Date()
  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/nasil-oynanir`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/hakkinda`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]
}
