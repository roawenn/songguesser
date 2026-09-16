import type { Difficulty } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import type { Song } from '@/data/schema'
import type { Unlu } from '@/data/unlu'
import type { Tahminlenebilir } from '@/text/match'
import type { Gun } from './gun'

/**
 * Günlük mod — herkese aynı altı tur. Saf tipler ve sabitler.
 *
 * ⚠️ SUNUCU HAKEMLİ. Tahminler sunucuda yargılanıyor, cevap tur bitmeden
 * tarayıcıya gitmiyor. Bu dosyadaki tipler sunucu ile istemci arasında
 * paylaşılıyor ama `GunlukSet` ve `GunlukOturum` YALNIZCA SUNUCUDA yaşar;
 * istemciye giden biçim `gunlukGorunum.ts`'te.
 */

export type GunlukOyun = 'sarki' | 'unlu' | 'kapak'
export type GunlukZorluk = 'kolay' | 'zor'

export const GUNLUK_TUR = 6

/** Tur sırası: Ş Ş Ü Ü K K — her çiftte önce kolay (kullanıcı kararı). */
export const GUNLUK_SIRASI: readonly { oyun: GunlukOyun; zorluk: GunlukZorluk }[] = [
  { oyun: 'sarki', zorluk: 'kolay' },
  { oyun: 'sarki', zorluk: 'zor' },
  { oyun: 'unlu', zorluk: 'kolay' },
  { oyun: 'unlu', zorluk: 'zor' },
  { oyun: 'kapak', zorluk: 'kolay' },
  { oyun: 'kapak', zorluk: 'zor' },
]

export const GUNLUK_KADEMELER: Record<GunlukZorluk, readonly Difficulty[]> = {
  kolay: [1, 2],
  zor: [3, 4, 5],
}

/** Slot başına asıl öğenin yanında tutulan yedek sayısı (ölü medya için). */
export const YEDEK_SAYISI = 3

/** Tahmin metninin saklanan/yargılanan en fazla uzunluğu. */
export const EN_UZUN_TAHMIN = 60

/**
 * Setteki bir öğe — cevaplar ve medya dahil TAM anlık görüntü.
 *
 * ⚠️ Anlık görüntü şart: küratör gün içinde bir şarkının kabul anahtarlarını
 * düzenlerse sabah oynayan ile akşam oynayan aynı cevaba farklı hükümle
 * karşılaşmasın.
 */
export type GunlukOge =
  /** `p`, `ar`, `u` DOLU. */
  | { oyun: 'sarki'; sarki: Song }
  | { oyun: 'unlu'; unlu: Unlu }
  /** Kapak adresi (`ar`) ve mağaza adresi (`u`) temsilci şarkıdan. */
  | { oyun: 'kapak'; kapak: Kapak; ar: string; u: string }

export interface GunlukSlot {
  oyun: GunlukOyun
  zorluk: GunlukZorluk
  /** 0 asıl, sonrakiler yedek. */
  adaylar: GunlukOge[]
  /** Yeni başlayan oturumların alacağı aday — ölü medya bulununca ilerler. */
  aktif: number
}

export interface GunlukSet {
  gun: Gun
  /** Yedek takasının eşzamanlılık sayacı. */
  surum: number
  slotlar: GunlukSlot[]
}

/**
 * Turda SONUÇLANMIŞ bir eylem.
 *
 * ⚠️ HAM TAHMİN DEĞİL, HÜKÜM saklanır. Havuz gün içinde değişebilir (yeni
 * şarkı, kapatılan şarkı); ham metin her istekte yeniden yargılansaydı dünkü
 * "yanlış" bugün "belirsiz"e dönüp geçmiş turun sonucunu değiştirebilirdi.
 *
 * `z` = medyanın verilmesinden bu yana geçen ms (sunucu saati).
 */
export type GunlukOlay =
  /** Yanlış: `m` oyuncunun yazdığı, `sa` sanatçı tuttu mu. */
  | { t: 'Y'; m: string; sa: boolean; z: number }
  /** Doğru. */
  | { t: 'D'; z: number }
  /** Pas. */
  | { t: 'P'; z: number }
  /** İpucu (yalnızca şarkı). */
  | { t: 'I'; z: number }

export interface GunlukTurSonucu {
  kazandi: boolean
  /** Kaçıncı adımda bitti (0 = ilk adım). */
  adimIndeksi: number
  /** Hız bonusu için sayılan süre. */
  sureMs: number
  hizBonusu: number
  puan: number
  /** Bitiş anı (epoch ms). */
  bitti: number
}

export interface GunlukTurKaydi {
  /** Slotun hangi adayı oynanıyor. */
  aday: number
  /** Medyanın verildiği an (epoch ms) — hız bonusunun saati buradan başlar. */
  medyaVerildi: number
  /** İstemcinin bildirdiği hazırlanma süresi; kırpılarak düşülür. */
  hazirMs: number | null
  olaylar: GunlukOlay[]
  sonuc: GunlukTurSonucu | null
}

export interface GunlukOturum {
  id: string
  gun: Gun
  sirali: boolean
  /**
   * Oturum AÇILIRKEN girişli olan kullanıcı. Oyun sırasında giriş yapmak buraya
   * yazılmaz — cevabı girişsiz görüp girişli puan toplamak mümkün olmasın.
   */
  kullaniciId: string | null
  /** Bitiş anı (epoch ms) — bitmediyse null. */
  bitti: number | null
  zamanAsimi: boolean
  /** Sıra: `turlar[i]` ↔ `slotlar[i]`. Uzunluk = medyası verilmiş tur sayısı. */
  turlar: GunlukTurKaydi[]
  puan: number | null
  /** Yazma çakışması sayacı (CAS). */
  surum: number
  /** Doğrulanamayan medya takası hakkı kullanıldı mı (oturum başına bir). */
  yedekKullanildi: boolean
}

/** Öğenin yargılamada kullanılan yüzü. */
export function ogeCevabi(oge: GunlukOge): Tahminlenebilir {
  if (oge.oyun === 'sarki') return oge.sarki
  if (oge.oyun === 'unlu') return oge.unlu
  // ⚠️ Kolay mod KAPALI: `k` yalnızca albüm adı; `ks` (sanatçı) kullanılmaz.
  return oge.kapak
}

export function ogeKimligi(oge: GunlukOge): string {
  return ogeCevabi(oge).id
}

/** Oynanan aday. */
export function turOgesi(set: GunlukSet, turIndex: number, kayit: GunlukTurKaydi): GunlukOge | null {
  return set.slotlar[turIndex]?.adaylar[kayit.aday] ?? null
}
