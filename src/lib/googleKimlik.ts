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
export const IZINLI_KOKENLER = ['https://tahmin.net', 'http://localhost:3000']
export const DONUS_YOLU = '/api/giris/google/donus'

export function yetkiAdresi(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: GOOGLE_KAPSAM,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
    // Birden fazla Google hesabı açık olanlar hangisiyle gireceğini seçsin.
    prompt: 'select_account',
  })
  return `${GOOGLE_YETKI}?${q}`
}

/**
 * Yönlendirme adresi. `GOOGLE_REDIRECT_URI` verilmişse o; yoksa yalnızca
 * izinli kökenlerde türetilir. `null` → bu ortamda giriş kapalı.
 *
 * ⚠️ `SITE_URL` KULLANILMIYOR: yerelde canlı adrese çözülüyor, giriş dönüşü
 * canlı siteye giderdi.
 */
export function yonlendirmeAdresi(origin: string, env: Record<string, string | undefined>): string | null {
  if (env.GOOGLE_REDIRECT_URI) return env.GOOGLE_REDIRECT_URI
  return IZINLI_KOKENLER.includes(origin) ? `${origin}${DONUS_YOLU}` : null
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

export type KimlikSonucu =
  | { ok: true; sub: string; email: string }
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
  return { ok: true, sub: iddia.sub, email: iddia.email }
}
