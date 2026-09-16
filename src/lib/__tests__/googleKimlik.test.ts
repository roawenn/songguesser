import { describe, it, expect } from 'vitest'
import { donusYolu, idTokenDogrula, idTokenGovdesi, yetkiAdresi, yonlendirmeAdresi } from '../googleKimlik'

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
    expect(idTokenDogrula(iyi, { clientId: 'cid', simdi })).toEqual({ ok: true, sub: '1234567890', email: 'a@b.com' })
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
