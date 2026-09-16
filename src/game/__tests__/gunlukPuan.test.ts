import { describe, it, expect } from 'vitest'
import {
  EN_YUKSEK_PUAN, HAZIR_TAVAN_MS, hazirKirp, hizBonusu, turPuani, turSuresi,
} from '../gunlukPuan'

describe('hizBonusu', () => {
  it('0 sn tam, 30 sn yarım, 60 sn ve sonrası sıfır', () => {
    expect(hizBonusu(0)).toBe(20)
    expect(hizBonusu(30_000)).toBe(10)
    expect(hizBonusu(60_000)).toBe(0)
    expect(hizBonusu(600_000)).toBe(0)
    expect(hizBonusu(-5)).toBe(20)
  })
})

describe('turPuani', () => {
  it('adım puanı 100/80/60/40/20 + bonus', () => {
    expect([0, 1, 2, 3, 4].map((a) => turPuani({ kazandi: true, adimIndeksi: a, sureMs: 60_000 }).puan))
      .toEqual([100, 80, 60, 40, 20])
    expect(turPuani({ kazandi: true, adimIndeksi: 0, sureMs: 0 })).toEqual({ puan: 120, hizBonusu: 20 })
  })

  it('kaybedilen tur sıfır, bonus da yok', () => {
    expect(turPuani({ kazandi: false, adimIndeksi: 0, sureMs: 0 })).toEqual({ puan: 0, hizBonusu: 0 })
  })

  it('en yüksek puan 720', () => {
    expect(EN_YUKSEK_PUAN).toBe(720)
  })
})

describe('süre', () => {
  it('hazırlanma süresi kırpılarak düşülür', () => {
    expect(hazirKirp(null)).toBe(0)
    expect(hazirKirp(-100)).toBe(0)
    expect(hazirKirp(Number.NaN)).toBe(0)
    expect(hazirKirp(999_999)).toBe(HAZIR_TAVAN_MS)
    expect(turSuresi(1_000, 2_000, 10_000)).toBe(7_000)
    expect(turSuresi(1_000, 999_999, 10_000)).toBe(0)
  })
})
