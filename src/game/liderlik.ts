import { gunEkle, gunGecerli, haftaBasi, type Gun } from './gun'

/**
 * Liderlik dönemleri — saf, moddan bağımsız.
 *
 * ⚠️ `MODLAR` bir izin listesi: istek parametresi doğrudan RPC'ye gidiyor.
 * İleride diğer oyunlar sıralama kazanınca buraya eklenir (dönem anlamları
 * farklı olabilir; o zaman `donemAraligi` moda göre dallanır).
 */

export const MODLAR = ['gunluk'] as const
export type LiderlikModu = (typeof MODLAR)[number]

export const DONEMLER = ['gun', 'hafta'] as const
export type LiderlikDonemi = (typeof DONEMLER)[number]

export function modGecerli(s: unknown): s is LiderlikModu {
  return typeof s === 'string' && (MODLAR as readonly string[]).includes(s)
}

export function donemGecerli(s: unknown): s is LiderlikDonemi {
  return typeof s === 'string' && (DONEMLER as readonly string[]).includes(s)
}

/** Dönemin ilk ve son günü (ikisi de dahil). */
export function donemAraligi(donem: LiderlikDonemi, gun: Gun): { bas: Gun; bit: Gun } {
  if (donem === 'gun') return { bas: gun, bit: gun }
  const bas = haftaBasi(gun)
  return { bas, bit: gunEkle(bas, 6) }
}

/**
 * İstenen gün: geçerliyse o, değilse bugün. Gelecek gün istenemez — boş
 * tablo için önbelleğe kayıt açılmasın.
 */
export function istenenGun(ham: string | null, bugun: Gun): Gun {
  return gunGecerli(ham) && ham <= bugun ? ham : bugun
}

export interface LiderlikSatiri {
  sira: number
  ad: string
  toplam: number
  gunSayisi: number
}
