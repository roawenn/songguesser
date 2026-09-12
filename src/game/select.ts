import type { Song } from '@/data/schema'
import { MIN_PLAYABLE, type Difficulty } from '@/data/categories'

/**
 * Havuzu seçili zorluk kademesine göre süzer.
 *
 * Kademe tam eşleşmeyle başlar ("Kolay" = yalnızca kademe 1). Küratörlük o
 * kategoride henüz inceyse komşu kademeler kademeli olarak eklenir — oyuncuya
 * beş şarkının döngüye girdiği bir seçki vermektense biraz daha geniş ama
 * oynanabilir bir havuz vermek daha iyi.
 */
export function filterByTier(
  pool: readonly Song[],
  tier: Difficulty,
  min = MIN_PLAYABLE,
): Song[] {
  let lo: number = tier
  let hi: number = tier
  let out = pool.filter((s) => s.d >= lo && s.d <= hi)

  while (out.length < min && (lo > 1 || hi < 5)) {
    if (lo > 1) lo--
    else if (hi < 5) hi++
    if (out.length < min && hi < 5 && lo === 1) hi++
    out = pool.filter((s) => s.d >= lo && s.d <= hi)
  }

  return out
}

export interface Pick {
  song: Song
  /** Havuz tükendiği için tekrar sayacı sıfırlandı mı? */
  recycled: boolean
}

/**
 * Havuzdan, oturumda henüz çalınmamış bir şarkı seçer.
 * Havuz tükenirse sayaç sıfırlanır ve döngü yeniden başlar.
 */
export function pickNext(
  pool: readonly Song[],
  played: ReadonlySet<string>,
  rand: () => number = Math.random,
): Pick | null {
  if (pool.length === 0) return null

  let available = pool.filter((s) => !played.has(s.id))
  let recycled = false
  if (available.length === 0) {
    available = [...pool]
    recycled = true
  }

  const song = available[Math.floor(rand() * available.length)]!
  return { song, recycled }
}
