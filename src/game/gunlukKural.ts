import { kapakReducer, kapakKalanHak, type KapakDurum } from './kapakMachine'
import { STEPS } from './ladder'
import { gameReducer, MAX_WRONG, wrongCount, type GameState, type Step } from './machine'
import { kalanHak, unluReducer, type UnluDurum } from './unluMachine'
import type { GunlukOge, GunlukOlay } from './gunluk'

/**
 * Günlük turun kuralları — MEVCUT reducer'ların sunucuda yeniden oynatılması.
 *
 * ⚠️ KURALLARIN İKİNCİ KOPYASI YOK. Şarkı, ünlü ve kapak makineleri geçersiz
 * bir eylemde AYNI nesneyi döndürüyor (ör. son kademede ipucu, bitmiş turda
 * tahmin); `olayGecerli` bunu kullanıyor. Normal oyunda kural değişirse günlük
 * de kendiliğinden değişir.
 *
 * ⚠️ ARM / ARM_OK SENTEZLENİR: sunucuda "medya hazırlanıyor" evresi yok, tur
 * her zaman `ready` başlar. PLAY / CLIP_END / CLIP_STALL hiç oynatılmaz —
 * dinleme sayısı yalnızca istemcide yaşayan bir gösterge, kural değil.
 */

export type TurDurumu =
  | { oyun: 'sarki'; d: GameState }
  | { oyun: 'unlu'; d: UnluDurum }
  | { oyun: 'kapak'; d: KapakDurum }

export function turBaslat(oge: GunlukOge): TurDurumu {
  switch (oge.oyun) {
    case 'sarki': {
      const d = gameReducer({ s: 'booting' }, { type: 'ARM', track: oge.sarki, ladder: [...STEPS] })
      return { oyun: 'sarki', d: gameReducer(d, { type: 'ARM_OK' }) }
    }
    case 'unlu': {
      const d = unluReducer({ s: 'booting' }, { type: 'ARM', kisi: oge.unlu })
      return { oyun: 'unlu', d: unluReducer(d, { type: 'ARM_OK' }) }
    }
    case 'kapak': {
      const d = kapakReducer({ s: 'booting' }, { type: 'ARM', kapak: oge.kapak })
      return { oyun: 'kapak', d: kapakReducer(d, { type: 'ARM_OK' }) }
    }
  }
}

export function olayUygula(t: TurDurumu, o: GunlukOlay): TurDurumu {
  switch (t.oyun) {
    case 'sarki': {
      const eylem =
        o.t === 'Y' ? ({ type: 'WRONG', text: o.m, sameArtist: o.sa } as const)
        : o.t === 'D' ? ({ type: 'CORRECT' } as const)
        : o.t === 'P' ? ({ type: 'SKIP' } as const)
        : ({ type: 'HINT' } as const)
      return { oyun: 'sarki', d: gameReducer(t.d, eylem) }
    }
    case 'unlu': {
      // İpucu ünlüde yok — durum değişmez, `olayGecerli` reddeder.
      if (o.t === 'I') return t
      const eylem =
        o.t === 'Y' ? ({ type: 'WRONG', text: o.m } as const)
        : o.t === 'D' ? ({ type: 'CORRECT' } as const)
        : ({ type: 'SKIP' } as const)
      return { oyun: 'unlu', d: unluReducer(t.d, eylem) }
    }
    case 'kapak': {
      if (o.t === 'I') return t
      const eylem =
        o.t === 'Y' ? ({ type: 'WRONG', text: o.m, sameArtist: o.sa } as const)
        : o.t === 'D' ? ({ type: 'CORRECT' } as const)
        : ({ type: 'SKIP' } as const)
      return { oyun: 'kapak', d: kapakReducer(t.d, eylem) }
    }
  }
}

/** Olay durumu değiştiriyor mu? Değiştirmiyorsa kural gereği geçersiz. */
export function olayGecerli(t: TurDurumu, o: GunlukOlay): boolean {
  return olayUygula(t, o).d !== t.d
}

export function turDurumu(oge: GunlukOge, olaylar: readonly GunlukOlay[]): TurDurumu {
  return olaylar.reduce(olayUygula, turBaslat(oge))
}

export function turBitisi(t: TurDurumu): 'kazandi' | 'kaybetti' | null {
  if (t.d.s === 'won') return 'kazandi'
  if (t.d.s === 'lost') return 'kaybetti'
  return null
}

/** Oynanabilir (ready/playing/won/lost) turun ortak alanları. */
function turAlanlari(t: TurDurumu): { steps: Step[] } | null {
  const d = t.d
  if (d.s === 'ready' || d.s === 'playing' || d.s === 'won' || d.s === 'lost') return d
  return null
}

export function turAdimlari(t: TurDurumu): Step[] {
  return turAlanlari(t)?.steps ?? []
}

/**
 * Oyuncunun bulunduğu adım (0 = ilk adım).
 *
 * Şarkıda merdivendeki konum; ünlüde açık şerit − 1; kapakta açık adım − 1.
 * Kazanılan turda puanı bu belirler.
 */
export function adimIndeksi(t: TurDurumu): number {
  const d = t.d
  switch (t.oyun) {
    case 'sarki':
      return 'attempt' in d ? d.attempt : 0
    case 'unlu':
      return 'acilan' in d ? d.acilan - 1 : 0
    case 'kapak':
      return 'adim' in d ? d.adim - 1 : 0
  }
}

/** Kalan tahmin hakkı. */
export function hakKalan(t: TurDurumu): number {
  const d = t.d
  switch (t.oyun) {
    case 'sarki': {
      if (!('attempt' in d)) return 0
      return Math.max(0, Math.min(MAX_WRONG - wrongCount(d.steps), d.ladder.length - d.attempt))
    }
    case 'unlu':
      return 'acilan' in d ? kalanHak(d.acilan) : 0
    case 'kapak':
      return 'adim' in d ? kapakKalanHak(d.adim) : 0
  }
}
