import uFuzzy from '@leeoniya/ufuzzy'
import type { Song } from '@/data/schema'
import { normalizeLoose } from './normalize'

export interface SearchIndex {
  haystack: string[]
  songs: Song[]
  uf: uFuzzy
}

/**
 * Otomatik tamamlama indeksi.
 *
 * Haystack iki zihinsel modeli birden destekler: kullanıcı "ceza suspus" da
 * yazabilir "suspus ceza" da. İkisi de aynı şarkıyı bulur.
 *
 * Anahtarlar zaten build zamanında normalize edildiği için burada yalnızca
 * birleştirme yapılıyor — 150 şarkılık havuzda ~1 ms.
 */
export function buildIndex(pool: readonly Song[]): SearchIndex {
  const haystack = pool.map((s) => `${s.nA} ${s.nT} ${s.nT} ${s.nA}`)
  return {
    haystack,
    songs: [...pool],
    // uFuzzy'nin varsayılan karakter sınıfları ASCII'dir. Bu bizim için sorun
    // değil: nT/nA alanları build zamanında zaten diyakritikten arındırıldı
    // (ş→s, ğ→g, ı→i), ve kullanıcının girdisi de aynı hattan geçiyor.
    uf: new uFuzzy({
      intraIns: 1, // terim içinde 1 fazladan harf
      intraSub: 1, // 1 harf değişimi
      intraTrn: 1, // 1 yer değiştirme (mobil yazımının 1 numaralı hatası)
      intraDel: 1, // 1 eksik harf
    }),
  }
}

export interface Suggestion {
  song: Song
  /** Havuz içindeki sıra — klavye gezinmesi için. */
  index: number
}

export function query(idx: SearchIndex, raw: string, limit = 8): Suggestion[] {
  const needle = normalizeLoose(raw)
  if (needle.length === 0) return []

  const [indices, info, order] = idx.uf.search(idx.haystack, needle, 0, 1e3)
  const out: Suggestion[] = []
  const seen = new Set<string>()

  if (info && order) {
    for (let i = 0; i < order.length && out.length < limit; i++) {
      const songIdx = info.idx[order[i]!]!
      const song = idx.songs[songIdx]
      if (!song || seen.has(song.id)) continue
      seen.add(song.id)
      out.push({ song, index: songIdx })
    }
  } else if (indices) {
    for (let i = 0; i < indices.length && out.length < limit; i++) {
      const song = idx.songs[indices[i]!]
      if (!song || seen.has(song.id)) continue
      seen.add(song.id)
      out.push({ song, index: indices[i]! })
    }
  }

  return out
}
