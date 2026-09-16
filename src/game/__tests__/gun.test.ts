import { describe, it, expect } from 'vitest'
import {
  gunBaslangici, gunEkle, gunFarki, gunGecerli, haftaBasi, istanbulGunu, sonrakiGunBaslangici,
} from '../gun'

describe('istanbulGunu', () => {
  it('gün İstanbul gece yarısında döner, UTC gece yarısında değil', () => {
    expect(istanbulGunu(new Date('2026-09-15T20:59:59Z'))).toBe('2026-09-15')
    expect(istanbulGunu(new Date('2026-09-15T21:00:00Z'))).toBe('2026-09-16')
    // UTC'de hâlâ 15'i ama İstanbul'da 16'sı
    expect(istanbulGunu(new Date('2026-09-15T23:30:00Z'))).toBe('2026-09-16')
  })

  it('yıl sınırı', () => {
    expect(istanbulGunu(new Date('2026-12-31T20:59:59Z'))).toBe('2026-12-31')
    expect(istanbulGunu(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01')
  })
})

describe('gunGecerli', () => {
  it('biçim ve takvim', () => {
    expect(gunGecerli('2026-09-16')).toBe(true)
    expect(gunGecerli('2028-02-29')).toBe(true)
    for (const s of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-9-16', '20260916', '', null, 5]) {
      expect(gunGecerli(s)).toBe(false)
    }
  })
})

describe('gün aritmetiği', () => {
  it('gunEkle ay, yıl ve artık gün sınırlarını geçer', () => {
    expect(gunEkle('2026-09-30', 1)).toBe('2026-10-01')
    expect(gunEkle('2026-12-31', 1)).toBe('2027-01-01')
    expect(gunEkle('2028-02-28', 1)).toBe('2028-02-29')
    expect(gunEkle('2026-03-01', -1)).toBe('2026-02-28')
    expect(gunEkle('2026-09-16', -90)).toBe('2026-06-18')
  })

  it('gunFarki', () => {
    expect(gunFarki('2026-09-16', '2026-09-15')).toBe(1)
    expect(gunFarki('2027-01-01', '2026-12-31')).toBe(1)
    expect(gunFarki('2026-09-15', '2026-09-16')).toBe(-1)
    expect(gunFarki('2026-09-16', '2026-09-16')).toBe(0)
  })

  it('haftaBasi pazartesiye iner', () => {
    expect(haftaBasi('2026-09-14')).toBe('2026-09-14') // pazartesi
    expect(haftaBasi('2026-09-16')).toBe('2026-09-14') // çarşamba
    expect(haftaBasi('2026-09-20')).toBe('2026-09-14') // pazar
    expect(haftaBasi('2026-09-21')).toBe('2026-09-21') // pazartesi
    expect(haftaBasi('2027-01-01')).toBe('2026-12-28') // yıl sınırı
  })
})

describe('gunBaslangici', () => {
  it('İstanbul gece yarısının UTC anı', () => {
    expect(gunBaslangici('2026-09-16').toISOString()).toBe('2026-09-15T21:00:00.000Z')
  })

  it('saat dilimi verisinden okunur: yaz saatli 2015 kışında fark +2', () => {
    expect(gunBaslangici('2015-01-10').toISOString()).toBe('2015-01-09T22:00:00.000Z')
    expect(gunBaslangici('2015-07-10').toISOString()).toBe('2015-07-09T21:00:00.000Z')
  })

  it('sonrakiGunBaslangici', () => {
    expect(sonrakiGunBaslangici(new Date('2026-09-16T10:00:00Z')).toISOString()).toBe('2026-09-16T21:00:00.000Z')
    expect(sonrakiGunBaslangici(new Date('2026-09-15T21:00:00Z')).toISOString()).toBe('2026-09-16T21:00:00.000Z')
  })
})
