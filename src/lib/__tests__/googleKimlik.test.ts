import { describe, it, expect } from 'vitest'
import {
  authTimeTeshis, authTimeUygun, donusYolu, idTokenDogrula, idTokenGovdesi, yetkiAdresi, yonlendirmeAdresi,
} from '../googleKimlik'

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

describe('donusYolu', () => {
  it('site içi yolları kabul eder', () => {
    expect(donusYolu('/gunluk')).toBe('/gunluk')
    expect(donusYolu('/kapak?x=1')).toBe('/kapak?x=1')
  })
  it('açık yönlendirme ve API reddedilir', () => {
    for (const k of [null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'evil', '/api/cikis', '/api', '/a\nb']) {
      expect(donusYolu(k)).toBe('/gunluk')
    }
  })
})

describe('yonlendirmeAdresi', () => {
  it('ortam değişkeni önce; yoksa izinli köken; önizlemede kapalı', () => {
    expect(yonlendirmeAdresi('https://x.vercel.app', { GOOGLE_REDIRECT_URI: 'https://tahmin.net/cb' })).toBe('https://tahmin.net/cb')
    expect(yonlendirmeAdresi('http://localhost:3000', {})).toBe('http://localhost:3000/api/giris/google/donus')
    expect(yonlendirmeAdresi('https://tahmin-git-x.vercel.app', {})).toBeNull()
  })

  it('geliştirmede her yerel port açık, üretimde değil', () => {
    expect(yonlendirmeAdresi('http://localhost:3001', {})).toBe('http://localhost:3001/api/giris/google/donus')
    expect(yonlendirmeAdresi('http://127.0.0.1:3002', {})).toBe('http://127.0.0.1:3002/api/giris/google/donus')
    // Üretimde liste dışındaki hiçbir köken açılmaz — yerel bile olsa.
    expect(yonlendirmeAdresi('http://localhost:3001', { NODE_ENV: 'production' })).toBeNull()
    expect(yonlendirmeAdresi('https://localhost.evil.com', {})).toBeNull()
  })
})

describe('yetkiAdresi', () => {
  it('PKCE S256, state ve kapsam', () => {
    const u = new URL(yetkiAdresi({ clientId: 'cid', redirectUri: 'http://localhost:3000/cb', state: 'st', codeChallenge: 'ch' }))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: 'cid', response_type: 'code', scope: 'openid email profile', state: 'st',
      code_challenge: 'ch', code_challenge_method: 'S256',
    })
  })
})

describe('id_token', () => {
  const simdi = 1_800_000_000_000
  const iyi = { iss: 'https://accounts.google.com', aud: 'cid', exp: simdi / 1000 + 60, sub: '1234567890', email: 'a@b.com', email_verified: true }

  it('gövde okunur, bozuk jwt null', () => {
    expect(idTokenGovdesi(`x.${b64(iyi)}.y`)).toEqual(iyi)
    expect(idTokenGovdesi('bozuk')).toBeNull()
    expect(idTokenGovdesi('a.@@@.c')).toBeNull()
  })

  it('geçerli iddialar', () => {
    expect(idTokenDogrula(iyi, { clientId: 'cid', simdi })).toEqual({ ok: true, sub: '1234567890', email: 'a@b.com', ad: null })
  })

  it('ad: önce name, sonra given_name, yoksa null', () => {
    const d = (x: object) => idTokenDogrula({ ...iyi, ...x }, { clientId: 'cid', simdi })
    expect(d({ name: 'Ahmet Yılmaz', given_name: 'Ahmet' })).toMatchObject({ ok: true, ad: 'Ahmet Yılmaz' })
    expect(d({ given_name: 'Ahmet' })).toMatchObject({ ok: true, ad: 'Ahmet' })
    // Boşluktan ibaret ad yok sayılır — çağıran e-postaya düşsün.
    expect(d({ name: '   ' })).toMatchObject({ ok: true, ad: null })
    expect(d({ name: 42 })).toMatchObject({ ok: true, ad: null })
  })

  it('her alan ayrı reddedilir', () => {
    const d = (x: object) => idTokenDogrula({ ...iyi, ...x }, { clientId: 'cid', simdi })
    expect(d({ iss: 'https://evil.com' })).toEqual({ ok: false, sebep: 'iss' })
    expect(d({ aud: 'baska' })).toEqual({ ok: false, sebep: 'aud' })
    expect(d({ exp: simdi / 1000 - 1 })).toEqual({ ok: false, sebep: 'exp' })
    expect(d({ email_verified: false })).toEqual({ ok: false, sebep: 'email' })
    expect(d({ sub: '' })).toEqual({ ok: false, sebep: 'sub' })
  })
})

describe('yetkiAdresi — yönetici yükseltmesi', () => {
  const temel = { clientId: 'cid', redirectUri: 'https://tahmin.in/cb', state: 's', codeChallenge: 'c' }

  it('normal girişte prompt=select_account, max_age YOK', () => {
    const q = new URL(yetkiAdresi(temel)).searchParams
    expect(q.get('prompt')).toBe('select_account')
    expect(q.get('max_age')).toBeNull()
    expect(q.get('code_challenge_method')).toBe('S256')
  })

  it('maxAge verilince HEM prompt=login HEM max_age=0 gider', () => {
    const q = new URL(yetkiAdresi({ ...temel, maxAge: 0, loginHint: 'a@b.com' })).searchParams
    expect(q.get('max_age')).toBe('0')
    // ⚠️ `prompt=login` şart: Google tek başına `max_age`'i uygulamıyor (ölçüldü).
    expect(q.get('prompt')).toBe('login')
    expect(q.get('login_hint')).toBe('a@b.com')
  })
})

describe('authTimeUygun', () => {
  const simdi = Date.parse('2026-09-22T12:00:00Z')

  it('İDDİA YOKSA kabul eder — Google bu alanı hiç göndermiyor (ölçüldü)', () => {
    expect(authTimeUygun({}, simdi)).toBe(true)
    expect(authTimeUygun({ auth_time: undefined }, simdi)).toBe(true)
    expect(authTimeUygun({ auth_time: null }, simdi)).toBe(true)
  })

  it('iddia gelirse denetlenir: taze kabul, eski RET', () => {
    expect(authTimeUygun({ auth_time: simdi / 1000 - 30 }, simdi)).toBe(true)
    expect(authTimeUygun({ auth_time: simdi / 1000 - 3600 }, simdi)).toBe(false)
  })

  it('bozuk tip reddedilir — "yok" ile "çöp" aynı şey değil', () => {
    expect(authTimeUygun({ auth_time: '1758542400' }, simdi)).toBe(false)
    expect(authTimeUygun({ auth_time: Number.NaN }, simdi)).toBe(false)
  })

  it('gelecekteki damga küçük saat kaymasına izin verir, fazlasına vermez', () => {
    expect(authTimeUygun({ auth_time: simdi / 1000 + 30 }, simdi)).toBe(true)
    expect(authTimeUygun({ auth_time: simdi / 1000 + 600 }, simdi)).toBe(false)
  })
})

describe('authTimeTeshis', () => {
  const simdi = Date.parse('2026-09-22T12:00:00Z')

  it('iddia yoksa ayrı, eskiyse yaşıyla birlikte raporlar', () => {
    expect(authTimeTeshis({}, simdi)).toBe('auth_time-yok')
    expect(authTimeTeshis({ auth_time: 'x' }, simdi)).toBe('auth_time-bozuk')
    expect(authTimeTeshis({ auth_time: simdi / 1000 - 7200 }, simdi)).toBe('auth_time-7200sn-once')
  })
})
