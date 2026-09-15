import type { CategoryId, Difficulty } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import { albumAnahtarlari, albumTemizle } from '@/text/album'
import { cleanKey } from '@/text/keys'

/**
 * Şarkı satırlarını Kapaktan Albüm kayıtlarına indirir — saf, testli.
 *
 * ⚠️ Rota dosyasında DEĞİL: Next rota dosyalarından yalnızca tanıdığı adların
 * (`GET`, `generateStaticParams`…) dışa aktarılmasına izin veriyor; buradan
 * aktarılan bir yardımcı tip denetiminde ve derlemede hata veriyordu.
 *
 * ⚠️ ALBÜM KİMLİĞİ `store_url`'den: `…/album/<ad>/<albüm kimliği>?i=<şarkı>`.
 * Albüm adına göre gruplamak, farklı sanatçıların aynı adlı albümlerini ("Aşk")
 * tek kayda düşürürdü.
 */

export interface KapakSatiri {
  id: string
  artist: string
  album: string | null
  store_url: string
  year: number
  tier: number
  category: string
  norm_artist: string
}

/** Kapağı tanıtmayan kayıtlar: derlemeler ve karaoke. */
const DERLEME = /\b(karaoke|various artists|greatest hits|best of|the very best|en iyileri|koleksiyon|collection)\b/i

const ALBUM_KIMLIGI = /\/album\/[^/?#]+\/(\d+)/

export function grupla(rows: KapakSatiri[]): Kapak[] {
  const gruplar = new Map<string, { temsilci: KapakSatiri; kademe: number; yil: number }>()

  for (const r of rows) {
    if (!r.album) continue
    const kimlik = r.store_url.match(ALBUM_KIMLIGI)?.[1]
    if (!kimlik) continue
    const g = gruplar.get(kimlik)
    if (!g) {
      gruplar.set(kimlik, { temsilci: r, kademe: r.tier, yil: r.year })
    } else {
      // En tanınan şarkı albümü tanıtır; en erken yıl albümün yılıdır.
      g.kademe = Math.min(g.kademe, r.tier)
      g.yil = Math.min(g.yil, r.year)
    }
  }

  const out: Kapak[] = []
  for (const [kimlik, g] of gruplar) {
    const ham = g.temsilci.album!
    const al = albumTemizle(ham)
    const k = albumAnahtarlari(al)
    if (k.length === 0 || DERLEME.test(ham)) continue
    out.push({
      id: `kapak:${kimlik}`,
      sid: g.temsilci.id,
      al,
      a: g.temsilci.artist,
      y: g.yil,
      d: Math.max(1, Math.min(5, g.kademe)) as Difficulty,
      c: g.temsilci.category as CategoryId,
      nT: cleanKey(al),
      nA: g.temsilci.norm_artist,
      k,
      ks: g.temsilci.norm_artist ? [g.temsilci.norm_artist] : [],
    })
  }
  return out
}
