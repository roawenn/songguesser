import type { CategoryId, Difficulty } from './categories'

/**
 * Kapaktan Albüm oyununun havuz kaydı — ALBÜM başına bir tane.
 *
 * ⚠️ Şarkı başına değil: aynı albümdeki bütün şarkılar aynı kapağı paylaşıyor.
 * Şarkı başına kayıt, aynı kapağın arka arkaya çıkması ve cevabın "hangi şarkı"
 * sanılması demekti (bkz. `api/kapak-havuz`).
 *
 * `nT`, `nA`, `k` alan adları `Song` ile aynı: `judgeGuess`, `buildIndex` ve
 * `GuessInput` yapısal tiple çalışıyor (bkz. `text/match.ts`).
 */
export interface Kapak {
  /** "kapak:<albüm kimliği>" */
  id: string
  /** Temsilci şarkının kimliği — kapak adresi `/api/sarki` ile bundan çekilir. */
  sid: string
  /** Temizlenmiş albüm adı (gösterim). */
  al: string
  /** Sanatçı (gösterim). */
  a: string
  /** Albümdeki en erken çıkış yılı. */
  y: number
  /** Albümdeki en KOLAY şarkının kademesi — en tanınan şarkı albümü tanıtır. */
  d: Difficulty
  c: CategoryId
  /** Normalize albüm adı. */
  nT: string
  /** Normalize sanatçı adı. */
  nA: string
  /** Albüm adının kabul anahtarları. */
  k: string[]
  /** Sanatçı adının kabul anahtarları — YALNIZCA kolay modda `k`'ya eklenir. */
  ks: string[]
}

/**
 * Kapak kaç adımda netleşir. Beşinci adımda (tam kapak) tur biter — pratikte
 * dört tahmin hakkı; ünlü oyunuyla aynı kural.
 */
export const KAPAK_ADIM = 5

/**
 * Adım başına kapak boyutu (piksel).
 *
 * ⚠️ Apple bu boyutlarda GERÇEK görsel döndürüyor (8×8 istenince 8×8 JPEG —
 * ölçüldü). Pikselleştirme tarayıcıda yapılmıyor, yani ilk adımda istemcide
 * netleştirilebilecek bir veri yok; görsel yalnızca CSS ile büyütülüyor.
 */
export const KAPAK_BOYUTLARI = [8, 16, 32, 64, 600] as const

/**
 * Kolay mod: sanatçı adı da kabul (kullanıcı kararı).
 *
 * ⚠️ Kayıt DEĞİŞTİRİLMEZ, kopyası döner — havuzdaki nesne iki mod arasında
 * paylaşılıyor ve yerinde değiştirmek kapalı moda anahtar sızdırırdı.
 */
export function kolayAnahtarlar(k: Kapak, kolay: boolean): Kapak {
  return kolay ? { ...k, k: [...new Set([...k.k, ...k.ks])] } : k
}

/** Öneri ve belirsizlik listelerinde bir albümün nasıl yazılacağı. */
export function kapakSatiri(k: Kapak): { ust: string; alt?: string } {
  return { ust: k.al, alt: k.a }
}

/** Otomatik tamamlama samanlığı: kolay modda sanatçı adıyla da bulunur. */
export function kapakSamanligi(kolay: boolean): (k: Kapak) => string {
  return (k) => (kolay ? `${k.nT} ${k.nA}` : k.nT)
}
