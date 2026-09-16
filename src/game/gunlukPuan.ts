import { ADIM_PUANI } from './puan'

/**
 * Günlük puanı: adım puanı + hız bonusu (kullanıcı kararı).
 *
 * Bilinen turda ilk adımda 100, her açılan adım 20 eksik. Üstüne süreye
 * bağlı en fazla +20: 0 sn'de tam, 60 sn'de sıfır, arası doğrusal.
 * Bilinemeyen tur 0 — bonus da yok. En fazla 6 × 120 = 720.
 *
 * ⚠️ SÜRE SUNUCU SAATİYLE. Başlangıç, medyanın verildiği an; bitiş, doğru
 * tahminin sunucuya ulaştığı an. İstemcinin söylediği tek şey hazırlanma
 * süresi (ses kurulumu / görsel inişi) ve o da `HAZIR_TAVAN_MS` ile kırpılıyor:
 * yalan söyleyen en fazla 15 sn (~5 puan) kazanır, yavaş bağlantıdaki dürüst
 * oyuncu ise ağ yüzünden cezalanmaz.
 */

export const HIZ_BONUSU_EN_COK = 20
export const HIZ_PENCERESI_MS = 60_000
export const HAZIR_TAVAN_MS = 15_000
export const TUR_EN_YUKSEK = ADIM_PUANI[0]! + HIZ_BONUSU_EN_COK
export const EN_YUKSEK_PUAN = 6 * TUR_EN_YUKSEK

export function hizBonusu(sureMs: number): number {
  const oran = 1 - Math.max(0, sureMs) / HIZ_PENCERESI_MS
  return Math.round(HIZ_BONUSU_EN_COK * Math.min(1, Math.max(0, oran)))
}

export function hazirKirp(hazirMs: number | null | undefined): number {
  if (typeof hazirMs !== 'number' || !Number.isFinite(hazirMs)) return 0
  return Math.min(HAZIR_TAVAN_MS, Math.max(0, Math.round(hazirMs)))
}

export function turSuresi(medyaVerildi: number, hazirMs: number | null, bitisMs: number): number {
  return Math.max(0, bitisMs - medyaVerildi - hazirKirp(hazirMs))
}

export function adimPuani(adimIndeksi: number): number {
  return ADIM_PUANI[Math.min(Math.max(adimIndeksi, 0), ADIM_PUANI.length - 1)]!
}

export function turPuani(r: { kazandi: boolean; adimIndeksi: number; sureMs: number }): {
  puan: number
  hizBonusu: number
} {
  if (!r.kazandi) return { puan: 0, hizBonusu: 0 }
  const bonus = hizBonusu(r.sureMs)
  return { puan: adimPuani(r.adimIndeksi) + bonus, hizBonusu: bonus }
}
