import { gunBaslangici, gunEkle, istanbulGunu, type Gun } from './gun'

/**
 * Son teslim ve arşiv sınırı — saf.
 *
 * Sıralamalı bir oturum, gününün ertesi günü 03:00'e (İstanbul) kadar
 * bitirilebilir: 23:58'de başlayan oyuncu gece yarısında kesilmesin.
 *
 * ⚠️ ARŞİV ANCAK SON TESLİMDEN SONRA AÇILIR. Aksi hâlde 00:30'da dünün
 * arşivini açıp cevapları görmek ve aynı günün yarım kalan SIRALAMALI
 * oturumunu bitirmek mümkün olurdu.
 */

export const SON_TESLIM_PAYI_MS = 3 * 3600_000

export function sonTeslimAni(gun: Gun): number {
  return gunBaslangici(gunEkle(gun, 1)).getTime() + SON_TESLIM_PAYI_MS
}

/** Arşivde oynanabilecek en yeni gün (son teslimi geçmiş en yeni gün). */
export function arsivSiniri(simdiMs: number): Gun {
  return gunEkle(istanbulGunu(new Date(simdiMs - SON_TESLIM_PAYI_MS)), -1)
}

/** Arşivde listelenecek en eski gün sayısı. */
export const ARSIV_GUN = 60
