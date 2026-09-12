import { describe, it, expect } from 'vitest'
import {
  encodeChallenge, decodeChallenge, encodeSongRef, decodeSongRef, compareResults,
  type Challenge,
} from '../challenge'
import type { ShareResult } from '../share'

const sonuc: ShareResult = {
  chip: 'pop',
  marks: ['yanlis', 'pas', 'dogru', 'bos', 'bos'],
  won: true,
  heardSeconds: 2,
  listens: 3,
}

const meydan: Challenge = { result: sonuc, tier: 3, songId: 'itunes:1836369368' }

describe('şarkı referansı', () => {
  it('gidiş dönüş bozulmaz', () => {
    const ref = encodeSongRef('itunes:1836369368')!
    expect(decodeSongRef(ref)).toBe('itunes:1836369368')
  })

  it('2³¹ üstündeki kimlikler bozulmaz', () => {
    /**
     * ⚠️ Havuzdaki en büyük iTunes kimliği 6.784.751.987 — int32 sınırının
     * çok üstünde. Bit işleçli bir gizleme bunu sessizce bozardı; bu test
     * tam olarak o regresyonu tutuyor.
     */
    for (const id of ['itunes:6784751987', 'itunes:258513610', 'itunes:9007199254']) {
      expect(decodeSongRef(encodeSongRef(id)!)).toBe(id)
    }
  })

  it('referans kısa ve URL güvenli', () => {
    const ref = encodeSongRef('itunes:6784751987')!
    expect(ref).toMatch(/^[0-9a-z]+$/)
    expect(ref.length).toBeLessThanOrEqual(12)
  })

  it('farklı şarkı farklı referans verir', () => {
    expect(encodeSongRef('itunes:1')).not.toBe(encodeSongRef('itunes:2'))
  })

  it('iTunes biçiminde olmayan kimlik null döner', () => {
    for (const bad of ['', 'spotify:123', 'itunes:', 'itunes:abc', 'itunes:-5', '1836369368']) {
      expect(encodeSongRef(bad)).toBeNull()
    }
  })

  it('bozuk referans null döner, patlamaz', () => {
    // ⚠️ `parseInt` baştaki geçerli kısmı alıp gerisini yutar; tam eşleşme şart.
    for (const bad of ['', '!!!', 'ABC', '1_2', 'zzzzzzzzzzzzzzzz', '1e5']) {
      expect(decodeSongRef(bad)).toBeNull()
    }
  })
})

describe('meydan okuma kodu', () => {
  it('gidiş dönüş bozulmaz', () => {
    expect(decodeChallenge(encodeChallenge(meydan)!)).toEqual(meydan)
  })

  it('tire içeren seçki kimliği bozulmaz', () => {
    // ⚠️ Ayırıcı `_` çünkü `iki-binler` tire içeriyor (share.ts'teki aynı gerekçe).
    const c: Challenge = { ...meydan, result: { ...sonuc, chip: 'iki-binler' } }
    expect(decodeChallenge(encodeChallenge(c)!)?.result.chip).toBe('iki-binler')
  })

  it('yarım saniye ondalığı korunur', () => {
    const c: Challenge = { ...meydan, result: { ...sonuc, heardSeconds: 0.5 } }
    expect(decodeChallenge(encodeChallenge(c)!)?.result.heardSeconds).toBe(0.5)
  })

  it('kaybedilen tur kodlanabilir', () => {
    const c: Challenge = {
      ...meydan,
      result: { ...sonuc, marks: ['yanlis', 'yanlis', 'pas', 'yanlis', 'yanlis'], won: false },
    }
    const geri = decodeChallenge(encodeChallenge(c)!)
    expect(geri?.result.won).toBe(false)
  })

  it('beş kademenin hepsi taşınır', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      expect(decodeChallenge(encodeChallenge({ ...meydan, tier })!)?.tier).toBe(tier)
    }
  })

  it('kodlanamayan şarkı kimliğinde null döner', () => {
    expect(encodeChallenge({ ...meydan, songId: 'bozuk' })).toBeNull()
  })

  it('bozuk kod null döner, patlamaz', () => {
    const bad = [
      '',
      'pop',
      'pop_ypdbb_20_3',                    // paylaşım kodu, meydan okuma değil
      'pop_ypdbb_20_3_3',                  // eksik parça
      'pop_ypdbb_20_3_3_abc_fazla',        // fazla parça
      'pop_ypdbb_20_3_9_abc',              // aralık dışı kademe
      'pop_ypdbb_20_3_0_abc',              // kademe 0 yok
      'yok_ypdbb_20_3_3_abc',              // geçersiz seçki
      'pop_zzzzz_20_3_3_abc',              // geçersiz kutu harfleri
      'pop_ypdbb_20_3_3_!!!',              // geçersiz şarkı referansı
    ]
    for (const k of bad) expect(decodeChallenge(k)).toBeNull()
  })
})

describe('karşılaştırma', () => {
  const kazanan = (heardSeconds: number, listens: number): ShareResult => ({
    ...sonuc, won: true, heardSeconds, listens,
  })
  const kaybeden: ShareResult = { ...sonuc, won: false, heardSeconds: 10, listens: 8 }

  it('kazanan kaybedeni yener', () => {
    expect(compareResults(kazanan(10, 9), kaybeden)).toBe('sen')
    expect(compareResults(kaybeden, kazanan(10, 9))).toBe('arkadas')
  })

  it('iki kayıp berabere', () => {
    expect(compareResults(kaybeden, kaybeden)).toBe('berabere')
  })

  it('ölçü duyulan süre — deneme sayısı değil', () => {
    // Az dinleyip uzun duyan, çok dinleyip kısa duyana KAYBEDER.
    expect(compareResults(kazanan(2, 1), kazanan(0.5, 9))).toBe('arkadas')
  })

  it('süre eşitse az dinleyen kazanır', () => {
    expect(compareResults(kazanan(1, 2), kazanan(1, 5))).toBe('sen')
  })

  it('her şey eşitse berabere', () => {
    expect(compareResults(kazanan(1, 2), kazanan(1, 2))).toBe('berabere')
  })

  it('hiç dinlemeden bilmek en iyisi', () => {
    expect(compareResults(kazanan(0, 0), kazanan(0.5, 1))).toBe('sen')
  })
})
