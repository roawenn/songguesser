import type { Song } from './schema'
import type { ChipId } from './categories'

const cache = new Map<ChipId, Song[]>()

/**
 * Bir şerit çipinin şarkılarını yükler.
 *
 * Kaynak `/api/havuz/<çip>`: sunucu Supabase'den okur, kenarda önbelleğe alır
 * ve veritabanına ulaşamazsa statik yedeğe düşer. İstemci burada yalnızca
 * oturum içi bir bellek önbelleği tutar — aynı seçkiye dönüldüğünde ağa
 * tekrar gidilmez.
 */
export async function loadChip(id: ChipId): Promise<Song[]> {
  const hit = cache.get(id)
  if (hit) return hit

  const res = await fetch(`/api/havuz/${id}`)
  if (!res.ok) throw new Error(`Havuz yüklenemedi: ${id}`)

  const data = (await res.json()) as { songs: Song[]; kaynak: string }
  // Kapatılmış şarkılar sunucuda zaten süzülüyor; yine de güvenceye al.
  const songs = data.songs.filter((s) => s.off !== 1)

  cache.set(id, songs)
  return songs
}

/** Panelden değişiklik sonrası oyunu tazelemek için. */
export function clearPoolCache(): void {
  cache.clear()
}
