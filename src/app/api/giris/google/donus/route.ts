import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  GOOGLE_TOKEN, donusYolu, idTokenDogrula, idTokenGovdesi, yonlendirmeAdresi,
} from '@/lib/googleKimlik'
import {
  KULLANICI_COOKIE, OAUTH_COOKIE, OTURUM_SURESI_SN, cerezAyari, oturumAc,
} from '@/lib/kullaniciAuth'
import { googleIleBul, type YazilacakAd } from '@/lib/kullaniciStore'
import { uygunsuzMu } from '@/lib/uygunsuz'
import { oauthCerezCoz } from '@/lib/oauthCerez'
import { ADMIN_COOKIE, YONETICI_SURE_SN, yoneticiEpostaMi, yoneticiOturumAc } from '@/lib/adminAuth'
import { authTimeTeshis, authTimeUygun } from '@/lib/googleKimlik'
import { epostaAdi, gorunenAdDenetle } from '@/text/kullaniciAdi'

/**
 * Google dönüşü: state denetimi → kod takası (PKCE) → kimlik → oturum.
 *
 * ⚠️ HER HATA AYNI YERE: oyuncuya ayrıntı gösterilmez (`?giris=hata`),
 * sebep yalnızca sunucu günlüğüne kısa bir kodla yazılır. Hangi adımın
 * düştüğünü söylemek saldırgana deneme yanılma rehberi olurdu.
 *
 * ⚠️ OAuth çerezi SONUÇ NE OLURSA OLSUN silinir: aynı state ikinci kez
 * kullanılamasın.
 */

function esit(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function yonlendir(url: URL, yol: string, ek?: string) {
  const hedef = ek ? `${yol}${yol.includes('?') ? '&' : '?'}${ek}` : yol
  const res = NextResponse.redirect(new URL(hedef, url))
  res.cookies.set(OAUTH_COOKIE, '', cerezAyari(0))
  res.headers.set('Cache-Control', 'no-store')
  return res
}

/**
 * Hesapta görünecek adı seçer.
 *
 * ⚠️ UYGUNSUZ AD GİRİŞİ ENGELLER ve e-postaya GERİ DÜŞMEZ: kural "bu hesapla
 * kayıt olamazsın, Google'daki adını düzelt" — sessizce başka bir ad üretmek
 * kuralı etkisiz kılardı.
 *
 * Google adı biçim yüzünden kullanılamıyorsa (yalnızca emoji, boş) e-postanın
 * @ öncesi denenir. O da olmazsa hesap ADSIZ açılır: oyun oynanır, yalnızca
 * sıralamada görünmez.
 */
function adBelirle(googleAd: string | null, email: string): { engel: true } | { engel: false; ad: YazilacakAd | null } {
  for (const aday of [googleAd, epostaAdi(email)]) {
    if (!aday) continue
    const s = gorunenAdDenetle(aday, uygunsuzMu)
    if (s.ok) return { engel: false, ad: { ad: s.ad, norm: s.norm } }
    if (s.hata === 'uygunsuz') return { engel: true }
  }
  return { engel: false, ad: null }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ham = (await cookies()).get(OAUTH_COOKIE)?.value ?? ''
  const { tur, state, verifier, donusHam } = oauthCerezCoz(ham)
  const donus = donusYolu((() => {
    try {
      return decodeURIComponent(donusHam)
    } catch {
      return ''
    }
  })())

  const hata = (kod: string) => {
    console.warn(`[giris] ${kod}`)
    return yonlendir(url, donus, 'giris=hata')
  }

  const gelenState = url.searchParams.get('state') ?? ''
  const kod = url.searchParams.get('code') ?? ''
  if (url.searchParams.get('error')) return yonlendir(url, donus, 'giris=iptal')
  if (!state || !verifier || !gelenState || !esit(state, gelenState)) return hata('state')
  if (!kod) return hata('kod-yok')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = yonlendirmeAdresi(url.origin, process.env)
  if (!clientId || !secret || !redirectUri) return hata('yapilandirma')

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: kod,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!tokenRes.ok) return hata(`token-${tokenRes.status}`)
    const { id_token } = (await tokenRes.json()) as { id_token?: string }
    const govde = id_token ? idTokenGovdesi(id_token) : null
    if (!govde) return hata('id-token')

    const kimlik = idTokenDogrula(govde, { clientId, simdi: Date.now() })
    if (!kimlik.ok) return hata(`iddia-${kimlik.sebep}`)

    const secim = adBelirle(kimlik.ad, kimlik.email)
    if (secim.engel) {
      console.warn('[giris] uygunsuz-ad')
      return yonlendir(url, donus, 'giris=uygunsuz-ad')
    }

    const kayit = await googleIleBul(kimlik.sub, kimlik.email, secim.ad)
    if (kayit.banli) return yonlendir(url, donus, 'giris=askida')

    /*
     * ⚠️ "Ad seç" YÖNLENDİRMESİ KALKTI. Oyuncu girişten sonra doğrudan
     * geldiği yere döner; ad zaten Google profilinden yazıldı.
     */
    const belirtec = await oturumAc(kayit.id)
    const res = yonlendir(url, donus)
    res.cookies.set(KULLANICI_COOKIE, belirtec, cerezAyari(OTURUM_SURESI_SN))

    /*
     * Yönetici yükseltmesi (`/api/yonetim/yukselt`'ten gelen akış).
     *
     * ⚠️ ÜÇ KOŞUL BİRDEN: akış yükseltme olarak başlamış olmalı, e-posta
     * `YONETICI_EPOSTALAR` listesinde olmalı ve Google kimliği GERÇEKTEN
     * tazelemiş olmalı. Üçüncüsü olmadan `max_age=0` süsten ibaret kalırdı:
     * aylardır açık duran bir Google oturumu paneli açardı.
     *
     * ⚠️ Eşleşmezse SESSİZCE normal giriş. "Yetkin yok" demek, panelin
     * varlığını ve listede kimin olmadığını söylemek olurdu; kişi `/yonetim`'e
     * gidince zaten 404 görecek.
     */
    if (tur === 'y') {
      if (!yoneticiEpostaMi(kimlik.email)) {
        console.warn('[yonetim] yukselt-eposta')
      } else if (!authTimeUygun(govde, Date.now())) {
        // Teşhis günlüğe: iddia hiç gelmedi mi, yoksa Google eskisini mi döndürdü?
        console.warn(`[yonetim] yukselt-${authTimeTeshis(govde, Date.now())}`)
      } else {
        res.cookies.set(ADMIN_COOKIE, await yoneticiOturumAc(kayit.id), cerezAyari(YONETICI_SURE_SN))
      }
    }
    return res
  } catch {
    return hata('istisna')
  }
}
