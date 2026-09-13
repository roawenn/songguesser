import type { Difficulty } from '@/data/categories'
import { SERIT } from '@/data/unlu'
import { KADEME } from './stats'

/**
 * Ünlü oyununun kişisel istatistiği — SAF mantık.
 *
 * ⚠️ `stats.ts` PAYLAŞILMADI. Oradaki `enIyiSaniye` ve `toplamDinleme` ses
 * semantiği taşıyor ve ünlü turunda karşılıkları yok; `GECERLI_SANIYE` kümesi
 * de `STEPS`'e bağlı. Tek bir jenerik depoda bu kümeyi parametrelemek, iki
 * küçük test edilebilir modülden karmaşık olurdu — `useStatsStore`'un kendi
 * gerekçesi ("iki farklı işi aynı anda taşımasın") burada da geçerli.
 *
 * Ortak olan tek şey `isabet` ve kademe sayısı; ikisi de `stats.ts`'ten
 * import ediliyor.
 */

export interface UnluIstatistik {
  oynanan: number
  kazanilan: number
  /** Kademe 1..5 sırasıyla: o kademede kaç tur kazanıldı. */
  kademeDagilimi: number[]
  /**
   * En az şeritle bilinen tur. 1 = ilk bakışta, yalnızca saçtan.
   * `null` = henüz hiç kazanılmadı.
   */
  enIyiSerit: number | null
  seri: number
  enIyiSeri: number
  sonOynama: string | null
}

export interface UnluTurSonucu {
  won: boolean
  tier: Difficulty
  /** Tur bittiğinde açık olan şerit sayısı (1..5). */
  acilan: number
}

export const UNLU_BOS: UnluIstatistik = {
  oynanan: 0,
  kazanilan: 0,
  kademeDagilimi: Array.from({ length: KADEME }, () => 0),
  enIyiSerit: null,
  seri: 0,
  enIyiSeri: 0,
  sonOynama: null,
}

export function unluUygula(
  s: UnluIstatistik,
  t: UnluTurSonucu,
  simdi = new Date(),
): UnluIstatistik {
  const dagilim = [...s.kademeDagilimi]
  if (t.won) dagilim[t.tier - 1] = (dagilim[t.tier - 1] ?? 0) + 1

  const seri = t.won ? s.seri + 1 : 0

  return {
    oynanan: s.oynanan + 1,
    kazanilan: s.kazanilan + (t.won ? 1 : 0),
    kademeDagilimi: dagilim,
    // ⚠️ Yalnızca KAZANILAN turdan: kaybedilen turda beş şerit de açılıyor ve
    // onu "rekor" saymak sayacı anlamsızlaştırırdı.
    enIyiSerit: t.won
      ? s.enIyiSerit === null
        ? t.acilan
        : Math.min(s.enIyiSerit, t.acilan)
      : s.enIyiSerit,
    seri,
    enIyiSeri: Math.max(s.enIyiSeri, seri),
    sonOynama: simdi.toISOString(),
  }
}

/**
 * `localStorage`'dan gelen değer güvenilmez: eski sürümden kalmış, elle
 * kurcalanmış ya da bozulmuş olabilir. Alanlar arası tutarlılık da zorlanıyor.
 */
export function unluSanitize(v: unknown): UnluIstatistik {
  const raw = (v ?? {}) as Record<string, unknown>
  const sayi = (x: unknown, enFazla = Number.MAX_SAFE_INTEGER) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(Math.floor(x), enFazla) : 0

  const oynanan = sayi(raw.oynanan)
  const kazanilan = Math.min(sayi(raw.kazanilan), oynanan)

  const hamDagilim = Array.isArray(raw.kademeDagilimi) ? raw.kademeDagilimi : []
  const dagilim = Array.from({ length: KADEME }, (_, i) => sayi(hamDagilim[i]))
  // Dağılım toplamı kazanılan turu aşamaz.
  let kalan = kazanilan
  for (let i = 0; i < dagilim.length; i++) {
    dagilim[i] = Math.min(dagilim[i]!, kalan)
    kalan -= dagilim[i]!
  }

  const serit = raw.enIyiSerit
  const enIyiSerit =
    typeof serit === 'number' && Number.isInteger(serit) && serit >= 1 && serit <= SERIT
      ? serit
      : null

  const seri = Math.min(sayi(raw.seri), oynanan)
  return {
    oynanan,
    kazanilan,
    kademeDagilimi: dagilim,
    // Hiç kazanılmadıysa "en iyi şerit" olamaz.
    enIyiSerit: kazanilan > 0 ? enIyiSerit : null,
    seri,
    enIyiSeri: Math.max(seri, Math.min(sayi(raw.enIyiSeri), oynanan)),
    sonOynama: typeof raw.sonOynama === 'string' ? raw.sonOynama : null,
  }
}
