import 'server-only'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { restUrl, restHeaders, supabaseReady } from './supabase'

/**
 * Yönetim paneli girişi.
 *
 * ⚠️ Şifre ARTIK ORTAM DEĞİŞKENİNDE DEĞİL, veritabanında tuzlu scrypt özeti
 * olarak duruyor; oturum çerezi de rastgele bir kimlik.
 *
 * Eskiden çerez `sha256(şifre + ":tahmin.net")` idi — tuzsuz, statik bir
 * TÜREV. Üç ayrı sonucu vardı:
 *   1. Çıkış yapmak çerezi iptal etmiyordu; sunucu tarafında sonsuza kadar
 *      geçerli kalıyordu. Çalınan bir çerezi geçersizleştirmenin tek yolu
 *      şifreyi değiştirmekti.
 *   2. `maxAge` yalnızca tarayıcıya bir öneriydi; sunucu tarafında süre sonu
 *      diye bir şey yoktu.
 *   3. Çerezi ele geçiren biri, bilinen sonekli tek turlu bir SHA-256'yı
 *      çevrimdışı kırıp doğrudan şifreye ulaşabilirdi.
 *
 * ⚠️ Bu, "veritabanı ortam değişkeninden güvenlidir" diye yapılmadı — DB'ye
 * zaten env'deki secret key ile gidiliyor ve o anahtar admin şifresinden daha
 * yetkili. Kazanç, şifrenin NEREDE değil NASIL durduğundan geliyor.
 *
 * Şifreyi kurmak/değiştirmek: `npm run admin:parola -- <yeni-parola>`
 */

export const ADMIN_COOKIE = 'tahmin_yonetim'

const scryptAsync = promisify(scrypt) as (
  parola: string,
  tuz: string,
  uzunluk: number,
) => Promise<Buffer>

/** scrypt maliyeti — varsayılan N=16384; tek yöneticili panel için fazlasıyla yeterli. */
const HASH_UZUNLUK = 64
const OTURUM_GUN = 30

export async function parolaOzeti(parola: string, tuz: string): Promise<string> {
  return (await scryptAsync(parola, tuz, HASH_UZUNLUK)).toString('hex')
}

export function yeniTuz(): string {
  return randomBytes(16).toString('hex')
}

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

interface Hesap {
  parola_hash: string
  tuz: string
}

async function hesap(): Promise<Hesap | null> {
  const res = await rest('admin_hesap?id=eq.1&select=parola_hash,tuz&limit=1')
  if (!res.ok) return null
  const rows = (await res.json()) as Hesap[]
  return rows[0] ?? null
}

/**
 * Şifre doğruysa YENİ bir oturum açar ve çerez değerini döndürür.
 *
 * ⚠️ Karşılaştırma sabit zamanlı. scrypt özetleri her zaman aynı uzunlukta
 * olduğu için `timingSafeEqual` doğrudan kullanılabiliyor.
 */
/**
 * ⚠️ "Şifre yanlış" ile "oturum açılamadı" AYRI dönüyor.
 *
 * İkisi de `null` dönüyordu ve rota ikisini birden "Şifre yanlış" diye
 * gösteriyordu. Veritabanı bir an takıldığında doğru şifreyle giren kişi
 * şifresini yanlış sanıp defalarca deniyor, üstelik hız sınırını da kendi
 * üstüne kilitliyordu. Teşhis edilemeyen bir hata, olmayan bir hatadan beterdir.
 */
export type OturumSonuc =
  | { ok: true; id: string }
  | { ok: false; sebep: 'parola' | 'sunucu' }

export async function oturumAc(parola: string): Promise<OturumSonuc> {
  const h = await hesap()
  if (!h) return { ok: false, sebep: 'sunucu' }

  const gelen = Buffer.from(await parolaOzeti(parola, h.tuz), 'hex')
  const beklenen = Buffer.from(h.parola_hash, 'hex')
  if (gelen.length !== beklenen.length || !timingSafeEqual(gelen, beklenen)) {
    return { ok: false, sebep: 'parola' }
  }

  const id = randomBytes(32).toString('hex')
  const biter = new Date(Date.now() + OTURUM_GUN * 24 * 3600 * 1000).toISOString()
  const res = await rest('admin_oturum', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id, biter }),
  })
  if (!res.ok) {
    console.error(`[yonetim] oturum yazılamadı: Supabase ${res.status}`)
    return { ok: false, sebep: 'sunucu' }
  }
  return { ok: true, id }
}

/** Çerezdeki oturumu siler — GERÇEK iptal, yalnızca tarayıcıyı temizlemek değil. */
export async function oturumKapat(): Promise<void> {
  const id = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!id) return
  await rest(`admin_oturum?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function isAuthed(): Promise<boolean> {
  const id = (await cookies()).get(ADMIN_COOKIE)?.value
  // 64 hex karakter: biçimi tutmayan değer veritabanına hiç sorulmaz.
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return false

  const res = await rest(
    `admin_oturum?id=eq.${id}&biter=gt.${new Date().toISOString()}&select=id&limit=1`,
  )
  if (!res.ok) return false
  return ((await res.json()) as unknown[]).length === 1
}

/**
 * Panel yapılandırılmış mı?
 *
 * ⚠️ Artık ASENKRON: "şifre env'de tanımlı mı" yerine "veritabanında hesap
 * satırı var mı" sorusuna dönüştü. `yonetim/page.tsx` bir Server Component
 * olduğu için `await` sorun değil.
 */
export async function adminConfigured(): Promise<boolean> {
  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) return false
  return (await hesap()) !== null
}
