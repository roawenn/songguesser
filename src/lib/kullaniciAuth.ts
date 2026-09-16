import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { restHeaders, restUrl } from '@/lib/supabase'

/**
 * Oyuncu oturumu — `adminAuth.ts` deseninde, ONDAN AYRI.
 *
 * ⚠️ AYRI ÇEREZ, AYRI TABLO: oyuncu oturumu hiçbir koşulda yönetim kontrolünü
 * geçmemeli. Aynı çerez adı ya da tablo kullanılsaydı tek bir hata bunu
 * mümkün kılardı.
 *
 * ⚠️ `__Host-` ÖNEKİ YALNIZCA ÜRETİMDE: tarayıcı bu öneki `Secure` olmadan
 * kabul etmiyor, `http://localhost`ta da Secure çerez yazılamıyor (Safari).
 *
 * ⚠️ BAN HER İSTEKTE: oturum okunurken kullanıcının `banli_at`'ı da geliyor;
 * banlı kullanıcı oturumu olsa bile girişsiz sayılır. Oyun yollarında en geç
 * 5 sn (oturum belleği), hesap yollarında anında.
 */

const URETIM = process.env.NODE_ENV === 'production'
export const KULLANICI_COOKIE = URETIM ? '__Host-tahmin_oturum' : 'tahmin_oturum'
export const OAUTH_COOKIE = URETIM ? '__Host-tahmin_oauth' : 'tahmin_oauth'
const OTURUM_GUN = 60

/** 32 bayt base64url = 43 karakter. */
const BELIRTEC_DESENI = /^[A-Za-z0-9_-]{43}$/

export interface Kullanici {
  id: string
  email: string
  /** Seçilmediyse ya da yönetim sıfırladıysa null — sıralamada görünmez. */
  ad: string | null
  adDegisti: string | null
}

export function cerezAyari(maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: URETIM, path: '/', maxAge }
}

export const OTURUM_SURESI_SN = OTURUM_GUN * 24 * 3600

function ozet(belirtec: string): string {
  return createHash('sha256').update(belirtec).digest('hex')
}

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

/** Yeni oturum açar; çereze yazılacak belirteci döner. */
export async function oturumAc(kullaniciId: string): Promise<string> {
  const belirtec = randomBytes(32).toString('base64url')
  const biter = new Date(Date.now() + OTURUM_SURESI_SN * 1000).toISOString()
  const res = await rest('kullanici_oturum', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: ozet(belirtec), kullanici_id: kullaniciId, biter }),
  })
  if (!res.ok) throw new Error(`kullanici_oturum ${res.status}`)
  return belirtec
}

interface OturumSatiri {
  kullanicilar: {
    id: string
    email: string
    kullanici_adi: string | null
    ad_degisti: string | null
    banli_at: string | null
  } | null
}

/**
 * İsteğin kullanıcısı; girişsiz, süresi dolmuş ya da BANLI ise null.
 *
 * Aynı istek içinde birden çok çağrılırsa tek sorgu yapılsın diye çerez
 * değerine göre küçük bir bellek tutuluyor (istek ömrü kadar değil — 5 sn).
 *
 * ⚠️ DURUM DEĞİŞTİREN yollar `taze: true` vermeli. Bellekteki kayıt adı
 * henüz seçilmemiş gösterebiliyordu ve ad değişikliğindeki 30 gün sınırı
 * atlanıyordu (sınır "ilk ad mı?" sorusuna bağlı).
 */
const bellek = new Map<string, { zaman: number; deger: Kullanici | null }>()

export async function oturumKullanici(secenek: { taze?: boolean } = {}): Promise<Kullanici | null> {
  const belirtec = (await cookies()).get(KULLANICI_COOKIE)?.value
  if (!belirtec || !BELIRTEC_DESENI.test(belirtec)) return null

  const h = ozet(belirtec)
  const hazir = bellek.get(h)
  if (!secenek.taze && hazir && Date.now() - hazir.zaman < 5000) return hazir.deger

  const q = new URLSearchParams({
    id: `eq.${h}`,
    biter: `gt.${new Date().toISOString()}`,
    select: 'kullanicilar(id,email,kullanici_adi,ad_degisti,banli_at)',
  })
  const res = await rest(`kullanici_oturum?${q}`)
  if (!res.ok) return null
  const [satir] = (await res.json()) as OturumSatiri[]
  const k = satir?.kullanicilar
  const deger = k && !k.banli_at ? { id: k.id, email: k.email, ad: k.kullanici_adi, adDegisti: k.ad_degisti } : null

  bellek.set(h, { zaman: Date.now(), deger })
  if (bellek.size > 500) bellek.delete(bellek.keys().next().value!)
  return deger
}

/** Çerezdeki oturumu veritabanından siler (çerezi çağıran temizler). */
export async function oturumKapat(): Promise<void> {
  const belirtec = (await cookies()).get(KULLANICI_COOKIE)?.value
  if (!belirtec || !BELIRTEC_DESENI.test(belirtec)) return
  const h = ozet(belirtec)
  bellek.delete(h)
  await rest(`kullanici_oturum?id=eq.${h}`, { method: 'DELETE' }).catch(() => undefined)
}

/**
 * Durum değiştiren isteklerde köken denetimi (CSRF).
 *
 * `SameSite=Lax` başka siteden gelen POST'ta çerezi zaten göndermiyor; bu,
 * eski tarayıcılar ve alt alan adları için ikinci kat.
 */
export function ayniKoken(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === new URL(req.url).host
  } catch {
    return false
  }
}
