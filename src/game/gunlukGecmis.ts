import { gunFarki, gunGecerli, type Gun } from './gun'
import { EN_YUKSEK_PUAN } from './gunlukPuan'

/**
 * Günlük geçmiş ve seri — saf. Yerel depo (girişsiz) ve sunucu geçmişi
 * (girişli) AYNI kuralı kullanıyor.
 *
 * SERİ: art arda oynanmış (sıralamalı, bitmiş) günler. Bugün henüz
 * oynanmadıysa seri dünden sayılır — gün bitmeden "seri bozuldu" demek,
 * sabah siteye giren oyuncuyu haksız yere cezalandırırdı.
 */

export interface GunlukGecmisKaydi {
  gun: Gun
  puan: number
  /** Tur başına puan, sırasıyla. */
  turlar: number[]
  /** Arşivden oynandıysa seriye sayılmaz. */
  arsiv: boolean
}

export const GECMIS_TAVAN = 400

/** Aynı gün (ve aynı arşiv türü) tekrar kaydedilmez — ilk sonuç kalır. */
export function gecmiseEkle(
  gecmis: readonly GunlukGecmisKaydi[],
  kayit: GunlukGecmisKaydi,
): GunlukGecmisKaydi[] {
  if (gecmis.some((k) => k.gun === kayit.gun && k.arsiv === kayit.arsiv)) return [...gecmis]
  return [...gecmis, kayit].sort((a, b) => (a.gun < b.gun ? -1 : a.gun > b.gun ? 1 : 0)).slice(-GECMIS_TAVAN)
}

export function seriHesapla(gunler: readonly Gun[], bugun: Gun): { seri: number; enIyi: number } {
  const sirali = [...new Set(gunler)].filter((g) => g <= bugun).sort()
  if (sirali.length === 0) return { seri: 0, enIyi: 0 }

  let enIyi = 1
  let calisan = 1
  for (let i = 1; i < sirali.length; i++) {
    calisan = gunFarki(sirali[i]!, sirali[i - 1]!) === 1 ? calisan + 1 : 1
    enIyi = Math.max(enIyi, calisan)
  }

  const son = sirali[sirali.length - 1]!
  const fark = gunFarki(bugun, son)
  // `calisan` son günle biten dizinin uzunluğu; son gün bugün ya da dünse sürüyor.
  return { seri: fark <= 1 ? calisan : 0, enIyi }
}

/** Depodan okunan ham veriyi doğrular — bozuk kayıt tüm geçmişi düşürmesin. */
export function gecmisSanitize(ham: unknown): GunlukGecmisKaydi[] {
  if (!Array.isArray(ham)) return []
  const out: GunlukGecmisKaydi[] = []
  for (const k of ham) {
    if (!k || typeof k !== 'object') continue
    const r = k as Record<string, unknown>
    if (!gunGecerli(r.gun)) continue
    const puan = Number(r.puan)
    if (!Number.isInteger(puan) || puan < 0 || puan > EN_YUKSEK_PUAN) continue
    const turlar = Array.isArray(r.turlar)
      ? r.turlar.map(Number).filter((p) => Number.isInteger(p) && p >= 0).slice(0, 6)
      : []
    out.push({ gun: r.gun, puan, turlar, arsiv: r.arsiv === true })
  }
  return out.reduce<GunlukGecmisKaydi[]>((acc, k) => gecmiseEkle(acc, k), [])
}
