import { describe, it, expect } from 'vitest'
import { kademeOku, seckiParametreleri, yilOku } from '../havuzDilim'

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
  it('Karışık + Tümü süzgeçsiz', () => {
    expect(seckiParametreleri('karisik', 'tumu', 2026)).toEqual({
      p_kategori: null,
      p_min_yil: null,
      p_tek_yil: null,
    })
  })

  it('tür seçkisi kategoriye çevrilir', () => {
    expect(seckiParametreleri('rap', 'tumu', 2026)).toEqual({
      p_kategori: 'rap',
      p_min_yil: null,
      p_tek_yil: null,
    })
  })

  it('kümülatif yıl eşiği alt sınıra çevrilir', () => {
    expect(seckiParametreleri('karisik', '2020', 2026)).toEqual({
      p_kategori: null,
      p_min_yil: 2020,
      p_tek_yil: null,
    })
  })

  it('"Bu yıl" TEK yıla çevrilir, alt sınıra değil', () => {
    expect(seckiParametreleri('pop', 'yeni', 2026)).toEqual({
      p_kategori: 'pop',
      p_min_yil: null,
      p_tek_yil: 2026,
    })
  })

  /*
   * ⚠️ En yeni yıl bilinmiyorsa (Supabase okunamadı) yıl HİÇ süzülmez.
   * Uydurma bir yıl geçmek paketi sessizce boşaltırdı.
   */
  it('en yeni yıl bilinmiyorsa "Bu yıl" süzgeçsiz kalır', () => {
    expect(seckiParametreleri('pop', 'yeni', null)).toEqual({
      p_kategori: 'pop',
      p_min_yil: null,
      p_tek_yil: null,
    })
  })
})

describe('yilOku', () => {
  it('geçerli kimlikleri kabul eder', () => {
    expect(yilOku('yeni')).toBe('yeni')
    expect(yilOku('2020')).toBe('2020')
    expect(yilOku('tumu')).toBe('tumu')
  })

  it('geçersiz ve uydurma değerleri reddeder', () => {
    // ⚠️ Her farklı yazım ayrı bir CDN anahtarı; gevşek ayrıştırma yok.
    for (const ham of ['2021', '', 'YENI', ' yeni', '90', 'doksanlar', null]) {
      expect(yilOku(ham)).toBeNull()
    }
  })
})
