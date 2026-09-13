import { describe, it, expect } from 'vitest'
import {
  BASLANGIC,
  acikKirpma,
  cizimAdimi,
  doldurOlcegi,
  donukBoyut,
  kelepcele,
  seritAraligi,
} from '../kirpmaMatematigi'

/**
 * Kırpma aracının matematiği. Arayüzü test edemiyoruz (`vitest` `.tsx`
 * toplamıyor ve canvas yok), bu yüzden hesabın tamamı buraya çıkarıldı.
 *
 * Kilitlenen asıl kural: görsel çerçeveyi HER ZAMAN tam kaplamalı. Boş kalan
 * bir şerit, oyuncuya ipucu yerine arka plan gösterir.
 */

const KARE_G = 360
const KARE_Y = 600 // 3:5

describe('doldurOlcegi', () => {
  it('geniş görselde yüksekliğe göre ölçekler', () => {
    // 1200x600 görsel, 360x600 çerçeve: yükseklik zaten yetiyor (1.0),
    // genişlik 0.3 istiyor → büyük olan kazanır.
    expect(doldurOlcegi(1200, 600, KARE_G, KARE_Y)).toBe(1)
  })

  it('dar görselde genişliğe göre ölçekler', () => {
    // 300x1500: genişlik 1.2 istiyor, yükseklik 0.4 → 1.2
    expect(doldurOlcegi(300, 1500, KARE_G, KARE_Y)).toBeCloseTo(1.2, 5)
  })

  it('tam oranlı görselde 1 verir', () => {
    expect(doldurOlcegi(360, 600, KARE_G, KARE_Y)).toBe(1)
    expect(doldurOlcegi(900, 1500, KARE_G, KARE_Y)).toBeCloseTo(0.4, 5)
  })

  it('90 derecede genişlik ve yükseklik yer değiştirir', () => {
    // Yan yatmış 1500x900 görsel, 90° döndürülünce 900x1500 gibi davranır.
    expect(doldurOlcegi(1500, 900, KARE_G, KARE_Y, 90)).toBeCloseTo(0.4, 5)
  })

  it('bozuk boyutta çökmez', () => {
    expect(doldurOlcegi(0, 0, KARE_G, KARE_Y)).toBe(1)
  })
})

describe('donukBoyut', () => {
  it('yalnızca 90 ve 270 takas eder', () => {
    expect(donukBoyut(900, 1500, 0)).toEqual([900, 1500])
    expect(donukBoyut(900, 1500, 180)).toEqual([900, 1500])
    expect(donukBoyut(900, 1500, 90)).toEqual([1500, 900])
    expect(donukBoyut(900, 1500, 270)).toEqual([1500, 900])
  })
})

describe('kelepcele', () => {
  it('ölçeği doldurma sınırının altına DÜŞÜRMEZ', () => {
    const k = kelepcele({ ...BASLANGIC, olcek: 0.1 }, 900, 1500, KARE_G, KARE_Y)
    expect(k.olcek).toBeCloseTo(0.4, 5)
  })

  it('tam oturan görselde kaydırmaya izin vermez', () => {
    // 900x1500 → ölçek 0.4'te tam oturuyor, taşma yok, kaydırma 0 olmalı.
    const k = kelepcele({ x: 999, y: -999, olcek: 0.4, aci: 0 }, 900, 1500, KARE_G, KARE_Y)
    // ⚠️ `toBe` değil: `Math.max` -0 üretebiliyor ve `Object.is(-0, 0)` false.
    expect(k.x).toBeCloseTo(0, 10)
    expect(k.y).toBeCloseTo(0, 10)
  })

  it('taşma kadar kaydırmaya izin verir, fazlasına değil', () => {
    // ölçek 0.8 → 720x1200; çerçeve 360x600 → yarım taşma 180 / 300.
    const k = kelepcele({ x: 500, y: -500, olcek: 0.8, aci: 0 }, 900, 1500, KARE_G, KARE_Y)
    expect(k.x).toBeCloseTo(180, 5)
    expect(k.y).toBeCloseTo(-300, 5)
  })

  it('sınır içindeki kaydırmayı OLDUĞU GİBİ bırakır', () => {
    const k = kelepcele({ x: 50, y: -120, olcek: 0.8, aci: 0 }, 900, 1500, KARE_G, KARE_Y)
    expect(k.x).toBe(50)
    expect(k.y).toBe(-120)
  })

  it('döndürülmüş görselde de boşluk bırakmaz', () => {
    const k = kelepcele({ x: 0, y: 0, olcek: 0.1, aci: 90 }, 1500, 900, KARE_G, KARE_Y)
    // 90°'de 1500x900 → 900x1500 gibi; doldurma 0.4
    expect(k.olcek).toBeCloseTo(0.4, 5)
  })

  it('açıyı DEĞİŞTİRMEZ', () => {
    expect(kelepcele({ ...BASLANGIC, aci: 270 }, 900, 1500, KARE_G, KARE_Y).aci).toBe(270)
  })
})

describe('cizimAdimi', () => {
  it('çarpan çıktı boyutuna orantılı büyütür', () => {
    const kare = cizimAdimi({ x: 10, y: 20, olcek: 0.8, aci: 0 }, 900, 1500, KARE_G, KARE_Y, 1)
    const buyuk = cizimAdimi({ x: 10, y: 20, olcek: 0.8, aci: 0 }, 900, 1500, KARE_G, KARE_Y, 2.5)
    expect(buyuk.merkezX).toBeCloseTo(kare.merkezX * 2.5, 5)
    expect(buyuk.kaydirX).toBeCloseTo(kare.kaydirX * 2.5, 5)
    expect(buyuk.olcek).toBeCloseTo(kare.olcek * 2.5, 5)
    // ⚠️ Çizim köşesi çarpanla ölçeklenmez: görselin KENDİ koordinatında.
    expect(buyuk.cizX).toBe(kare.cizX)
  })

  it('kelepçelenmiş konumu kullanır', () => {
    const a = cizimAdimi({ x: 9999, y: 0, olcek: 0.8, aci: 0 }, 900, 1500, KARE_G, KARE_Y)
    expect(a.kaydirX).toBeCloseTo(180, 5)
  })

  it('açıyı radyana çevirir', () => {
    expect(cizimAdimi({ ...BASLANGIC, aci: 90 }, 900, 1500, KARE_G, KARE_Y).donus)
      .toBeCloseTo(Math.PI / 2, 6)
  })
})

describe('şerit hesabı', () => {
  it('beş eşit şeride böler', () => {
    expect(seritAraligi(1, 5)).toEqual({ ust: 0, alt: 80 })
    expect(seritAraligi(3, 5)).toEqual({ ust: 40, alt: 40 })
    expect(seritAraligi(5, 5)).toEqual({ ust: 80, alt: 0 })
  })

  /**
   * ⚠️ Oyun ve admin önizlemesi AYNI hesabı kullanmak zorunda. Küratörün
   * gördüğü kırpma oyundakinden farklı olsaydı saçı 1. şeride hizalama işi
   * tamamen boşa giderdi.
   */
  it('açık şerit sayısına göre kırpma', () => {
    expect(acikKirpma(1, 5)).toBe('inset(0 0 80% 0)')
    expect(acikKirpma(2, 5)).toBe('inset(0 0 60% 0)')
    expect(acikKirpma(4, 5)).toBe('inset(0 0 20% 0)')
    expect(acikKirpma(5, 5)).toBe('inset(0 0 0% 0)')
  })

  it('taşan değerlerde kırpma negatife düşmez', () => {
    expect(acikKirpma(9, 5)).toBe('inset(0 0 0% 0)')
  })
})
