import { describe, it, expect } from 'vitest'
import { adDenetle, adHarfi, adNormu, adTonu, denetimMetni } from '../kullaniciAdi'
import { uygunsuzMu } from '@/lib/uygunsuz'

const hata = (ad: string) => {
  const r = adDenetle(ad, uygunsuzMu)
  return r.ok ? null : r.hata
}

describe('biçim', () => {
  it('uzunluk, karakter, alt çizgi, yalnız rakam', () => {
    expect(hata('ab')).toBe('uzunluk')
    expect(hata('a'.repeat(21))).toBe('uzunluk')
    expect(hata('ali kaya')).toBe('karakter')
    expect(hata('ali-kaya')).toBe('karakter')
    expect(hata('ali🎵')).toBe('karakter')
    expect(hata('_ali')).toBe('alt-cizgi')
    expect(hata('ali_')).toBe('alt-cizgi')
    expect(hata('ali__kaya')).toBe('alt-cizgi')
    expect(hata('12345')).toBe('yalniz-rakam')
  })

  it('Türkçe harfler ve rakamlar kabul', () => {
    for (const ad of ['Şule', 'Ömer_Çağlar', 'ığdır34', 'İlkay', 'ali_kaya99']) expect(hata(ad)).toBeNull()
  })
})

describe('benzersizlik anahtarı', () => {
  it('büyük/küçük, Türkçe harf ve alt çizgi aynı sayılır', () => {
    expect(adNormu('Şule')).toBe(adNormu('sule'))
    expect(adNormu('su_le')).toBe(adNormu('SULE'))
    expect(adNormu('İlkay')).toBe('ilkay')
  })

  it('leet benzersizliğe girmez, yalnız denetime', () => {
    expect(adNormu('mehmet1')).not.toBe(adNormu('mehmeti'))
    expect(denetimMetni('4dm1n')).toBe('admin')
  })
})

describe('ayrılmış adlar', () => {
  it('tam ve önek', () => {
    for (const ad of ['admin', 'Admin_01', '4dm1n', 'moderator', 'tahmin_resmi', 'TahminNet', 'yonetim', 'Yönetici', 'gunluk', 'misafir', 'destek_ekibi']) {
      expect(hata(ad)).toBe('rezerve')
    }
    for (const ad of ['modern', 'bottega', 'devrim', 'sistematik_ali'.slice(0, 3) + 'kan']) expect(hata(ad)).toBeNull()
  })
})

describe('uygunsuzluk', () => {
  it('yaygın küfürler, leet ve bileşik adlar', () => {
    for (const ad of [
      'orospu', '0r0spu', 'yarrak', 'ibne', 'ibn3', 'amcik', 'amc1k', 'amk', 'aqq', 'kahpe', 'kahp3',
      'sikici', 's1k1c1', 'salakbey', 'pic_kurusu', 'anani_s', 'gotveren', 'pust',
      'fuck', 'f_u_c_k', 'shit99', 'bitch', 'asshole', 'bok', 'siktirici', 'sakso', 'mal',
    ]) {
      expect([ad, hata(ad)]).toEqual([ad, 'uygunsuz'])
    }
  })

  /*
   * Bilinen boşluklar: "kocasik99" gibi kısa kökü ortada taşıyan bileşikler
   * ("sik" kökü "kasik", "sikke"yi de keserdi) ve "Amina" (terlik "amına"
   * okuyor). Kaçan ad yönetimden sıfırlanır.
   */
  it('masum adlar geçer (Scunthorpe)', () => {
    for (const ad of [
      'amsterdam', 'sikke', 'siklet', 'kasik', 'kasikci', 'memur', 'ambulans', 'amasya', 'gotik', 'ammar',
      'Nigar', 'Nazif', 'saksofon', 'fukara', 'rapper', 'Memed', 'malatya44', 'tarkanfan',
      'sezen_aksu', 'bokser', 'Ahmet34', 'penisilin', 'Mustafa', 'Gökhan', 'Kasımpaşa',
    ]) {
      expect([ad, hata(ad)]).toEqual([ad, null])
    }
  })
})

describe('avatar', () => {
  it('ton kararlı ve 0-359; harf Türkçe büyük', () => {
    expect(adTonu('Şule')).toBe(adTonu('sule'))
    expect(adTonu('ali')).toBeGreaterThanOrEqual(0)
    expect(adTonu('ali')).toBeLessThan(360)
    expect(adHarfi('ilkay')).toBe('İ')
    expect(adHarfi('34_ali')).toBe('A')
  })
})
