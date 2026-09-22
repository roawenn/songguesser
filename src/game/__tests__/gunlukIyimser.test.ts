import { describe, it, expect } from 'vitest'
import type { GunlukGorunum, GunlukTurGorunum } from '../gunlukGorunum'
import { iyimserIpucu, iyimserPas } from '../gunlukIyimser'

const sarkiTuru = (ek: Partial<Extract<GunlukTurGorunum, { oyun: 'sarki' }>> = {}): GunlukTurGorunum => ({
  oyun: 'sarki',
  zorluk: 'kolay',
  durum: 'oynaniyor',
  steps: [],
  hakKalan: 3,
  sira: 0,
  medyaVerildi: 1000,
  sonuc: null,
  medya: { p: 'x', cs: 0, du: 30 },
  attempt: 0,
  ipuclari: [],
  cevap: null,
  ...ek,
})

const gorunum = (tur: GunlukTurGorunum): GunlukGorunum => ({
  gun: '2026-09-22',
  oturum: 'o',
  sirali: true,
  kullanicili: false,
  durum: 'oynaniyor',
  zamanAsimi: false,
  puan: null,
  sonTeslim: 9e12,
  turlar: [tur],
})

describe('iyimserPas', () => {
  it('şarkıda kademeyi ve sırayı ilerletir', () => {
    const g = iyimserPas(gorunum(sarkiTuru()))!
    const t = g.turlar[0]!
    expect(t.oyun === 'sarki' && t.attempt).toBe(1)
    expect(t.sira).toBe(1)
    expect(t.steps.map((s) => s.kind)).toEqual(['skip'])
  })

  it('turu bitiren pasta iyimserlik yok (cevap sunucudan)', () => {
    expect(iyimserPas(gorunum(sarkiTuru({ attempt: 4 })))).toBeNull()
  })

  it('ünlü ve kapakta yok (imzalı görsel adresi gerekir)', () => {
    const unlu: GunlukTurGorunum = {
      oyun: 'unlu', zorluk: 'kolay', durum: 'oynaniyor', steps: [], hakKalan: 4, sira: 0,
      medyaVerildi: 1, sonuc: null, medya: { gorsel: '/x' }, acilan: 1, cevap: null,
    }
    expect(iyimserPas(gorunum(unlu))).toBeNull()
  })

  it('bitmiş turda ve bitmiş oyunda yok', () => {
    expect(iyimserPas(gorunum(sarkiTuru({ durum: 'kazandi' })))).toBeNull()
    expect(iyimserPas({ ...gorunum(sarkiTuru()), durum: 'bitti' })).toBeNull()
  })
})

describe('iyimserIpucu', () => {
  it('ipucu ekler, metni yer tutucu', () => {
    const g = iyimserIpucu(gorunum(sarkiTuru()))!
    const t = g.turlar[0]!
    expect(t.oyun === 'sarki' && t.ipuclari).toEqual(['…'])
    expect(t.steps.map((s) => s.kind)).toEqual(['hint'])
    expect(t.oyun === 'sarki' && t.attempt).toBe(1)
  })

  it('iki ipucu alınmışsa ya da son kademedeyse yok', () => {
    expect(iyimserIpucu(gorunum(sarkiTuru({ ipuclari: ['1999', 'T…'] })))).toBeNull()
    expect(iyimserIpucu(gorunum(sarkiTuru({ attempt: 4 })))).toBeNull()
  })
})
