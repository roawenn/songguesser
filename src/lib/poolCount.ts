import 'server-only'
import { chipById, type ChipId } from '@/data/categories'
import { restUrl, restHeaders, supabaseReady } from '@/lib/supabase'

/**
 * Bir seçkideki AÇIK şarkı sayısı — seçki giriş sayfalarının içeriği için.
 *
 * ⚠️ Satırların kendisi ÇEKİLMEZ. `Prefer: count=exact` + `Range: 0-0` ile
 * yalnızca `content-range` başlığındaki toplam okunur; 300 şarkılık bir gövdeyi
 * sayı için indirmenin anlamı yok.
 *
 * ⚠️ `tags: ['havuz']` bilinçli: panelden şarkı eklenince oyunun havuzuyla
 * birlikte bu sayı da tazelenir, yoksa giriş sayfası aylarca eski sayıyı yazar.
 */
export async function songCount(chip: ChipId): Promise<number | null> {
  if (!supabaseReady) return null

  const source = chipById(chip).source
  const params = new URLSearchParams({ select: 'id', enabled: 'eq.true' })
  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)

  try {
    const res = await fetch(restUrl(`songs?${params}`), {
      headers: { ...restHeaders(), Prefer: 'count=exact', Range: '0-0' },
      next: { revalidate: 3600, tags: ['havuz'] },
    })
    if (!res.ok) return null

    // Biçim: "0-0/321" — ya da hiç satır yoksa "*/0".
    const toplam = res.headers.get('content-range')?.split('/')[1]
    const n = Number(toplam)
    return Number.isFinite(n) ? n : null
  } catch {
    // Sayı süs; Supabase'e ulaşılamıyorsa sayfa sayısız basılır.
    return null
  }
}
