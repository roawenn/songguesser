/**
 * Google ile giriş — SAF parçalar (ağ ve çerez yok, testli).
 *
 * Akış: yetki kodu + PKCE (S256) + `state`, sunucu tarafı yönlendirme. Google
 * Identity Services betiği YÜKLENMİYOR: CSP'ye dış betik eklemek gerekmiyor ve
 * tarayıcıya ek JS inmiyor.
 *
 * ⚠️ `id_token` İMZASI DOĞRULANMIYOR, bilerek: token Google'ın token uç
 * noktasından TLS üzerinden, istemci gizlisiyle alınıyor. Google'ın kendi
 * belgesi bu durumda imza denetimini gereksiz sayıyor. İddialar (`iss`,
 * `aud`, `exp`, `email_verified`) yine de denetleniyor.
 */

export const GOOGLE_YETKI = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
export const GOOGLE_KAPSAM = 'openid email profile'

/** Girişin açık olduğu kökenler — başka yerde (Vercel önizlemesi) buton gizli. */
export const IZINLI_KOKENLER = ['https://tahmin.in', 'https://tahmin.net', 'http://localhost:3000']
export const DONUS_YOLU = '/api/giris/google/donus'

export function yetkiAdresi(p: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  /**
   * ⚠️ `0` → Google'dan GERÇEK yeniden kimlik doğrulama istenir (parola/2FA),
   * açık oturum yeterli sayılmaz. Yönetici yükseltmesi için.
   *
   * ⚠️ Bu bir İSTEK; kanıtı `id_token`'daki `auth_time` iddiasıdır. Kanıt
   * denetlenmezse `max_age` süsten ibaret kalır — bkz. `authTimeTaze`.
   */
  maxAge?: number
  /** Doğru hesap önseçili gelsin. GÜVENLİK KONTROLÜ DEĞİL: kullanıcı değiştirebilir. */
  loginHint?: string
}): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: GOOGLE_KAPSAM,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
  })
  if (p.maxAge === undefined) {
    // Birden fazla Google hesabı açık olanlar hangisiyle gireceğini seçsin.
    q.set('prompt', 'select_account')
  } else {
    /*
     * ⚠️ `max_age` TEK BAŞINA YETMİYOR — ölçüldü. Yalnızca `max_age=0`
     * gönderildiğinde Google kimliği yeniden doğrulatmıyor ve `id_token`'da
     * ESKİ `auth_time` dönüyordu; `authTimeTaze` haklı olarak reddediyor ve
     * yönetici hiç giremiyordu (günlükte `yukselt-auth-time`).
     *
     * `prompt=login` Google'ın gerçekten uyguladığı zorlama. İkisi birden
     * gönderiliyor: `prompt` yeniden doğrulatır, `max_age` + `auth_time`
     * denetimi bunun GERÇEKTEN olduğunu kanıtlar. Kanıt tarafı düşerse
     * zorlama bir temenniden ibaret kalırdı.
     */
    q.set('prompt', 'login')
    q.set('max_age', String(p.maxAge))
  }
  if (p.loginHint) q.set('login_hint', p.loginHint)
  return `${GOOGLE_YETKI}?${q}`
}

/**
 * `auth_time` iddiası yeniden doğrulamayla ÇELİŞİYOR MU?
 *
 * ⚠️ GOOGLE BU İDDİAYI GÖNDERMİYOR — ölçüldü. OIDC, `max_age` istendiğinde
 * `auth_time`'ı zorunlu kılıyor ama Google'ın `id_token`'ında alan hiç yok
 * (günlükte `auth_time-yok`). Bu yüzden iddianın VARLIĞI şart koşulamaz:
 * koşulmuştu ve sonucu, yöneticinin panele hiç girememesi oldu.
 *
 * Zorlamayı yapan şey `prompt=login` (bkz. `yetkiAdresi`): Google o parametreyi
 * uyguluyor ve kullanıcıya parolasını/2FA'sını yeniden sorduruyor. Elimizdeki
 * garanti bu; imzalı bir kanıt değil, sağlayıcının davranışı.
 *
 * ⚠️ İddia GELİRSE yine denetleniyor: eski bir damga, yeniden doğrulamanın
 * yapılmadığına dair gerçek bir işarettir ve reddedilir. Saldırgan Google'ın
 * imzaladığı token'dan bir alanı çıkaramaz, dolayısıyla "yoksa kabul et"
 * kuralı istismar edilebilir değil.
 */
export function authTimeUygun(
  iddia: Record<string, unknown>,
  simdi: number,
  /*
   * ⚠️ 10 dakika: pencere OAuth gidiş-dönüşünü kapsamalı ama kullanıcı bu arada
   * parola yazıyor, 2FA kodunu telefondan okuyor olabilir.
   */
  pencereMs = 10 * 60_000,
): boolean {
  const t = iddia.auth_time
  // Google'ın durumu: iddia yok → çelişki de yok.
  if (t === undefined || t === null) return true
  if (typeof t !== 'number' || !Number.isFinite(t)) return false
  const fark = simdi - t * 1000
  // Gelecekteki bir damga saat kaymasıdır; küçük bir pay dışında kabul edilmez.
  return fark >= -60_000 && fark <= pencereMs
}

/** Teşhis için günlüğe yazılan kısa açıklama. */
export function authTimeTeshis(iddia: Record<string, unknown>, simdi: number): string {
  const t = iddia.auth_time
  if (t === undefined || t === null) return 'auth_time-yok'
  if (typeof t !== 'number' || !Number.isFinite(t)) return 'auth_time-bozuk'
  return `auth_time-${Math.round((simdi - t * 1000) / 1000)}sn-once`
}

/** Geliştirmede herhangi bir yerel port — `http://localhost:3001` gibi. */
const YEREL_DESEN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/

/**
 * Yönlendirme adresi. `GOOGLE_REDIRECT_URI` verilmişse o; yoksa yalnızca
 * izinli kökenlerde türetilir. `null` → bu ortamda giriş kapalı.
 *
 * ⚠️ `SITE_URL` KULLANILMIYOR: yerelde canlı adrese çözülüyor, giriş dönüşü
 * canlı siteye giderdi.
 *
 * ⚠️ GELİŞTİRMEDE HER YEREL PORT AÇIK. Liste yalnızca `:3000` içeriyordu;
 * ikinci bir `next dev` 3001'e düşünce `girisAcik` false oluyor ve giriş
 * düğmesi SESSİZCE kayboluyordu — "giriş yapma kayboldu" tam olarak buydu.
 * Gevşetme yalnızca `NODE_ENV !== 'production'` için: üretimde köken listesi
 * aynen geçerli. Google Console'da o portun dönüş adresi kayıtlı değilse akış
 * yine `redirect_uri_mismatch` verir — bu kontrol düğmeyi göstermek içindir.
 */
export function yonlendirmeAdresi(origin: string, env: Record<string, string | undefined>): string | null {
  if (env.GOOGLE_REDIRECT_URI) return env.GOOGLE_REDIRECT_URI
  if (IZINLI_KOKENLER.includes(origin)) return `${origin}${DONUS_YOLU}`
  if (env.NODE_ENV !== 'production' && YEREL_DESEN.test(origin)) return `${origin}${DONUS_YOLU}`
  return null
}

/**
 * Girişten sonra dönülecek yol — AÇIK YÖNLENDİRME KORUMASI.
 *
 * Yalnızca site içi mutlak yol: `//evil.com` ve `/\evil.com` tarayıcıda başka
 * siteye gider, `/api` bir uç noktayı tetikler.
 */
export function donusYolu(ham: string | null | undefined, varsayilan = '/gunluk'): string {
  if (!ham || ham.length > 200) return varsayilan
  if (!ham.startsWith('/') || ham.startsWith('//') || ham.startsWith('/\\')) return varsayilan
  if (Array.from(ham).some((c) => c.charCodeAt(0) < 32 || c === '\\')) return varsayilan
  if (ham === '/api' || ham.startsWith('/api/')) return varsayilan
  return ham
}

function base64UrlCoz(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8')
  } catch {
    return null
  }
}

/** JWT'nin gövdesini okur (imza denetimi yok — bkz. dosya başı). */
export function idTokenGovdesi(jwt: string): Record<string, unknown> | null {
  const parca = jwt.split('.')
  if (parca.length !== 3) return null
  const metin = base64UrlCoz(parca[1]!)
  if (!metin) return null
  try {
    const v = JSON.parse(metin) as unknown
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * ⚠️ `ad` ARTIK OKUNUYOR. `GOOGLE_KAPSAM` zaten `profile` istiyordu, yani
 * `name` iddiası hep geliyordu ama atılıyordu; kullanıcı adını oyuncuya elle
 * seçtirmek yerine buradan alıyoruz. Gelmezse `given_name`, o da yoksa
 * `null` — çağıran e-postadan türetiyor (bkz. `epostaAdi`).
 *
 * Bu, gizlilik metnini DEĞİŞTİREN bir karar: "ad soyad alınmaz" taahhüdü
 * güncellendi (bkz. `app/gizlilik`, `schema.sql`).
 */
export type KimlikSonucu =
  | { ok: true; sub: string; email: string; ad: string | null }
  | { ok: false; sebep: 'iss' | 'aud' | 'exp' | 'email' | 'sub' }

export function idTokenDogrula(
  iddia: Record<string, unknown>,
  secenek: { clientId: string; simdi: number },
): KimlikSonucu {
  if (iddia.iss !== 'https://accounts.google.com' && iddia.iss !== 'accounts.google.com') return { ok: false, sebep: 'iss' }
  const aud = iddia.aud
  if (!(aud === secenek.clientId || (Array.isArray(aud) && aud.includes(secenek.clientId)))) return { ok: false, sebep: 'aud' }
  if (typeof iddia.exp !== 'number' || iddia.exp * 1000 <= secenek.simdi) return { ok: false, sebep: 'exp' }
  if (iddia.email_verified !== true || typeof iddia.email !== 'string' || !iddia.email) return { ok: false, sebep: 'email' }
  if (typeof iddia.sub !== 'string' || !/^[0-9A-Za-z_-]{1,255}$/.test(iddia.sub)) return { ok: false, sebep: 'sub' }
  const ham = typeof iddia.name === 'string' && iddia.name.trim()
    ? iddia.name
    : typeof iddia.given_name === 'string' && iddia.given_name.trim()
      ? iddia.given_name
      : null
  return { ok: true, sub: iddia.sub, email: iddia.email, ad: ham }
}
