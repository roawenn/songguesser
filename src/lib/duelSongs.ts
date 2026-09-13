import 'server-only'
import type { Song } from '@/data/schema'
import { SONG_COLUMNS, restUrl, restHeaders, toSong, type SongRow } from '@/lib/supabase'

/**
 * Kimliklerine göre şarkıları getirir — SIRAYI KORUYARAK.
 *
 * ⚠️ PostgREST `in.()` sonuçlarını istediği sırada döndürür; düelloda sıra
 * kademe rampasının kendisi (1→5), bu yüzden burada yeniden diziliyor.
 */
export async function loadSongsByIds(ids: string[]): Promise<Song[]> {
  if (ids.length === 0) return []
  const liste = ids.map((i) => `"${encodeURIComponent(i)}"`).join(',')
  const res = await fetch(restUrl(`songs?select=${SONG_COLUMNS}&id=in.(${liste})`), {
    headers: restHeaders({ secret: true }),
    cache: 'no-store',
  })
  if (!res.ok) return []

  const byId = new Map((await res.json() as SongRow[]).map((r) => [r.id, toSong(r)]))
  return ids.map((i) => byId.get(i)).filter((s): s is Song => Boolean(s))
}
