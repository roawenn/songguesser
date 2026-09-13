import uFuzzy from '@leeoniya/ufuzzy'
import { normalizeLoose } from './normalize'

/** İndeksin havuzdan okuduğu TEK alan. */
export interface Aranabilir {
  id: string
}

export interface SearchIndex<T extends Aranabilir = Aranabilir> {
  haystack: string[]
  ogeler: T[]
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
export function buildIndex<T extends Aranabilir>(
  pool: readonly T[],
  samanlik: (oge: T) => string,
): SearchIndex<T> {
  return {
    haystack: pool.map(samanlik),
    ogeler: [...pool],
    // uFuzzy'nin varsayılan karakter sınıfları ASCII'dir. Bu bizim için sorun
    // değil: normalize alanlar zaten diyakritikten arındırıldı (ş→s, ğ→g,
    // ı→i), ve kullanıcının girdisi de aynı hattan geçiyor.
    uf: new uFuzzy({
      intraIns: 1, // terim içinde 1 fazladan harf
      intraSub: 1, // 1 harf değişimi
      intraTrn: 1, // 1 yer değiştirme (mobil yazımının 1 numaralı hatası)
      intraDel: 1, // 1 eksik harf
    }),
  }
}

/**
 * Şarkı havuzu için samanlık.
 *
 * İki zihinsel modeli birden destekler: kullanıcı "ceza suspus" da yazabilir
 * "suspus ceza" da; ikisi de aynı şarkıyı bulur.
 */
export function sarkiSamanligi(s: { nT: string; nA: string }): string {
  return `${s.nA} ${s.nT} ${s.nT} ${s.nA}`
}

export interface Suggestion<T extends Aranabilir = Aranabilir> {
  oge: T
  /** Havuz içindeki sıra — klavye gezinmesi için. */
  index: number
}

export function query<T extends Aranabilir>(
  idx: SearchIndex<T>,
  raw: string,
  limit = 8,
): Suggestion<T>[] {
  const needle = normalizeLoose(raw)
  if (needle.length === 0) return []

  const [indices, info, order] = idx.uf.search(idx.haystack, needle, 0, 1e3)
  const out: Suggestion<T>[] = []
  const seen = new Set<string>()

  if (info && order) {
    for (let i = 0; i < order.length && out.length < limit; i++) {
      const songIdx = info.idx[order[i]!]!
      const oge = idx.ogeler[songIdx]
      if (!oge || seen.has(oge.id)) continue
      seen.add(oge.id)
      out.push({ oge, index: songIdx })
    }
  } else if (indices) {
    for (let i = 0; i < indices.length && out.length < limit; i++) {
      const oge = idx.ogeler[indices[i]!]
      if (!oge || seen.has(oge.id)) continue
      seen.add(oge.id)
      out.push({ oge, index: indices[i]! })
    }
  }

  return out
}
