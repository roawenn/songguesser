import { describe, it, expect } from 'vitest'
import { aramaFiltresi, aramaTemizle } from '../yonetimArama'

describe('aramaTemizle', () => {
  it('filtreyi bölen karakterler atılır', () => {
    expect(aramaFiltresi('a,banli_at.is.null)')).toBe('(kullanici_adi_norm.ilike.*abanliatisnull*,email.ilike.*abanli_at.is.null*)')
    for (const k of ['*', ',', '(', ')', '"', '\\', ' ', ':']) {
      const f = aramaFiltresi(`x${k}y`)!
      expect(f.slice(1, -1).split(',')).toHaveLength(2)
      expect(f).not.toContain(`x${k}y`)
    }
  })

  it('Türkçe ad normalize edilir, e-posta korunur', () => {
    expect(aramaTemizle('Şule_K')).toEqual({ ad: 'sulek', eposta: 'ule_k' })
    expect(aramaTemizle('ali@gmail.com')).toEqual({ ad: 'aligmailcom', eposta: 'ali@gmail.com' })
  })

  it('boş ya da yalnız çöp null', () => {
    expect(aramaFiltresi('')).toBeNull()
    expect(aramaFiltresi(null)).toBeNull()
    expect(aramaFiltresi('***,,,')).toBeNull()
  })
})
