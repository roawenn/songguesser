import { describe, it, expect } from 'vitest'
import { kademeOner } from '../itunesSearch'

/**
 * Kademe önerisi saf bir fonksiyon ve küratörün gördüğü ilk değeri o
 * belirliyor. Sanatçı başına gelen parça sayısı 20 ile 120 arasında
 * değiştiği için oran tabanlı olmak zorunda.
 */
describe('kademeOner', () => {
  it('ilk sıradakiler en kolay, sondakiler en zor', () => {
    expect(kademeOner(0, 100)).toBe(1)
    expect(kademeOner(99, 100)).toBe(5)
  })

  it('hiçbir zaman aralık dışına çıkmaz', () => {
    for (const toplam of [1, 2, 7, 36, 116, 200]) {
      for (let i = 0; i < toplam; i++) {
        const k = kademeOner(i, toplam)
        expect(k).toBeGreaterThanOrEqual(1)
        expect(k).toBeLessThanOrEqual(5)
      }
    }
  })

  it('sıra ilerledikçe kademe geri gitmez', () => {
    for (const toplam of [20, 36, 116]) {
      let onceki = 0
      for (let i = 0; i < toplam; i++) {
        const k = kademeOner(i, toplam)
        expect(k).toBeGreaterThanOrEqual(onceki)
        onceki = k
      }
    }
  })

  it('⚠️ uzun listede kuyruk kademe 5e YIĞILMAZ', () => {
    // Sabit eşiklerle 116 parçanın 88'i kademe 5 oluyordu; oran tabanlı
    // eşikler tam olarak bu regresyonu engelliyor.
    const toplam = 116
    const sayim = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < toplam; i++) sayim[kademeOner(i, toplam)]!++
    expect(sayim[5]!).toBeLessThan(toplam * 0.4)
    for (const k of [1, 2, 3, 4, 5]) expect(sayim[k]!).toBeGreaterThan(0)
  })

  it('tek parçalık listede çökmez', () => {
    expect(kademeOner(0, 1)).toBe(1)
    expect(kademeOner(0, 0)).toBe(1)
  })
})
