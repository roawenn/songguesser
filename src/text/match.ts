import type { Song } from '@/data/schema'
import { normalizeLoose } from './normalize'
import { cleanKey } from './keys'
import { damerau, maxDistanceFor } from './distance'

export type Verdict =
  | { kind: 'empty' }
  /** Kabul. `near` ise yazım hatası affedildi — arayüz "az kalsın!" gösterebilir. */
  | { kind: 'correct'; near: boolean }
  /** Birden fazla şarkıya benzer yazıldı. HAK TÜKETMEZ — kullanıcı seçsin. */
  | { kind: 'ambiguous'; candidates: Song[] }
  | { kind: 'wrong'; sameArtist: boolean }

export interface MatchMode {
  /** Kolay arama kapalıysa ("zor mod") eşik sıkılaşır. */
  easySearch: boolean
}

function bestDistanceToKeys(guess: string, keys: string[], strict: boolean): number {
  let best = Infinity
  for (const key of keys) {
    const allowed = maxDistanceFor(key.length, strict)
    const d = damerau(guess, key, allowed)
    if (d <= allowed && d < best) best = d
    if (best === 0) break
  }
  return best
}

/**
 * Bir tahmini değerlendirir.
 *
 * Kademeli karar:
 *   1. boş → hak tüketme
 *   2. tam anahtar eşleşmesi → doğru
 *   3. kelime-kümesi eşitliği (sıra kayması) → doğru
 *   4. sınırlı Damerau — uzunluğa göre ölçekli eşik
 *   5. BELİRSİZLİK KORUMASI — başka şarkı da aynı yakınlıktaysa hak tüketme
 *   6. yanlış; sanatçı tutuyorsa bunu söyle
 */
export function judgeGuess(
  raw: string,
  answer: Song,
  pool: readonly Song[],
  mode: MatchMode,
): Verdict {
  const guess = normalizeLoose(raw)
  if (!guess) return { kind: 'empty' }

  const strict = !mode.easySearch

  // 2 — tam eşleşme
  if (answer.k.includes(guess)) return { kind: 'correct', near: false }

  // 3 — kelime kümesi eşitliği: "Ben Şarkı Söylerim" ≡ "Şarkı Söylerim Ben"
  const guessTokens = guess.split(' ').sort().join(' ')
  for (const key of answer.k) {
    if (key.split(' ').sort().join(' ') === guessTokens) {
      return { kind: 'correct', near: false }
    }
  }

  // 4 — bulanık eşleşme
  const answerDist = bestDistanceToKeys(guess, answer.k, strict)

  if (answerDist !== Infinity) {
    // 5 — belirsizlik koruması: bulanık kabulden ÖNCE tüm havuzu tara.
    // Bu olmadan "bulanık kabul" sessizce "bulanık YANLIŞ kabul"e dönüşür ve
    // oyuncular hak etmedikleri turları kazanır.
    const rivals: Song[] = []
    for (const song of pool) {
      if (song.id === answer.id) continue
      const d = bestDistanceToKeys(guess, song.k, strict)
      if (d !== Infinity && d <= answerDist + 1) rivals.push(song)
    }
    if (rivals.length > 0) {
      return { kind: 'ambiguous', candidates: [answer, ...rivals].slice(0, 5) }
    }
    return { kind: 'correct', near: answerDist > 0 }
  }

  // 6 — yanlış. Sanatçı tutuyor mu?
  const guessAsArtist = cleanKey(raw)
  const sameArtist = guessAsArtist.length > 0 && guessAsArtist === answer.nA

  return { kind: 'wrong', sameArtist }
}
