import { describe, it, expect } from 'vitest'
import { cleanKey } from '@/text/keys'
import {
  ADIM_PUANI, ILK_BILEN_EK, SON_SANS_MS, adimPuani, bosTur, siralama, skoraIsle,
  skorTablosuSanitize, sohbetTahminiDogru, yayinReducer, type YayinEylem, type YayinTuru,
} from '../yayin'
import { STEPS } from '../ladder'

type S = { id: string }
const sarki: S = { id: 's1' }
const r = (t: YayinTuru<S>, ...eylemler: YayinEylem<S>[]) => eylemler.reduce(yayinReducer<S>, t)
const caliyor = () => r(bosTur<S>(), { type: 'KUR', sarki, turNo: 1 }, { type: 'HAZIR' })

describe('yayinReducer — akış', () => {
  it('kur → hazır → çal → bekle → sonraki kademe', () => {
    let t = r(bosTur<S>(), { type: 'KUR', sarki, turNo: 3 })
    expect(t.faz).toBe('hazirlaniyor')
    expect(t.turNo).toBe(3)
    t = r(t, { type: 'HAZIR' })
    expect(t.faz).toBe('caliyor')
    t = r(t, { type: 'KLIP_BITTI', simdi: 1000, beklemeMs: 10_000 })
    expect(t.faz).toBe('bekliyor')
    expect(t.beklemeBitis).toBe(11_000)
    t = r(t, { type: 'BEKLEME_BITTI' })
    expect(t.faz).toBe('caliyor')
    expect(t.adim).toBe(1)
  })

  it('son kademenin beklemesi bitince tur açılır', () => {
    let t = caliyor()
    for (let i = 0; i < STEPS.length; i++) {
      t = r(t, { type: 'KLIP_BITTI', simdi: 0, beklemeMs: 1 }, { type: 'BEKLEME_BITTI' })
    }
    expect(t.faz).toBe('acildi')
    expect(t.adim).toBe(STEPS.length - 1)
  })

  it('yanlış fazdaki eylemler durumu değiştirmez', () => {
    const t = caliyor()
    expect(r(t, { type: 'HAZIR' })).toBe(t)
    expect(r(t, { type: 'BEKLEME_BITTI' })).toBe(t)
    const bos = bosTur<S>()
    expect(r(bos, { type: 'AC' })).toBe(bos)
  })
})

describe('yayinReducer — puanlama', () => {
  it('ilk bilen tam puan + ek, sonraki yarım puan; son şans başlar', () => {
    let t = r(caliyor(), { type: 'DOGRU', id: 'twitch:1', ad: 'Ayşe', simdi: 500 })
    expect(t.bilenler[0]).toEqual({ id: 'twitch:1', ad: 'Ayşe', adim: 0, puan: ADIM_PUANI[0]! + ILK_BILEN_EK })
    expect(t.sonSansBitis).toBe(500 + SON_SANS_MS)
    t = r(t, { type: 'DOGRU', id: 'kick:2', ad: 'Mehmet', simdi: 900 })
    expect(t.bilenler[1]!.puan).toBe(ADIM_PUANI[0]! / 2)
    // Son şans ikinci bilenle UZAMAZ.
    expect(t.sonSansBitis).toBe(500 + SON_SANS_MS)
  })

  it('aynı kişi iki kez puan almaz', () => {
    const t = r(caliyor(), { type: 'DOGRU', id: 'a', ad: 'a', simdi: 0 })
    expect(r(t, { type: 'DOGRU', id: 'a', ad: 'a', simdi: 1 })).toBe(t)
  })

  it('hazırlanırken ve açıldıktan sonra doğru sayılmaz', () => {
    const hazirlaniyor = r(bosTur<S>(), { type: 'KUR', sarki, turNo: 1 })
    expect(r(hazirlaniyor, { type: 'DOGRU', id: 'a', ad: 'a', simdi: 0 })).toBe(hazirlaniyor)
    const acildi = r(caliyor(), { type: 'AC' })
    expect(acildi.faz).toBe('acildi')
    expect(r(acildi, { type: 'DOGRU', id: 'a', ad: 'a', simdi: 0 })).toBe(acildi)
  })

  it('son şans sürerken merdiven ilerlemez; bitince tur açılır', () => {
    let t = r(caliyor(), { type: 'DOGRU', id: 'a', ad: 'a', simdi: 0 }, { type: 'KLIP_BITTI', simdi: 0, beklemeMs: 1 })
    const once = t
    t = r(t, { type: 'BEKLEME_BITTI' })
    expect(t).toBe(once)
    t = r(t, { type: 'SON_SANS_BITTI' })
    expect(t.faz).toBe('acildi')
  })

  it('kademe ilerledikçe puan düşer', () => {
    expect(adimPuani(0, 0)).toBeGreaterThan(adimPuani(2, 0))
    expect(adimPuani(4, 0)).toBe(ADIM_PUANI[4]! + ILK_BILEN_EK)
    expect(adimPuani(99, 1)).toBe(Math.round(ADIM_PUANI[4]! / 2))
  })
})

describe('sohbetTahminiDogru', () => {
  const s = (id: string, ad: string) => ({ id, k: [cleanKey(ad)], nA: '' })
  const cevap = s('1', 'Gülpembe')
  const evren = [cevap, s('2', 'Şımarık'), s('3', 'Sen Ağlama')]

  it('Türkçe karaktersiz yazımı kabul eder', () => {
    expect(sohbetTahminiDogru('gulpembe', cevap, evren)).toBe(true)
    expect(sohbetTahminiDogru('  GÜLPEMBE ', cevap, evren)).toBe(true)
  })

  it('başka şarkı, boş ve çok uzun mesaj doğru değil', () => {
    expect(sohbetTahminiDogru('şımarık', cevap, evren)).toBe(false)
    expect(sohbetTahminiDogru('   ', cevap, evren)).toBe(false)
    expect(sohbetTahminiDogru(`gulpembe ${'x'.repeat(60)}`, cevap, evren)).toBe(false)
  })
})

describe('liderlik tablosu', () => {
  it('puanları biriktirir ve sıralar', () => {
    let tablo = skoraIsle({}, [
      { id: 'a', ad: 'Ayşe', puan: 120, adim: 0 },
      { id: 'b', ad: 'Bora', puan: 50, adim: 0 },
    ])
    tablo = skoraIsle(tablo, [{ id: 'b', ad: 'Bora_', puan: 80, adim: 1 }])
    expect(tablo.b).toEqual({ id: 'b', ad: 'Bora_', puan: 130, bildigi: 2 })
    expect(siralama(tablo).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('eşitlikte bildiği sayı, sonra ad', () => {
    const tablo = {
      c: { id: 'c', ad: 'Cem', puan: 100, bildigi: 1 },
      a: { id: 'a', ad: 'Ali', puan: 100, bildigi: 1 },
      z: { id: 'z', ad: 'Zeki', puan: 100, bildigi: 2 },
    }
    expect(siralama(tablo).map((s) => s.id)).toEqual(['z', 'a', 'c'])
  })

  it('bozuk kayıtları atar', () => {
    expect(skorTablosuSanitize(null)).toEqual({})
    expect(skorTablosuSanitize([1, 2])).toEqual({})
    expect(
      skorTablosuSanitize({
        a: { id: 'a', ad: 'Ali', puan: 10, bildigi: 1 },
        b: { id: 'x', ad: 'uyuşmayan', puan: 10, bildigi: 1 },
        c: { id: 'c', ad: 'Cem', puan: 'çok', bildigi: 1 },
      }),
    ).toEqual({ a: { id: 'a', ad: 'Ali', puan: 10, bildigi: 1 } })
  })
})
