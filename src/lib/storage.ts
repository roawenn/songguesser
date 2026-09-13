import 'server-only'
import { SUPABASE_URL, restHeaders } from './supabase'

/**
 * Supabase Storage — ünlü görselleri.
 *
 * ⚠️ `restUrl` (`supabase.ts`) BURADA KULLANILAMAZ: içinde `/rest/v1/` sabit
 * gömülü, Storage ise `/storage/v1/` altında yaşıyor. Ayrı bir URL kurucu şart.
 *
 * ⚠️ Yükleme HEP SUNUCUDAN. Kova herkese açık okunuyor ama yazma yalnızca
 * secret key ile mümkün (kovada hiçbir yazma politikası yok, RLS gerisini
 * reddediyor — anon anahtarla POST denendi, 403 döndü). Secret key tarayıcıya
 * asla inmemeli.
 */

export const UNLU_KOVA = 'unluler'

/** Tarayıcının göreceği herkese açık adres. */
export function storagePublicUrl(kova: string, yol: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${kova}/${yol}`
}

/** Yazma/silme adresi — yalnızca sunucudan, secret key ile. */
function yazUrl(kova: string, yol: string): string {
  return `${SUPABASE_URL}/storage/v1/object/${kova}/${yol}`
}

/**
 * Görseli depoya yazar. Aynı yol varsa ÜZERİNE yazar.
 *
 * ⚠️ `x-upsert` şart: küratör bir ünlüyü yeniden kırptığında yol değişmiyor
 * (yol id'den türüyor), dolayısıyla ikinci yazma çakışırdı.
 */
export async function storageYukle(
  kova: string,
  yol: string,
  govde: ArrayBuffer | Uint8Array,
  tip: string,
): Promise<boolean> {
  try {
    const res = await fetch(yazUrl(kova, yol), {
      method: 'POST',
      headers: { ...restHeaders({ secret: true, tip }), 'x-upsert': 'true' },
      body: govde as BodyInit,
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`[storage] yüklenemedi ${kova}/${yol}: ${res.status} ${await res.text()}`)
      return false
    }
    return true
  } catch (e) {
    console.error(`[storage] yüklenemedi ${kova}/${yol}:`, e)
    return false
  }
}

/**
 * Depodaki dosyayı siler.
 *
 * ⚠️ Başarısızlık YUTULUYOR ve bu bilinçli: yetim bir DOSYA oyunu bozmaz
 * (kimse onu istemez), yetim bir SATIR bozar (oyun var olmayan görseli ister).
 * Bu yüzden sıra hep "satırı sil, sonra dosyayı dene".
 */
export async function storageSil(kova: string, yol: string): Promise<boolean> {
  try {
    const res = await fetch(yazUrl(kova, yol), {
      method: 'DELETE',
      headers: restHeaders({ secret: true, tip: null }),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}
