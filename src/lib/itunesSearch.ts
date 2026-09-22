import { cleanKey } from '@/text/keys'
import type { Difficulty } from '@/data/categories'

/**
 * iTunes Search API sarmalayıcısı — yönetim panelinin ortak arama katmanı.
 *
 * ⚠️ Anahtar yok, ama dakikada ~20 istek sınırı var ve aşılınca 429 değil
 * **403** döner. Bu yüzden her sorgu bir saat önbelleğe alınır; sanatçı
 * taraması da sanatçı başına TEK istek atar.
 */

import { DEFAULT_CLIP_START } from '@/audio/envelope'

export { DEFAULT_CLIP_START }
export const PREVIEW_DURATION = 29

const JUNK_RE =
  /\b(karaoke|tribute|made famous by|cover version|originally performed|enstr[uü]mantal|instrumental|h[ıi]zland[ıi]r[ıi]lm[ıi][sş]|slowed|sped up|nightcore|8d audio)\b/i

interface ITunesResult {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  collectionArtistName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  releaseDate?: string
}

export interface FoundTrack {
  trackId: number
  title: string
  artist: string
  artwork: string
  preview: string
  storeUrl: string
  year: number
  /** iTunes albüm adı, HAM hâliyle — Kapaktan Albüm oyunu (bkz. `schema.sql`). */
  album?: string
  /**
   * Aracın önerdiği zorluk kademesi (yalnızca sanatçı taramasında dolu).
   *
   * ⚠️ Bu bir SEZGİ, ölçüm değil — panelde "önerilen" olarak gösterilir ve
   * küratör değiştirebilir. Sessizce kesin doğru gibi davranılmaz.
   */
  onerilenKademe?: Difficulty
  /** Yıl, aynı şarkının daha erken bir basımından düzeltildi mi? */
  yilDuzeltildi?: boolean
}

export class ITunesError extends Error {
  constructor(public status: number) {
    super(
      status === 403
        ? 'iTunes istek sınırına takıldı (dakikada ~20). Birkaç saniye bekle.'
        : `iTunes ${status} — arama yapılamadı.`,
    )
  }
}

/** Oynanamaz, karaoke ya da derleme kayıtlarını ele. */
function usable(t: ITunesResult): boolean {
  if (!t.previewUrl || !t.artworkUrl100 || !t.trackViewUrl) return false
  const hay = [t.trackName, t.collectionName, t.artistName].filter(Boolean).join(' ')
  if (JUNK_RE.test(hay)) return false
  return t.collectionArtistName !== 'Various Artists'
}

function toFound(t: ITunesResult): FoundTrack {
  return {
    trackId: t.trackId,
    title: t.trackName,
    artist: t.artistName,
    artwork: t.artworkUrl100!,
    preview: t.previewUrl!,
    storeUrl: t.trackViewUrl!,
    // ⚠️ Bu tarih çoğu zaman yeniden basımın tarihidir; panelde düzeltilebilir.
    year: t.releaseDate ? new Date(t.releaseDate).getUTCFullYear() : 0,
    album: t.collectionName,
  }
}

export async function searchTracks(term: string, limit = 18): Promise<FoundTrack[]> {
  const url =
    'https://itunes.apple.com/search?' +
    new URLSearchParams({
      term,
      country: 'tr',
      media: 'music',
      entity: 'song',
      limit: String(limit),
    })

  const res = await fetch(url, {
    headers: { 'User-Agent': 'tahmin.in/1.0 (song quiz)' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new ITunesError(res.status)

  const json = (await res.json()) as { results: ITunesResult[] }
  return json.results.filter(usable).map(toFound)
}

/**
 * Bir sanatçının kataloğunu tara.
 *
 * Arama terimi sanatçı adı olduğu için sonuçlara featuring ve benzer isimli
 * başka sanatçılar da karışır; normalize edilmiş ad içermeyenler elenir
 * ("UZI & Aksan" kabul, "Tefo & Seko" değil). Aynı şarkının farklı basımları
 * tek satıra indirilir.
 */
export async function scanArtist(artist: string, limit = 200): Promise<FoundTrack[]> {
  const want = cleanKey(artist)
  const raw = await searchTracks(artist, limit)

  // Aynı şarkının albüm / single / derleme sürümleri tek satıra indirilir.
  // İlk görülen temsilci olur (iTunes sırası = alaka), ama YIL grubun
  // tamamından hesaplanır.
  const gruplar = new Map<string, { ilk: FoundTrack; enErkenYil: number }>()
  for (const t of raw) {
    if (!cleanKey(t.artist).includes(want)) continue
    const key = cleanKey(t.title)
    const g = gruplar.get(key)
    if (!g) {
      gruplar.set(key, { ilk: t, enErkenYil: t.year || Infinity })
    } else if (t.year && t.year < g.enErkenYil) {
      g.enErkenYil = t.year
    }
  }

  return [...gruplar.values()].map(({ ilk, enErkenYil }, i) => {
    const yil = Number.isFinite(enErkenYil) ? enErkenYil : ilk.year
    return {
      ...ilk,
      year: yil,
      yilDuzeltildi: yil > 0 && ilk.year > 0 && yil < ilk.year,
      onerilenKademe: kademeOner(i, gruplar.size),
    }
  })
}

/**
 * Sıradan kademe önerisi.
 *
 * iTunes bir sanatçı sorgusunda sonuçları alaka sırasıyla döndürüyor ve
 * pratikte bu sıra popülerlik vekili oluyor: baştakiler o sanatçının en çok
 * bilinen parçaları. 3000 şarkıyı elle kademelendirmek mümkün olmadığı için
 * araç bir başlangıç noktası öneriyor.
 *
 * ⚠️ ORANA göre, mutlak sıraya göre DEĞİL. Sanatçı başına 30 da 120 de parça
 * gelebiliyor; sabit eşiklerle uzun listelerin neredeyse tamamı kademe 5'e
 * yığılırdı.
 *
 * ⚠️ SEZGİ, ÖLÇÜM DEĞİL. Panelde düzenlenebilir kalmalı.
 */
export function kademeOner(sira: number, toplam: number): Difficulty {
  if (toplam <= 1) return 1
  const oran = sira / toplam
  if (oran < 0.08) return 1
  if (oran < 0.22) return 2
  if (oran < 0.42) return 3
  if (oran < 0.68) return 4
  return 5
}
