import { describe, it, expect } from 'vitest'
import { gecmisSanitize, gecmiseEkle, seriHesapla } from '../gunlukGecmis'

describe('seriHesapla', () => {
  it('bugün ya da dün biten dizi sürer', () => {
    const g = ['2026-09-13', '2026-09-14', '2026-09-15']
    expect(seriHesapla(g, '2026-09-15')).toEqual({ seri: 3, enIyi: 3 })
    expect(seriHesapla(g, '2026-09-16')).toEqual({ seri: 3, enIyi: 3 })
    expect(seriHesapla(g, '2026-09-17')).toEqual({ seri: 0, enIyi: 3 })
  })

  it('boşluk seriyi böler, en iyi korunur; ay sınırı geçilir', () => {
    const g = ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-05', '2026-09-06']
    expect(seriHesapla(g, '2026-09-06')).toEqual({ seri: 2, enIyi: 4 })
  })

  it('boş ve tekrar', () => {
    expect(seriHesapla([], '2026-09-16')).toEqual({ seri: 0, enIyi: 0 })
    expect(seriHesapla(['2026-09-16', '2026-09-16'], '2026-09-16')).toEqual({ seri: 1, enIyi: 1 })
  })
})

describe('gecmiseEkle / sanitize', () => {
  it('aynı gün ikinci kez yazılmaz', () => {
    const a = gecmiseEkle([], { gun: '2026-09-16', puan: 400, turlar: [100], arsiv: false })
    const b = gecmiseEkle(a, { gun: '2026-09-16', puan: 700, turlar: [100], arsiv: false })
    expect(b).toHaveLength(1)
    expect(b[0]!.puan).toBe(400)
  })

  it('bozuk kayıtlar atılır', () => {
    const s = gecmisSanitize([
      { gun: '2026-09-16', puan: 400, turlar: [100, 'x'], arsiv: false },
      { gun: '2026-02-30', puan: 1 },
      { gun: '2026-09-15', puan: 9999 },
      null,
      'çöp',
    ])
    expect(s).toEqual([{ gun: '2026-09-16', puan: 400, turlar: [100], arsiv: false }])
    expect(gecmisSanitize('değil')).toEqual([])
  })
})
