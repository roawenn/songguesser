import { describe, it, expect } from 'vitest'
import { arsivSiniri, sonTeslimAni } from '../gunlukArsiv'

describe('son teslim ve arşiv sınırı', () => {
  it('son teslim ertesi gün 03:00 İstanbul', () => {
    // 17 Eylül 03:00 İstanbul = 17 Eylül 00:00 UTC
    expect(new Date(sonTeslimAni('2026-09-16')).toISOString()).toBe('2026-09-17T00:00:00.000Z')
  })

  it('02:59 dün hâlâ kapalı, 03:00 açılır', () => {
    const t0259 = Date.parse('2026-09-16T23:59:00Z') // 17 Eylül 02:59 İstanbul
    const t0300 = Date.parse('2026-09-17T00:00:00Z') // 17 Eylül 03:00 İstanbul
    expect(arsivSiniri(t0259)).toBe('2026-09-15')
    expect(arsivSiniri(t0300)).toBe('2026-09-16')
  })

  it('bugün asla arşivde değil', () => {
    const oglen = Date.parse('2026-09-16T09:00:00Z')
    expect(arsivSiniri(oglen)).toBe('2026-09-15')
    expect(sonTeslimAni(arsivSiniri(oglen))).toBeLessThanOrEqual(oglen)
  })
})
