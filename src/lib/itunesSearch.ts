import { cleanKey } from '@/text/keys'

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
    headers: { 'User-Agent': 'Nakarat/1.0 (song quiz)' },
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
export async function scanArtist(artist: string, limit = 40): Promise<FoundTrack[]> {
  const want = cleanKey(artist)
  const raw = await searchTracks(artist, limit)

  const seen = new Set<string>()
  const out: FoundTrack[] = []
  for (const t of raw) {
    if (!cleanKey(t.artist).includes(want)) continue
    const key = cleanKey(t.title)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
