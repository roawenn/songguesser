import { describe, it, expect } from 'vitest'
import { donemAraligi, donemGecerli, istenenGun, modGecerli } from '../liderlik'

describe('liderlik dönemleri', () => {
  it('gün ve hafta aralığı (pazartesi-pazar)', () => {
    expect(donemAraligi('gun', '2026-09-16')).toEqual({ bas: '2026-09-16', bit: '2026-09-16' })
    expect(donemAraligi('hafta', '2026-09-16')).toEqual({ bas: '2026-09-14', bit: '2026-09-20' })
    expect(donemAraligi('hafta', '2026-09-20')).toEqual({ bas: '2026-09-14', bit: '2026-09-20' })
    expect(donemAraligi('hafta', '2026-12-31')).toEqual({ bas: '2026-12-28', bit: '2027-01-03' })
  })

  it('izin listeleri', () => {
    expect(modGecerli('gunluk')).toBe(true)
    expect(modGecerli('sarki')).toBe(false)
    expect(modGecerli(null)).toBe(false)
    expect(donemGecerli('hafta')).toBe(true)
    expect(donemGecerli('ay')).toBe(false)
  })

  it('istenen gün: geçersiz ya da gelecekse bugün', () => {
    expect(istenenGun('2026-09-10', '2026-09-16')).toBe('2026-09-10')
    expect(istenenGun('2026-09-17', '2026-09-16')).toBe('2026-09-16')
    expect(istenenGun('dün', '2026-09-16')).toBe('2026-09-16')
    expect(istenenGun(null, '2026-09-16')).toBe('2026-09-16')
  })
})
