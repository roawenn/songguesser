import { fetchWithBackoff } from './throttle'
import { cached, WEEK } from './diskCache'

export interface ITunesTrack {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  collectionArtistName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  releaseDate?: string
  primaryGenreName?: string
  trackTimeMillis?: number
  wrapperType?: string
  kind?: string
}

interface SearchResponse {
  resultCount: number
  results: ITunesTrack[]
}

/**
 * Şarkı araması. Sonuç bir hafta cache'lenir — metadata sık değişmez.
 */
export async function searchSongs(term: string, limit = 12): Promise<ITunesTrack[]> {
  const url =
    'https://itunes.apple.com/search?' +
    new URLSearchParams({
      term,
      country: 'tr',
      media: 'music',
      entity: 'song',
      limit: String(limit),
    })

  return cached('itunes-search', url, WEEK, async () => {
    const res = await fetchWithBackoff(url, {}, { label: `arama: ${term}` })
    if (!res.ok) throw new Error(`iTunes arama ${res.status}: ${term}`)
    const json = (await res.json()) as SearchResponse
    return json.results.filter((r) => r.kind === 'song' || r.wrapperType === 'track')
  })
}

/** trackId ile taze preview URL'i çözümler (ölü URL fallback'i). */
export async function lookupTrack(trackId: number): Promise<ITunesTrack | null> {
  const url = `https://itunes.apple.com/lookup?id=${trackId}&country=tr`
  const res = await fetchWithBackoff(url, {}, { label: `lookup: ${trackId}` })
  if (!res.ok) return null
  const json = (await res.json()) as SearchResponse
  return json.results[0] ?? null
}

/** Bir tür için Türkiye listesi — küratöre aday üretmek amacıyla. */
export async function genreChart(genreId: number, limit = 100): Promise<ITunesTrack[]> {
  const url = `https://itunes.apple.com/tr/rss/topsongs/limit=${limit}/genre=${genreId}/json`
  return cached('itunes-chart', url, WEEK, async () => {
    const res = await fetchWithBackoff(url, {}, { label: `liste: ${genreId}` })
    if (!res.ok) throw new Error(`Liste ${res.status}: ${genreId}`)
    const json = (await res.json()) as {
      feed?: { entry?: Array<Record<string, any>> }
    }
    const entries = json.feed?.entry ?? []
    return entries.map((e) => ({
      trackId: Number(e.id?.attributes?.['im:id'] ?? 0),
      trackName: String(e['im:name']?.label ?? ''),
      artistName: String(e['im:artist']?.label ?? ''),
      releaseDate: e['im:releaseDate']?.label,
    })) as ITunesTrack[]
  })
}

export type PreviewCheck =
  | { ok: true; cors: boolean }
  | { ok: false; status: number }

/**
 * Preview URL'ini doğrular.
 *
 * ⚠️ `HEAD` Apple CDN'de güvenilmez — 1 baytlık ranged GET kullanılır.
 * ⚠️ Tam gövde ASLA indirilmez: Apple ToS preview baytlarını indirmeyi/saklamayı
 *    yasaklıyor. 2 bayt "bu URL yaşıyor mu" sorusunu yanıtlamaya yeter.
 */
export async function checkPreview(url: string): Promise<PreviewCheck> {
  const res = await fetchWithBackoff(
    url,
    { headers: { Range: 'bytes=0-1', Origin: 'https://nakarat.app' } },
    // CDN şeridi: Search API kotasına dahil değil.
    { label: 'preview kontrol', attempts: 2, lane: 'cdn' },
  )
  if (res.status !== 200 && res.status !== 206) return { ok: false, status: res.status }
  const acao = res.headers.get('access-control-allow-origin')
  return { ok: true, cors: acao === '*' || acao === 'https://nakarat.app' }
}
