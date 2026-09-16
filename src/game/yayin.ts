import { STEPS } from './ladder'
import { ADIM_PUANI } from './puan'
import { judgeGuess, type Tahminlenebilir } from '@/text/match'

/**
 * Yayıncı modu — sohbetle oynanan şarkı turu. Saf: zaman (`simdi`) dışarıdan
 * gelir, zamanlayıcılar kancada (`useYayin`).
 *
 * Tur akışı: hazırlanıyor → çalıyor (merdivenin o kademesi) → bekliyor
 * (sohbet yazsın) → bir sonraki kademe … → açıldı.
 *
 * ⚠️ SOHBET CEVABI HERKESE GÖSTERİYOR. İlk doğru mesaj sohbette görünür
 * görünmez diğerleri kopyalayabilir. Bu yüzden:
 *   - ilk bilen kademe puanı + `ILK_BILEN_EK` alır,
 *   - sonrakiler ancak `SON_SANS_MS` içinde ve YARIM puanla girer,
 *   - son şans bitince tur açılır; merdiven devam etmez.
 * Son şans sıfır olsaydı yayın gecikmesi (2-5 sn) yüzünden aynı anda bilen
 * izleyiciler haksız yere dışarıda kalırdı.
 */

// Günlük de aynı ölçeği kullanıyor; tek kaynak `puan.ts`.
export { ADIM_PUANI }
export const ILK_BILEN_EK = 20
/** Bu uzunluktan uzun mesajlar tahmin sayılmaz — sohbet seli ve yapıştırma. */
export const EN_UZUN_MESAJ = 60
export const SON_SANS_MS = 6000
export const SONRAKI_TUR_MS = 9000
export const TUR_SECENEKLERI = [5, 10, 20] as const
/** Klipten sonra sohbetin yazması için beklenen süre (sn). */
export const BEKLEME_SECENEKLERI = [6, 10, 15] as const
export const EN_COK_SIRA = 10

export type YayinFaz = 'bos' | 'hazirlaniyor' | 'caliyor' | 'bekliyor' | 'acildi'

export interface Bilen {
  id: string
  ad: string
  puan: number
  /** Hangi kademede bildi (0 tabanlı). */
  adim: number
}

export interface YayinTuru<S> {
  faz: YayinFaz
  sarki: S | null
  turNo: number
  adim: number
  bilenler: Bilen[]
  beklemeBitis: number | null
  sonSansBitis: number | null
}

export type YayinEylem<S> =
  | { type: 'KUR'; sarki: S; turNo: number }
  | { type: 'HAZIR' }
  | { type: 'KLIP_BITTI'; simdi: number; beklemeMs: number }
  | { type: 'BEKLEME_BITTI' }
  | { type: 'DOGRU'; id: string; ad: string; simdi: number }
  | { type: 'SON_SANS_BITTI' }
  /** Yayıncı turu elle açtı. */
  | { type: 'AC' }
  | { type: 'SIFIRLA' }

export function bosTur<S>(): YayinTuru<S> {
  return { faz: 'bos', sarki: null, turNo: 0, adim: 0, bilenler: [], beklemeBitis: null, sonSansBitis: null }
}

export function tahminAcik(t: { faz: YayinFaz }): boolean {
  return t.faz === 'caliyor' || t.faz === 'bekliyor'
}

/** `sira`: bu turda kaçıncı bilen (0 = ilk). */
export function adimPuani(adim: number, sira: number): number {
  const taban = ADIM_PUANI[Math.min(Math.max(adim, 0), ADIM_PUANI.length - 1)]!
  return sira === 0 ? taban + ILK_BILEN_EK : Math.round(taban / 2)
}

export function yayinReducer<S>(t: YayinTuru<S>, e: YayinEylem<S>): YayinTuru<S> {
  switch (e.type) {
    case 'KUR':
      return { ...bosTur<S>(), faz: 'hazirlaniyor', sarki: e.sarki, turNo: e.turNo }

    case 'HAZIR':
      return t.faz === 'hazirlaniyor' ? { ...t, faz: 'caliyor' } : t

    case 'KLIP_BITTI':
      return t.faz === 'caliyor' ? { ...t, faz: 'bekliyor', beklemeBitis: e.simdi + e.beklemeMs } : t

    case 'BEKLEME_BITTI':
      if (t.faz !== 'bekliyor') return t
      // ⚠️ Son şans sürerken merdiven İLERLEMEZ: daha uzun klip, kopyalayana
      // bir de kulakla doğrulama fırsatı verirdi. Turu son şans zamanlayıcısı açar.
      if (t.sonSansBitis !== null) return t
      if (t.adim >= STEPS.length - 1) return { ...t, faz: 'acildi', beklemeBitis: null }
      return { ...t, faz: 'caliyor', adim: t.adim + 1, beklemeBitis: null }

    case 'DOGRU': {
      if (!tahminAcik(t) || t.bilenler.some((b) => b.id === e.id)) return t
      const sira = t.bilenler.length
      return {
        ...t,
        bilenler: [...t.bilenler, { id: e.id, ad: e.ad, adim: t.adim, puan: adimPuani(t.adim, sira) }],
        sonSansBitis: sira === 0 ? e.simdi + SON_SANS_MS : t.sonSansBitis,
      }
    }

    case 'SON_SANS_BITTI':
    case 'AC':
      return tahminAcik(t) ? { ...t, faz: 'acildi', beklemeBitis: null, sonSansBitis: null } : t

    case 'SIFIRLA':
      return bosTur<S>()
  }
}

/**
 * Bir sohbet mesajı turun cevabı mı?
 *
 * ⚠️ `easySearch: false` — sıkı eşik. Sohbette öneri listesi yok ve binlerce
 * mesaj geliyor; gevşek eşik rastgele mesajları doğru sayardı.
 * ⚠️ Belirsiz sonuç DOĞRU SAYILMAZ: izleyiciye "hangisini kastettin" sorulamaz.
 */
export function sohbetTahminiDogru<T extends Tahminlenebilir>(
  metin: string,
  cevap: T,
  evren: readonly T[],
): boolean {
  const m = metin.trim()
  if (m.length === 0 || m.length > EN_UZUN_MESAJ) return false
  return judgeGuess(m, cevap, evren, { easySearch: false }).kind === 'correct'
}

// --- liderlik tablosu ---

export interface SkorSatiri {
  id: string
  ad: string
  puan: number
  bildigi: number
}

export type SkorTablosu = Readonly<Record<string, SkorSatiri>>

export function skoraIsle(tablo: SkorTablosu, bilenler: readonly Bilen[]): SkorTablosu {
  const yeni: Record<string, SkorSatiri> = { ...tablo }
  for (const b of bilenler) {
    const eski = yeni[b.id]
    // Görünen ad değişmiş olabilir (Twitch'te değiştirilebiliyor): en yenisi yazılır.
    yeni[b.id] = { id: b.id, ad: b.ad, puan: (eski?.puan ?? 0) + b.puan, bildigi: (eski?.bildigi ?? 0) + 1 }
  }
  return yeni
}

export function siralama(tablo: SkorTablosu, n = EN_COK_SIRA): SkorSatiri[] {
  return Object.values(tablo)
    .sort((a, b) => b.puan - a.puan || b.bildigi - a.bildigi || a.ad.localeCompare(b.ad, 'tr'))
    .slice(0, n)
}

/** `localStorage`'dan okunan tabloyu doğrular — bozuk satırlar atılır. */
export function skorTablosuSanitize(ham: unknown): SkorTablosu {
  if (ham === null || typeof ham !== 'object' || Array.isArray(ham)) return {}
  const out: Record<string, SkorSatiri> = {}
  for (const [anahtar, v] of Object.entries(ham as Record<string, unknown>)) {
    const s = v as Partial<SkorSatiri> | null
    if (
      s &&
      s.id === anahtar &&
      typeof s.ad === 'string' &&
      Number.isFinite(s.puan) &&
      Number.isFinite(s.bildigi)
    ) {
      out[anahtar] = { id: anahtar, ad: s.ad.slice(0, 25), puan: s.puan!, bildigi: s.bildigi! }
    }
  }
  return out
}
