import 'server-only'
import { cache } from 'react'
import { restHeaders, restTumSatirlar, supabaseReady } from '@/lib/supabase'
import { sanatciSlug } from '@/text/sanatci'

/**
 * Sanatçı modu için sanatçı listesi — sanatçı sayfaları ve site haritası.
 *
 * ⚠️ Gruplama NORMALIZE AD üzerinden (`norm_artist` → `sanatciSlug`), istemcinin
 * havuzu süzdüğü anahtarla BİREBİR aynı (`useRound`). Görüntü adına göre
 * gruplansaydı sayfa "184 şarkı" yazıp oyun daha azını açabilirdi.
 *
 * ⚠️ Yalnızca `artist,norm_artist` kolonları çekiliyor: 15K satırda ~600 KB;
 * `havuz` etiketiyle önbellekte, panelden kayıt olunca tazeleniyor. `cache()`
 * aynı istek içinde (sayfa + metadata + statik parametreler) tekrar okumayı
 * önlüyor.
 */

export interface Sanatci {
  slug: string
  /** En sık kullanılan görüntü yazımı. */
  ad: string
  sayi: number
}

/**
 * Sanatçı modu için en az şarkı sayısı. Ölçüldü: 15'te 146 sanatçı. Daha azında
 * aynı şarkılar birkaç turda tekrar eder ve "hayran testi" iddiası boşa çıkar.
 */
export const SANATCI_ESIK = 15

export const sanatcilariGetir = cache(async (): Promise<Sanatci[]> => {
  if (!supabaseReady) return []

  let satirlar: { artist: string; norm_artist: string }[]
  try {
    satirlar = await restTumSatirlar<{ artist: string; norm_artist: string }>(
      'songs?select=artist,norm_artist&enabled=eq.true&order=id.asc',
      {
        headers: restHeaders() as Record<string, string>,
        next: { revalidate: 3600, tags: ['havuz'] },
      },
    )
  } catch {
    // Liste süs değil ama kesinti sayfayı çökertmemeli: boş liste, 404'e düşen sayfalar.
    return []
  }

  const gruplar = new Map<string, { sayi: number; adlar: Map<string, number> }>()
  for (const r of satirlar) {
    const slug = sanatciSlug(r.norm_artist)
    if (!slug) continue
    const g = gruplar.get(slug) ?? { sayi: 0, adlar: new Map<string, number>() }
    g.sayi++
    g.adlar.set(r.artist, (g.adlar.get(r.artist) ?? 0) + 1)
    gruplar.set(slug, g)
  }

  return [...gruplar]
    .filter(([, g]) => g.sayi >= SANATCI_ESIK)
    .map(([slug, g]) => ({
      slug,
      sayi: g.sayi,
      ad: [...g.adlar].sort((a, b) => b[1] - a[1])[0]![0],
    }))
    .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, 'tr'))
})

export async function sanatciBul(slug: string): Promise<Sanatci | null> {
  return (await sanatcilariGetir()).find((s) => s.slug === slug) ?? null
}
