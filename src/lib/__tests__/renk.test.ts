import { describe, it, expect } from 'vitest'
import { enKisaTon } from '../renk'

const daire = (h: number) => ((h % 360) + 360) % 360

describe('enKisaTon', () => {
  it('kısa yol zaten doğrudansa hedefi aynen verir', () => {
    expect(enKisaTon(205, 330)).toBe(330)
    expect(enKisaTon(80, 38)).toBe(38)
  })

  it('330 → 80 geçişinde 360 üzerinden sarar (440)', () => {
    expect(enKisaTon(330, 80)).toBe(440)
  })

  it('12 → 300 geçişinde geriye sarar (-60)', () => {
    expect(enKisaTon(12, 300)).toBe(-60)
  })

  it('sarılmış bir değerden devam edince de kısa yolu seçer', () => {
    // 440 (= 80) konumundan Pop'a (330): 80 → 330 kısa yolu -110.
    expect(enKisaTon(440, 330)).toBe(330)
    expect(enKisaTon(-60, 12)).toBe(12)
  })

  it('sonuç her zaman hedefle aynı renk ve fark en fazla 180', () => {
    for (let onceki = -720; onceki <= 720; onceki += 37) {
      for (const hedef of [12, 38, 60, 80, 105, 145, 175, 205, 265, 300, 330]) {
        const sonuc = enKisaTon(onceki, hedef)
        expect(daire(sonuc)).toBeCloseTo(daire(hedef))
        expect(Math.abs(sonuc - onceki)).toBeLessThanOrEqual(180)
      }
    }
  })
})
