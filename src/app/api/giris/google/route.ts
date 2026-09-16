import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { donusYolu, yetkiAdresi, yonlendirmeAdresi } from '@/lib/googleKimlik'
import { OAUTH_COOKIE, cerezAyari } from '@/lib/kullaniciAuth'
import { sinirAsildi } from '@/lib/hizSinir'

/**
 * Google ile girişi başlatır: `state` + PKCE üretir, çereze yazar, Google'a yönlendirir.
 *
 * ⚠️ DÜZ BAĞLANTIYLA çağrılır (`<a href>`), form ile DEĞİL: CSP'de
 * `form-action 'self'` var ve Chrome bunu form gönderiminin YÖNLENDİRMESİNE de
 * uyguluyor — form, Google'a giderken engellenirdi.
 *
 * ⚠️ Çerez `SameSite=Lax`: Google'dan dönüş başka siteden gelen bir gezinme;
 * `Strict` çerez o istekte gönderilmez ve her giriş "state uyuşmadı"yla biterdi.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const donus = donusYolu(url.searchParams.get('donus'))
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = yonlendirmeAdresi(url.origin, process.env)

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri) {
    return NextResponse.redirect(new URL(`${donus}${donus.includes('?') ? '&' : '?'}giris=kapali`, url))
  }
  if (await sinirAsildi(req, { ad: 'giris-baslat', limit: 20, pencere: '10 minutes', hataVarsaIzin: true })) {
    return NextResponse.redirect(new URL(`${donus}${donus.includes('?') ? '&' : '?'}giris=cok-hizli`, url))
  }

  const state = randomBytes(16).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  const res = NextResponse.redirect(yetkiAdresi({ clientId, redirectUri, state, codeChallenge: challenge }))
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}.${encodeURIComponent(donus)}`, cerezAyari(600))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
