import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { yoneticiEpostaMi } from '@/lib/adminAuth'
import { yetkiAdresi, yonlendirmeAdresi } from '@/lib/googleKimlik'
import { sinirAsildi } from '@/lib/hizSinir'
import { OAUTH_COOKIE, cerezAyari, oturumKullanici } from '@/lib/kullaniciAuth'
import { oauthCerezYaz } from '@/lib/oauthCerez'
import { yok } from '@/lib/yonetimKoru'

/**
 * Yönetici yükseltmesi: Google'a GERÇEK yeniden kimlik doğrulaması için gider.
 *
 * ⚠️ AYRI ROTA, herkese açık `/api/giris/google`'a bayrak EKLENEREK DEĞİL.
 * Oraya `?yonetim=1` koysaydık yetkisiz biri de Google'a yönlendirilir ve
 * "burada yönetim diye bir şey var" bilgisini alırdı. Burada ön koşul rotanın
 * kendisinde: girişsiz ya da listede olmayan için bu uç nokta YOKTUR (404).
 *
 * ⚠️ DÜZ BAĞLANTIYLA çağrılır (`<a href>`), form ile DEĞİL: CSP'de
 * `form-action 'self'` var (bkz. `api/giris/google`).
 */
export async function GET(req: Request) {
  const kullanici = await oturumKullanici({ taze: true })
  if (!yoneticiEpostaMi(kullanici?.email)) return yok()

  const url = new URL(req.url)
  const geri = (ek: string) => {
    const res = NextResponse.redirect(new URL(`/yonetim?yukselt=${ek}`, url))
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  /*
   * ⚠️ `hataVarsaIzin: false`: veritabanı düşükken yükseltme akışı da dursun.
   * Sınır Google'a yönlendirme döngüsünü keser; yetkisi doğrulanmış tek kişiyi
   * hedeflediği için dar tutulabilir.
   */
  if (await sinirAsildi(req, { ad: 'yonetim-yukselt', limit: 10, pencere: '10 minutes', hataVarsaIzin: false })) {
    return geri('cok-hizli')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = yonlendirmeAdresi(url.origin, process.env)
  /*
   * Teşhis YALNIZCA e-posta denetimi geçildikten SONRA veriliyor: bu kişinin
   * yönetici olduğu zaten kanıtlandı, ona "yapılandırma eksik" demek bir şey
   * sızdırmaz.
   */
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri) return geri('kapali')

  const state = randomBytes(16).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  const res = NextResponse.redirect(
    yetkiAdresi({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
      // Açık bir Google oturumu yetmesin: parola/2FA yeniden sorulsun.
      maxAge: 0,
      loginHint: kullanici!.email,
    }),
  )
  res.cookies.set(OAUTH_COOKIE, oauthCerezYaz('y', state, verifier, '/yonetim'), cerezAyari(600))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
