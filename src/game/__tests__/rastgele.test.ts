import { describe, it, expect } from 'vitest'
import { tohumluRastgele } from '../rastgele'

function ilk(n: number, rand: () => number): number[] {
  return Array.from({ length: n }, () => rand())
}

describe('tohumluRastgele', () => {
  it('aynı tohum aynı diziyi üretir', () => {
    expect(ilk(20, tohumluRastgele('2026-09-16:tuz'))).toEqual(ilk(20, tohumluRastgele('2026-09-16:tuz')))
  })

  it('farklı tohum farklı dizi', () => {
    expect(ilk(5, tohumluRastgele('2026-09-16'))).not.toEqual(ilk(5, tohumluRastgele('2026-09-17')))
  })

  it('[0, 1) aralığında ve kabaca düzgün', () => {
    const rand = tohumluRastgele('dagilim')
    const kovalar = [0, 0, 0, 0]
    for (let i = 0; i < 4000; i++) {
      const x = rand()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      kovalar[Math.floor(x * 4)]!++
    }
    for (const k of kovalar) expect(k).toBeGreaterThan(850)
  })
})
