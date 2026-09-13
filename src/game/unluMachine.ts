import type { Unlu } from '@/data/unlu'
import { SERIT } from '@/data/unlu'
import type { Step } from './machine'

/**
 * Ünlü tanıma oyununun durum makinesi.
 *
 * ⚠️ `machine.ts` JENERİKLEŞTİRİLMEDİ, kardeşi yazıldı. Oradaki genel kısım
 * ~25 satır (`Step`, `advance`, `wrongCount`); geri kalanı sese özgü
 * (`track: Song`, `listens`, `heardIndex`, `PLAY`/`CLIP_END`/`CLIP_STALL`,
 * `currentClipLength`, `canPlay`, `heardLength`). Ayrımlı birleşim üzerinde
 * tip parametresi TypeScript'te daralmayı bozuyor ve 334 satırlık
 * `machine.test.ts` sesin tam anlamını kilitlemiş durumda. İki makine,
 * jenerikleştirilmiş tek makineden az koddur.
 *
 * ⚠️ `Step` PAYLAŞILIYOR (`machine.ts`'ten import). Taşımak `GuessLog`,
 * `StepIndicator`, `share.ts`, `ResultPanel` ve `DuelloShell` importlarını
 * kırardı; kazanç yok.
 *
 * Kural: görsel beş eşit yatay şeride bölünür, başta yalnızca 1. şerit (saç)
 * açıktır. Yanlış tahmin ya da pas bir şerit daha açar. Beşinci açılınca tur
 * BİTER — yani pratikte dört tahmin hakkı var.
 *
 * ⚠️ Şarkı oyunundaki `MAX_WRONG` (3 yanlış) BURADA UYGULANMAZ. Orada merdiven
 * uzunluğundan ayrı ikinci bir bitiş koşuluydu; burada tek koşul var.
 */

interface UnluTur {
  kisi: Unlu
  /** Açık şerit sayısı. Başta 1. */
  acilan: number
  steps: Step[]
}

export type UnluDurum =
  | { s: 'booting' }
  | { s: 'arming'; kisi: Unlu }
  | ({ s: 'ready' } & UnluTur)
  | ({ s: 'won' } & UnluTur)
  | ({ s: 'lost' } & UnluTur)
  | { s: 'empty' }
  | { s: 'error'; reason: 'pool' | 'image' | 'offline' }

export type UnluEylem =
  | { type: 'ARM'; kisi: Unlu }
  | { type: 'ARM_OK' }
  | { type: 'ARM_FAIL'; reason: 'pool' | 'image' | 'offline' }
  | { type: 'WRONG'; text: string }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  | { type: 'EMPTY_POOL' }
  /** Seçki değişti — yeni havuz gelene kadar hiçbir şey oynanamaz. */
  | { type: 'RESET' }

/** Tur sürüyor mu? */
export function turIcinde(d: UnluDurum): d is Extract<UnluDurum, { s: 'ready' }> {
  return d.s === 'ready'
}

/** Bitmiş mi? */
export function turBitti(d: UnluDurum): d is Extract<UnluDurum, { s: 'won' | 'lost' }> {
  return d.s === 'won' || d.s === 'lost'
}

/**
 * Kalan tahmin hakkı.
 *
 * Açık şerit 1 iken 4, 4 iken 1. Beşinci şerit açıldığında tur zaten bitmiş
 * olur, dolayısıyla 0.
 */
export function kalanHak(acilan: number): number {
  return Math.max(0, SERIT - acilan)
}

/**
 * Bir şerit açar; beşinciye ulaşıldıysa turu bitirir.
 *
 * ⚠️ `s` alanı spread'den SONRA yazılır. `tur` çağrı yerinde tam durum
 * nesnesidir, yani içinde `s: 'ready'` de vardır; `{ s: 'lost', ...next }`
 * yazılsaydı spread onu geri ezer ve tur ASLA bitmezdi. TypeScript bunu
 * yakalayamıyor çünkü `UnluTur` tipinde `s` alanı yok — `machine.ts`'teki
 * tuzağın birebir aynısı.
 */
function acil(tur: UnluTur, steps: Step[]): UnluDurum {
  const next = { ...tur, acilan: tur.acilan + 1, steps }
  return { ...next, s: next.acilan >= SERIT ? 'lost' : 'ready' }
}

export function unluReducer(durum: UnluDurum, eylem: UnluEylem): UnluDurum {
  switch (eylem.type) {
    case 'RESET':
      return { s: 'booting' }

    case 'ARM':
      return { s: 'arming', kisi: eylem.kisi }

    case 'ARM_OK':
      if (durum.s !== 'arming') return durum
      return { s: 'ready', kisi: durum.kisi, acilan: 1, steps: [] }

    case 'ARM_FAIL':
      return { s: 'error', reason: eylem.reason }

    case 'EMPTY_POOL':
      return { s: 'empty' }

    case 'CORRECT':
      if (!turIcinde(durum)) return durum
      return { ...durum, s: 'won' }

    case 'WRONG': {
      if (!turIcinde(durum)) return durum
      return acil(durum, [
        ...durum.steps,
        // ⚠️ `sameArtist` ünlüde HER ZAMAN false: alan `Step` paylaşıldığı için
        // var, karşılığı yok. `GuessLog`'a `yakinlikEtiketi={null}` geçilerek
        // rozet hiç basılmıyor.
        { kind: 'wrong', text: eylem.text, sameArtist: false },
      ])
    }

    case 'SKIP': {
      if (!turIcinde(durum)) return durum
      return acil(durum, [...durum.steps, { kind: 'skip', text: '', sameArtist: false }])
    }

    default:
      return durum
  }
}
