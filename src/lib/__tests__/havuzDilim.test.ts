import { describe, it, expect } from 'vitest'
import { kademeOku, seckiParametreleri } from '../havuzDilim'

describe('kademeOku', () => {
  it('1-5 arasını kabul eder', () => {
    expect(kademeOku('1')).toBe(1)
    expect(kademeOku('5')).toBe(5)
  })

  it('yoksa ya da geçersizse null — rota tam havuzu döner', () => {
    for (const ham of [null, '', '0', '6', '3abc', '3.5', '03', ' 3']) {
      expect(kademeOku(ham)).toBeNull()
    }
  })
})

describe('seckiParametreleri', () => {
  it('Karışık süzgeçsiz', () => {
    expect(seckiParametreleri('karisik')).toEqual({ p_kategori: null, p_donemler: null })
  })

  it('tür seçkisi kategoriye çevrilir', () => {
    expect(seckiParametreleri('rap')).toEqual({ p_kategori: 'rap', p_donemler: null })
  })

  it('dönem seçkisi dönem listesine çevrilir', () => {
    expect(seckiParametreleri('eskiler')).toEqual({ p_kategori: null, p_donemler: ['70', '80', '90'] })
  })
})
