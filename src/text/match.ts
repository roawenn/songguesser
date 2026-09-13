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

/** Belirsizlik listesinde gösterilecek en fazla aday. */
const EN_COK_ADAY = 5

/**
 * Fisher-Yates. Girdiyi değiştirmez.
 *
 * ⚠️ `rand` dışarıdan geliyor ki `judgeGuess` SAF kalsın ve testler
 * deterministik olabilsin — `pickNext` (`game/select.ts`) ile aynı desen.
 */
function karistir<T>(liste: readonly T[], rand: () => number): T[] {
  const out = [...liste]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
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
  rand: () => number = Math.random,
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
      /**
       * ⚠️ ÖNCE KIRP, SONRA KARIŞTIR.
       *
       * Cevap eskiden dizinin başındaydı ve arayüz diziyi olduğu gibi
       * çizdiğinden en soldaki çip HER ZAMAN doğru cevaptı — belirsizlik
       * koruması, oyuncuyu kayırmak yerine bedava kazanca dönüşüyordu.
       *
       * Karıştırmayı `slice`'tan SONRA yapmak ise daha beterini yapardı:
       * beşten fazla rakip varken cevap listeden tamamen düşebilir ve tur
       * kazanılamaz hâle gelirdi. Bu yüzden cevap ayrı tutulup rakipler
       * kırpılıyor, karıştırma en son geliyor.
       *
       * Yanlış seçim zaten hak yakıyor (`useRound.guessSong`), dolayısıyla
       * sıralama düzeldiğinde seçici hakkaniyetli bir ayrım aracına dönüyor.
       */
      const adaylar = [answer, ...rivals.slice(0, EN_COK_ADAY - 1)]
      return { kind: 'ambiguous', candidates: karistir(adaylar, rand) }
    }
    return { kind: 'correct', near: answerDist > 0 }
  }

  // 6 — yanlış. Sanatçı tutuyor mu?
  const guessAsArtist = cleanKey(raw)
  const sameArtist = guessAsArtist.length > 0 && guessAsArtist === answer.nA

  return { kind: 'wrong', sameArtist }
}
