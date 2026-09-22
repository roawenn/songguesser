import { describe, it, expect } from 'vitest'
import { filterByTier, filterByYear, pickNext } from '../select'
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

describe('filterByTier — kademe dilimi', () => {
  it('dilim tam kademeyi HER ZAMAN içerir; başlangıç paketi dilimin alt kümesidir', () => {
    // İnce seçki: kademe 1'de 3 şarkı, genişletme devreye giriyor.
    const havuz = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `k1-${i}`, d: 1 as const })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `k2-${i}`, d: 2 as const })),
    ]
    const dilim = filterByTier(havuz, 1)
    const tamKademe = havuz.filter((s) => s.d === 1)
    expect(dilim.length).toBeGreaterThan(tamKademe.length)
    for (const s of tamKademe) expect(dilim).toContain(s)
  })
})

describe('filterByYear', () => {
  const yillik = [
    { id: 'a', d: 1 as Difficulty, y: 1975 },
    { id: 'b', d: 2 as Difficulty, y: 1995 },
    { id: 'c', d: 3 as Difficulty, y: 2005 },
    { id: 'd', d: 4 as Difficulty, y: 2015 },
    { id: 'e', d: 5 as Difficulty, y: 2023 },
    { id: 'f', d: 1 as Difficulty, y: 2026 },
    { id: 'g', d: 2 as Difficulty, y: 2026 },
  ]

  it('"Tümü" havuzu olduğu gibi döner', () => {
    expect(filterByYear(yillik, 'tumu').map((s) => s.id)).toEqual(
      yillik.map((s) => s.id),
    )
  })

  it('eşik KÜMÜLATİF — o yıl ve sonrası', () => {
    expect(filterByYear(yillik, '2000').map((s) => s.id)).toEqual(['c', 'd', 'e', 'f', 'g'])
    expect(filterByYear(yillik, '1990').map((s) => s.id)).toEqual(['b', 'c', 'd', 'e', 'f', 'g'])
  })

  /**
   * ⚠️ En yeni yıl HAVUZDAN türetiliyor, sabit değil. Sabit olsaydı takvim
   * ilerleyince seçenek sessizce "geçen yıl"a dönerdi.
   */
  it('"Bu yıl" yalnızca havuzun EN YENİ yılını verir', () => {
    expect(filterByYear(yillik, 'yeni').map((s) => s.id)).toEqual(['f', 'g'])
  })

  it('"Bu yıl" eşiği havuzla birlikte kayar', () => {
    const eski = yillik.filter((s) => s.y < 2020)
    expect(filterByYear(eski, 'yeni').map((s) => s.id)).toEqual(['d'])
  })

  it('boş havuzda boş döner', () => {
    expect(filterByYear([], 'yeni')).toEqual([])
    expect(filterByYear([], '2020')).toEqual([])
  })

  it('kaynağı DEĞİŞTİRMEZ', () => {
    const kopya = [...yillik]
    filterByYear(yillik, '2020')
    expect(yillik).toEqual(kopya)
  })
})

/**
 * ⚠️ SIRA SÖZLEŞMESİ: önce yıl, sonra kademe.
 *
 * Ters sırada `filterByTier` kademe genişletmesini TÜM seçki üzerinde yapar ve
 * "yeterli" dediği için hiç devreye girmez; sonradan yıla süzülünce ince
 * hücreler boş ekrana düşer. Doğru sırada genişletme yıl diliminin İÇİNDE
 * çalışır ve 5 şarkılık bir hücre bile oynanabilir kalır.
 *
 * Bu test o sözleşmeyi kilitliyor — `api/havuz` ve `useKapakTur` ikisi de
 * buna dayanıyor.
 */
describe('yıl + kademe sırası', () => {
  // Sanat Müziği + "Bu yıl" ölçümünün şekli: yılda az, toplamda bol.
  const gercekci = [
    ...Array.from({ length: 200 }, (_, i) => ({
      id: `eski${i}`,
      d: ((i % 5) + 1) as Difficulty,
      y: 1990 + (i % 30),
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `yeni${i}`,
      d: ((i % 5) + 1) as Difficulty,
      y: 2026,
    })),
  ]

  it('doğru sırada ince hücre BOŞ KALMAZ ve yıl dilimini aşmaz', () => {
    for (let t = 1; t <= 5; t++) {
      const sonuc = filterByTier(filterByYear(gercekci, 'yeni'), t as Difficulty)
      expect(sonuc.length).toBe(5)
      expect(sonuc.every((s) => s.y === 2026)).toBe(true)
    }
  })

  it('ters sırada aynı hücre neredeyse boşalır — bu yüzden sıra sabit', () => {
    const ters = filterByYear(filterByTier(gercekci, 1), 'yeni')
    expect(ters.length).toBeLessThan(5)
  })

  it('geniş eşikte kademe genişletmesi yıl dilimini AŞMAZ', () => {
    const sonuc = filterByTier(filterByYear(gercekci, '2000'), 3)
    expect(sonuc.every((s) => s.y >= 2000)).toBe(true)
  })
})
