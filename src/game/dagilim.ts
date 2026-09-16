import { EN_YUKSEK_PUAN } from './gunlukPuan'

/**
 * Günün puan dağılımı — yüzdelik ve grafik kovaları. Saf.
 *
 * Dağılım sunucuda `(puan, adet)` satırları olarak tutuluyor (gün başına en
 * fazla 721 satır); burada gösterime çevriliyor.
 */

export type DagilimSatiri = readonly [puan: number, adet: number]

/** Bu kadar oyuncudan azsa yüzdelik gösterilmez — "ilk 3 kişinin %66'sı" anlamsız. */
export const YUZDELIK_ESIGI = 10

export function toplamOyuncu(dagilim: readonly DagilimSatiri[]): number {
  return dagilim.reduce((t, [, adet]) => t + adet, 0)
}

/**
 * Oyuncunun geçtiği oyuncuların yüzdesi (0-100, tam sayı).
 *
 * ⚠️ KESİN KÜÇÜK sayılır: aynı puanı alanları "geçmiş" saymak, herkesin 720
 * aldığı bir günde herkese "%100'ünden iyisin" derdi. Oyuncunun kendisi
 * toplamın içinde (dağılıma bitince yazıldı).
 */
export function yuzdelik(dagilim: readonly DagilimSatiri[], puan: number): number | null {
  const toplam = toplamOyuncu(dagilim)
  if (toplam < YUZDELIK_ESIGI) return null
  const altinda = dagilim.reduce((t, [p, adet]) => (p < puan ? t + adet : t), 0)
  return Math.floor((altinda * 100) / toplam)
}

export const KOVA_GENISLIGI = 60

/** Grafik kovaları: [0-59], [60-119] … [660-719], [720]. */
export function kovala(dagilim: readonly DagilimSatiri[], genislik = KOVA_GENISLIGI): number[] {
  const kovaSayisi = Math.floor(EN_YUKSEK_PUAN / genislik) + 1
  const kovalar = new Array<number>(kovaSayisi).fill(0)
  for (const [p, adet] of dagilim) {
    const i = Math.min(kovaSayisi - 1, Math.max(0, Math.floor(p / genislik)))
    kovalar[i]! += adet
  }
  return kovalar
}

export function kovaIndeksi(puan: number, genislik = KOVA_GENISLIGI): number {
  const kovaSayisi = Math.floor(EN_YUKSEK_PUAN / genislik) + 1
  return Math.min(kovaSayisi - 1, Math.max(0, Math.floor(puan / genislik)))
}
