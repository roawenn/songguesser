import { describe, it, expect } from 'vitest'
import { kovaIndeksi, kovala, toplamOyuncu, yuzdelik, type DagilimSatiri } from '../dagilim'

describe('yuzdelik', () => {
  const d: DagilimSatiri[] = [[0, 2], [300, 5], [500, 2], [720, 1]]

  it('kesin küçükleri sayar', () => {
    expect(toplamOyuncu(d)).toBe(10)
    expect(yuzdelik(d, 500)).toBe(70)
    expect(yuzdelik(d, 300)).toBe(20)
    expect(yuzdelik(d, 0)).toBe(0)
    expect(yuzdelik(d, 720)).toBe(90)
  })

  it('az oyuncuda gösterilmez', () => {
    expect(yuzdelik([[100, 3]], 100)).toBeNull()
  })
})

describe('kovala', () => {
  it('60 genişliğinde 13 kova; 720 son kovada', () => {
    const k = kovala([[0, 1], [59, 1], [60, 2], [719, 1], [720, 4]])
    expect(k).toHaveLength(13)
    expect(k[0]).toBe(2)
    expect(k[1]).toBe(2)
    expect(k[11]).toBe(1)
    expect(k[12]).toBe(4)
    expect(kovaIndeksi(720)).toBe(12)
    expect(kovaIndeksi(119)).toBe(1)
  })
})
