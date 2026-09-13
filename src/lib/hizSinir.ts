import 'server-only'
import { createHash } from 'node:crypto'
import { restUrl, restHeaders } from './supabase'

/**
 * Herkese açık yazma yollarının hız sınırı.
 *
 * ⚠️ Sayaç VERİTABANINDA. Süreç içi bir Map yazmak çok daha ucuz olurdu ama
 * Vercel'de her lambda örneğinin kendi sayacı olur ve soğuk başlangıçta
 * sıfırlanır — kararlı bir saldırganı hiç durdurmaz. Sayma ve karar tek bir
 * SQL deyiminde (`hiz_sinir_dene`) olduğu için iki eşzamanlı istek aynı
 * sayacı okuyup ikisi birden geçemiyor.
 *
 * ⚠️ HAM IP SAKLANMIYOR. Anahtar, IP'nin özeti; tablo bir gün sızsa bile
 * kimsenin adresi çıkmaz. Özet, projeye özgü bir gizle tuzlanıyor ki adres
 * uzayı küçük olmasına rağmen (IPv4 4 milyar) kaba kuvvetle çözülemesin.
 */

const TUZ = process.env.SUPABASE_SECRET_KEY ?? 'tahmin.net'

/**
 * İstemci adresinin özeti.
 *
 * ⚠️ `x-forwarded-for`'un İLK girdisi alınır: vekiller kendi adreslerini sona
 * ekler, yani son girdi Vercel'in kendisi olur. İstemci başlığı uydurabilir
 * ama Vercel gerçek adresi listenin başına yazdığı için uydurma değerler
 * ancak kendi kovasını böler, başkasınınkini değil.
 */
function kova(req: Request, ad: string): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'bilinmiyor'
  const ozet = createHash('sha256').update(`${TUZ}:${ip}`).digest('hex').slice(0, 32)
  return `${ad}:${ozet}`
}

export interface SinirAyari {
  /** Kova adı — uç nokta başına ayrı sayaç. */
  ad: string
  limit: number
  /** Postgres `interval` metni, ör. '15 minutes'. */
  pencere: string
  /**
   * Veritabanına ulaşılamazsa isteğe izin verilsin mi?
   *
   * Herkese açık yollarda `true`: Supabase sarsıldığında iletişim formunu ve
   * düelloyu da kapatmanın anlamı yok. Yönetim girişinde `false`: veritabanı
   * yokken zaten giriş yapılamaz, o yüzden kapalı kalmak bedava.
   */
  hataVarsaIzin: boolean
}

/** `true` → istek reddedilmeli. */
export async function sinirAsildi(req: Request, ayar: SinirAyari): Promise<boolean> {
  try {
    const res = await fetch(restUrl('rpc/hiz_sinir_dene'), {
      method: 'POST',
      headers: restHeaders({ secret: true }),
      cache: 'no-store',
      body: JSON.stringify({
        p_anahtar: kova(req, ayar.ad),
        p_limit: ayar.limit,
        p_pencere: ayar.pencere,
      }),
    })
    if (!res.ok) return !ayar.hataVarsaIzin
    return (await res.json()) !== true
  } catch {
    return !ayar.hataVarsaIzin
  }
}

/** RPC yardımcısı — gövde döner, hata olursa null. */
async function rpc(ad: string, govde: unknown): Promise<unknown | null> {
  try {
    const res = await fetch(restUrl(`rpc/${ad}`), {
      method: 'POST',
      headers: restHeaders({ secret: true }),
      cache: 'no-store',
      body: JSON.stringify(govde),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Kova kilitli mi? SAYMADAN bakar.
 *
 * ⚠️ Giriş uç noktasında saymak ile bakmak AYRI olmak ZORUNDA. `sinirAsildi`
 * her çağrıda artırıyor, yani BAŞARILI girişler de kaba kuvvet bütçesini
 * yiyordu; doğru şifreyle üç kez giren kendini kilitliyordu. Bunun kaba kuvvete
 * karşı hiçbir faydası yok — şifreyi bilen zaten içeride.
 */
export async function sinirKilitli(req: Request, ayar: SinirAyari): Promise<boolean> {
  const izin = await rpc('hiz_sinir_bak', {
    p_anahtar: kova(req, ayar.ad),
    p_limit: ayar.limit,
    p_pencere: ayar.pencere,
  })
  if (izin === null) return !ayar.hataVarsaIzin
  return izin !== true
}

/**
 * Bir BAŞARISIZ denemeyi sayar.
 *
 * ⚠️ Yalnızca şifre yanlış olduğunda çağrılmalı. Sunucu hatasını saymak,
 * veritabanı sarsıldığında doğru şifreyi giren kişiyi kilitlerdi.
 */
export async function basarisizSay(req: Request, ayar: SinirAyari): Promise<void> {
  await rpc('hiz_sinir_dene', {
    p_anahtar: kova(req, ayar.ad),
    p_limit: ayar.limit,
    p_pencere: ayar.pencere,
  })
}

/** Kovayı sıfırlar — başarılı girişten sonra. */
export async function sinirSifirla(req: Request, ayar: SinirAyari): Promise<void> {
  await rpc('hiz_sinir_sil', { p_anahtar: kova(req, ayar.ad) })
}

/** Sınır aşıldığında dönecek yanıt. */
export function cokHizli(mesaj = 'Çok fazla istek. Biraz bekleyip tekrar dene.') {
  return Response.json({ error: mesaj }, { status: 429 })
}
