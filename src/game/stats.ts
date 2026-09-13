import type { Difficulty } from '@/data/categories'
import { STEPS } from './ladder'

/**
 * Kişisel istatistik — SAF mantık.
 *
 * Sunucu yok, hesap yok, liderlik tablosu yok: sayılar yalnızca oyuncunun
 * tarayıcısında durur. Bu dosyada ne React ne `localStorage` var; depo
 * (`useStatsStore`) yalnızca burayı sarmalıyor ki indirgeme ve süzme
 * test edilebilsin (`vitest` yalnızca `.ts` topluyor).
 *
 * ⚠️ HAM GEÇMİŞ SAKLANMIYOR. Hangi şarkının ne zaman oynandığı tutulsaydı
 * "hiçbir şey saklanmıyor" ilkesi tarayıcıda da delinirdi ve veri zamanla
 * sınırsız büyürdü. Tutulan her alan bir SAYAÇ; hepsi turdan türetiliyor.
 */

/** Kademe sayısı — dağılım dizisinin uzunluğu. */
export const KADEME = 5

export interface Istatistik {
  oynanan: number
  kazanilan: number
  /** Kademe 1..5 sırasıyla: o kademede kaç tur kazanıldı. */
  kademeDagilimi: number[]
  /** En az saniye duyularak bilinen tur. `null` = henüz hiç kazanılmadı. */
  enIyiSaniye: number | null
  toplamDinleme: number
  /** Üst üste kazanılan tur. */
  seri: number
  enIyiSeri: number
  /** ISO tarih; `null` = hiç oynanmadı. */
  sonOynama: string | null
}

export interface TurSonucu {
  won: boolean
  tier: Difficulty
  /** Gerçekten duyulan en uzun klip (sn). 0 = hiç dinlemeden bildi. */
  heardSeconds: number
  listens: number
}

export const BOS: Istatistik = {
  oynanan: 0,
  kazanilan: 0,
  kademeDagilimi: Array.from({ length: KADEME }, () => 0),
  enIyiSaniye: null,
  toplamDinleme: 0,
  seri: 0,
  enIyiSeri: 0,
  sonOynama: null,
}

/** Biten bir turu sayaçlara işler. Girdi değişmez, yeni nesne döner. */
export function uygula(s: Istatistik, t: TurSonucu, simdi = new Date()): Istatistik {
  const dagilim = [...s.kademeDagilimi]
  if (t.won) dagilim[t.tier - 1] = (dagilim[t.tier - 1] ?? 0) + 1

  const seri = t.won ? s.seri + 1 : 0

  return {
    oynanan: s.oynanan + 1,
    kazanilan: s.kazanilan + (t.won ? 1 : 0),
    kademeDagilimi: dagilim,
    /*
     * ⚠️ "En iyi" yalnızca KAZANILAN turdan gelir. Kaybedilen turda oyuncu
     * merdivenin sonuna kadar dinlemiş olabilir ama bilememiştir; onu rekor
     * saymak 10 saniyelik bir kaybı "en iyi" yapardı.
     */
    enIyiSaniye: t.won
      ? s.enIyiSaniye === null
        ? t.heardSeconds
        : Math.min(s.enIyiSaniye, t.heardSeconds)
      : s.enIyiSaniye,
    toplamDinleme: s.toplamDinleme + t.listens,
    seri,
    enIyiSeri: Math.max(s.enIyiSeri, seri),
    sonOynama: simdi.toISOString(),
  }
}

/**
 * Kazanma yüzdesi, 0-100 arası tam sayı. Hiç oynanmadıysa 0.
 *
 * Girdi bilerek DAR: arayüz deponun tamamına abone olmak zorunda kalmasın.
 */
export function isabet(s: Pick<Istatistik, 'oynanan' | 'kazanilan'>): number {
  return s.oynanan === 0 ? 0 : Math.round((s.kazanilan / s.oynanan) * 100)
}

/**
 * "En iyi saniye" olabilecek değerler.
 *
 * ⚠️ Aralık kontrolü YETMEZ. `heardLength` her zaman merdivenin bir basamağını
 * ya da 0'ı döndürüyor; 0 ile 10 arasında herhangi bir sayıyı kabul etmek
 * kurcalanmış bir kaydın "7 saniyede bildim" gibi hiç var olmamış bir rekoru
 * ekranda göstermesine izin verirdi.
 */
const GECERLI_SANIYE = new Set<number>([0, ...STEPS])

/**
 * `localStorage`'dan gelen değeri süzer.
 *
 * ⚠️ `useSettingsStore`'daki `sanitize` ile aynı gerekçe: kayıt eski bir
 * sürümden kalmış, elle kurcalanmış ya da yarım yazılmış olabilir. Fark şu ki
 * burada alanlar BİRBİRİNE bağlı — kazanılan, oynanandan büyük olamaz — ve
 * tutarsız bir çift, "%340 isabet" gibi saçma bir ekran demek. Bu yüzden tek
 * tek alan doğrulaması yetmiyor, ilişkiler de zorlanıyor.
 */
export function sanitize(v: unknown): Istatistik {
  const raw = (v ?? {}) as Record<string, unknown>

  const sayi = (x: unknown, tavan = 1e7): number => {
    const n = Number(x)
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), tavan) : 0
  }

  const oynanan = sayi(raw.oynanan)
  const kazanilan = Math.min(sayi(raw.kazanilan), oynanan)

  const gelenDagilim = Array.isArray(raw.kademeDagilimi) ? raw.kademeDagilimi : []
  const kademeDagilimi = Array.from({ length: KADEME }, (_, i) => sayi(gelenDagilim[i]))
  // Kademe dağılımının toplamı kazanılan turu aşamaz.
  const toplamDagilim = kademeDagilimi.reduce((a, b) => a + b, 0)
  if (toplamDagilim > kazanilan) {
    for (let i = 0; i < KADEME; i++) kademeDagilimi[i] = 0
  }

  const ham = Number(raw.enIyiSaniye)
  const enIyiSaniye = kazanilan > 0 && GECERLI_SANIYE.has(ham) ? ham : null

  const seri = Math.min(sayi(raw.seri), kazanilan)
  const enIyiSeri = Math.max(Math.min(sayi(raw.enIyiSeri), kazanilan), seri)

  const tarih = typeof raw.sonOynama === 'string' ? new Date(raw.sonOynama) : null
  const sonOynama = tarih && !Number.isNaN(tarih.getTime()) ? tarih.toISOString() : null

  return {
    oynanan,
    kazanilan,
    kademeDagilimi,
    enIyiSaniye,
    toplamDinleme: sayi(raw.toplamDinleme),
    seri,
    enIyiSeri,
    sonOynama,
  }
}
