import { KAPAK_ADIM, type Kapak } from '@/data/kapak'
import type { Step } from './machine'

/**
 * Kapaktan Albüm oyununun durum makinesi.
 *
 * ⚠️ `unluMachine.ts`'in KARDEŞİ, jenerikleştirilmiş hâli değil. İki makine
 * aynı kuralı taşıyor (beş adım, yanlış ya da pas bir adım açar, beşincide
 * kayıp) ama çalışan ve testlerle kilitli ünlü makinesini oyun eklemek için
 * yeniden yazmak, 130 satırlık bir kopyadan daha riskli. Kural değişirse İKİSİ
 * de değişmeli; testler ikisinde de aynı sınırları kilitliyor.
 *
 * Bir farkı var: `WRONG` `sameArtist` taşıyor. Kapalı modda sanatçı adı kabul
 * edilmiyor ama yazılırsa "sanatçı doğru" rozeti değerli bir işaret.
 */

interface KapakTur {
  kapak: Kapak
  /** Açık adım. Başta 1 (8×8). */
  adim: number
  steps: Step[]
}

export type KapakDurum =
  | { s: 'booting' }
  | { s: 'arming'; kapak: Kapak }
  | ({ s: 'ready' } & KapakTur)
  | ({ s: 'won' } & KapakTur)
  | ({ s: 'lost' } & KapakTur)
  | { s: 'empty' }
  | { s: 'error'; reason: 'pool' | 'image' | 'offline' }

export type KapakEylem =
  | { type: 'ARM'; kapak: Kapak }
  | { type: 'ARM_OK' }
  | { type: 'ARM_FAIL'; reason: 'pool' | 'image' | 'offline' }
  | { type: 'WRONG'; text: string; sameArtist: boolean }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  | { type: 'EMPTY_POOL' }
  | { type: 'RESET' }

export function kapakTurIcinde(d: KapakDurum): d is Extract<KapakDurum, { s: 'ready' }> {
  return d.s === 'ready'
}

export function kapakTurBitti(d: KapakDurum): d is Extract<KapakDurum, { s: 'won' | 'lost' }> {
  return d.s === 'won' || d.s === 'lost'
}

/** Kalan tahmin hakkı: 1. adımda 4, 4. adımda 1. */
export function kapakKalanHak(adim: number): number {
  return Math.max(0, KAPAK_ADIM - adim)
}

/**
 * Bir adım açar; beşinciye ulaşıldıysa turu bitirir.
 *
 * ⚠️ `s` spread'den SONRA yazılır — `machine.ts` ve `unluMachine.ts`'teki
 * tuzağın aynısı: tersi durumda spread `s: 'ready'`yi geri yazar, tur bitmez.
 */
function ilerle(tur: KapakTur, steps: Step[]): KapakDurum {
  const next = { ...tur, adim: tur.adim + 1, steps }
  return { ...next, s: next.adim >= KAPAK_ADIM ? 'lost' : 'ready' }
}

export function kapakReducer(durum: KapakDurum, eylem: KapakEylem): KapakDurum {
  switch (eylem.type) {
    case 'RESET':
      return { s: 'booting' }

    case 'ARM':
      return { s: 'arming', kapak: eylem.kapak }

    case 'ARM_OK':
      if (durum.s !== 'arming') return durum
      return { s: 'ready', kapak: durum.kapak, adim: 1, steps: [] }

    case 'ARM_FAIL':
      return { s: 'error', reason: eylem.reason }

    case 'EMPTY_POOL':
      return { s: 'empty' }

    case 'CORRECT':
      if (!kapakTurIcinde(durum)) return durum
      return { ...durum, s: 'won' }

    case 'WRONG':
      if (!kapakTurIcinde(durum)) return durum
      return ilerle(durum, [
        ...durum.steps,
        { kind: 'wrong', text: eylem.text, sameArtist: eylem.sameArtist },
      ])

    case 'SKIP':
      if (!kapakTurIcinde(durum)) return durum
      return ilerle(durum, [...durum.steps, { kind: 'skip', text: '', sameArtist: false }])

    default:
      return durum
  }
}
