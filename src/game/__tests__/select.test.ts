import { describe, it, expect } from 'vitest'
import { filterByTier, pickNext } from '../select'
import type { Difficulty } from '@/data/categories'

const havuz = Array.from({ length: 500 }, (_, i) => ({
  id: `s${i}`,
  d: ((i % 5) + 1) as Difficulty,
}))

describe('filterByTier', () => {
  /**
   * ⚠️ Bu testin sabitlediği şey bir hatanın KÖKÜ: kademe yükselince havuz
   * tamamen değişiyor. Bu yüzden bir üst kademe için AYRI aday hazırlanmalı
   * (bkz. `useRound` / `useUnluTur`), yoksa kazanan oyuncunun önyüklemesi
   * her seferinde çöpe gider.
   */
  it('komşu kademeler büyük havuzda AYRIK', () => {
    for (let t = 1; t <= 4; t++) {
      const alt = new Set(filterByTier(havuz, t as Difficulty).map((s) => s.id))
      const ust = filterByTier(havuz, (t + 1) as Difficulty)
      expect(ust.length).toBeGreaterThan(0)
      expect(ust.some((s) => alt.has(s.id))).toBe(false)
    }
  })

  it('havuz inceyse komşu kademelere genişler', () => {
    const ince = [
      { id: 'a', d: 1 as Difficulty },
      { id: 'b', d: 2 as Difficulty },
      { id: 'c', d: 3 as Difficulty },
    ]
    expect(filterByTier(ince, 1).length).toBe(3)
  })
})

describe('pickNext', () => {
  it('oynanmışları atlar', () => {
    const liste = filterByTier(havuz, 2)
    const oynanan = new Set(liste.slice(0, liste.length - 1).map((s) => s.id))
    const sec = pickNext(liste, oynanan)
    expect(sec?.recycled).toBe(false)
    expect(sec?.song.id).toBe(liste[liste.length - 1]!.id)
  })
})
