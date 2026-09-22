import { describe, expect, it } from 'vitest'
import { oauthCerezCoz, oauthCerezYaz } from '../oauthCerez'

describe('oauthCerez', () => {
  it('gidiş-dönüş: tür, state, verifier ve yol korunur', () => {
    const c = oauthCerezCoz(oauthCerezYaz('y', 'ST4TE', 'VER1F1ER', '/yonetim'))
    expect(c).toEqual({ tur: 'y', state: 'ST4TE', verifier: 'VER1F1ER', donusHam: '%2Fyonetim' })
    expect(decodeURIComponent(c.donusHam)).toBe('/yonetim')
  })

  it('NOKTALI dönüş yolu bozulmaz (eski biçimin kusuru)', () => {
    const c = oauthCerezCoz(oauthCerezYaz('o', 's', 'v', '/sanatci/a.b.c'))
    expect(decodeURIComponent(c.donusHam)).toBe('/sanatci/a.b.c')
  })

  it('tanınmayan ya da eksik tür OYUNCU sayılır — yükseltme varsayılan olamaz', () => {
    expect(oauthCerezCoz('x.s.v.%2Fa').tur).toBe('o')
    expect(oauthCerezCoz('').tur).toBe('o')
    expect(oauthCerezCoz('Y.s.v.%2Fa').tur).toBe('o')
  })

  it('bozuk girdide çökmez, boş alanlar döner', () => {
    expect(oauthCerezCoz('o')).toEqual({ tur: 'o', state: '', verifier: '', donusHam: '' })
    expect(oauthCerezCoz('o.s')).toEqual({ tur: 'o', state: 's', verifier: '', donusHam: '' })
  })
})
