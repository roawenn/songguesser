import { describe, expect, it } from 'vitest'
import { BOS, birlestir, isabet, KADEME, sanitize, uygula, type Istatistik } from '../stats'
import type { Difficulty } from '@/data/categories'

const tur = (o: Partial<Parameters<typeof uygula>[1]> = {}) => ({
  won: true,
  tier: 1 as const,
  heardSeconds: 2,
  listens: 1,
  ...o,
})

describe('uygula', () => {
  it('kazanılan turu sayar ve kademeye yazar', () => {
    const s = uygula(BOS, tur({ tier: 3 }))
    expect(s.oynanan).toBe(1)
    expect(s.kazanilan).toBe(1)
    expect(s.kademeDagilimi[2]).toBe(1)
    expect(s.kademeDagilimi.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('kaybedilen tur kademe dağılımına yazılmaz', () => {
    const s = uygula(BOS, tur({ won: false, tier: 4 }))
    expect(s.oynanan).toBe(1)
    expect(s.kazanilan).toBe(0)
    expect(s.kademeDagilimi.every((n) => n === 0)).toBe(true)
  })

  it('girdiyi değiştirmez', () => {
    const once = uygula(BOS, tur({ tier: 2 }))
    const kopya = JSON.parse(JSON.stringify(once)) as Istatistik
    uygula(once, tur({ tier: 5 }))
    expect(once).toEqual(kopya)
  })

  it('en iyi saniye yalnızca kazanılan turdan gelir', () => {
    let s = uygula(BOS, tur({ heardSeconds: 5 }))
    expect(s.enIyiSaniye).toBe(5)
    // Kaybedilen turda 10 saniye duyuldu — rekoru bozmamalı.
    s = uygula(s, tur({ won: false, heardSeconds: 10 }))
    expect(s.enIyiSaniye).toBe(5)
    s = uygula(s, tur({ heardSeconds: 0.5 }))
    expect(s.enIyiSaniye).toBe(0.5)
    // Daha kötü bir kazanç rekoru bozmaz.
    s = uygula(s, tur({ heardSeconds: 2 }))
    expect(s.enIyiSaniye).toBe(0.5)
  })

  it('hiç dinlemeden bilmek 0 saniye rekorudur', () => {
    const s = uygula(uygula(BOS, tur({ heardSeconds: 1 })), tur({ heardSeconds: 0 }))
    expect(s.enIyiSaniye).toBe(0)
  })

  it('seri kaybedince sıfırlanır, en iyi seri kalır', () => {
    let s = BOS
    for (let i = 0; i < 3; i++) s = uygula(s, tur())
    expect(s.seri).toBe(3)
    expect(s.enIyiSeri).toBe(3)
    s = uygula(s, tur({ won: false }))
    expect(s.seri).toBe(0)
    expect(s.enIyiSeri).toBe(3)
    s = uygula(s, tur())
    expect(s.seri).toBe(1)
    expect(s.enIyiSeri).toBe(3)
  })

  it('dinleme sayısı birikir', () => {
    const s = uygula(uygula(BOS, tur({ listens: 4 })), tur({ listens: 3 }))
    expect(s.toplamDinleme).toBe(7)
  })
})

describe('isabet', () => {
  it('hiç oynanmadıysa 0', () => {
    expect(isabet(BOS)).toBe(0)
  })

  it('yüzdeyi yuvarlar', () => {
    let s = BOS
    for (let i = 0; i < 3; i++) s = uygula(s, tur())
    s = uygula(s, tur({ won: false }))
    expect(isabet(s)).toBe(75)
  })
})

describe('sanitize', () => {
  it('boş / bozuk girdide sıfır istatistik döner', () => {
    for (const v of [null, undefined, 42, 'abc', [], {}]) {
      expect(sanitize(v)).toEqual(BOS)
    }
  })

  it('gidiş-dönüş: gerçek bir kayıt aynen geri gelir', () => {
    let s = BOS
    s = uygula(s, tur({ tier: 2, heardSeconds: 1, listens: 2 }))
    s = uygula(s, tur({ won: false, tier: 2, heardSeconds: 10, listens: 5 }))
    expect(sanitize(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('kazanılan, oynanandan büyük olamaz', () => {
    const s = sanitize({ oynanan: 3, kazanilan: 99 })
    expect(s.kazanilan).toBe(3)
    expect(isabet(s)).toBe(100)
  })

  it('kademe dağılımı toplamı kazanılanı aşarsa dağılım sıfırlanır', () => {
    const s = sanitize({ oynanan: 5, kazanilan: 2, kademeDagilimi: [9, 9, 9, 9, 9] })
    expect(s.kademeDagilimi).toEqual([0, 0, 0, 0, 0])
    // Diğer alanlar hayatta kalır.
    expect(s.oynanan).toBe(5)
  })

  it('dağılım dizisi her zaman beş uzunluğunda', () => {
    expect(sanitize({ oynanan: 9, kazanilan: 9, kademeDagilimi: [1] }).kademeDagilimi).toHaveLength(KADEME)
    expect(
      sanitize({ oynanan: 9, kazanilan: 9, kademeDagilimi: [1, 1, 1, 1, 1, 1, 1] }).kademeDagilimi,
    ).toHaveLength(KADEME)
  })

  it('hiç kazanılmamışsa en iyi saniye null', () => {
    expect(sanitize({ oynanan: 4, kazanilan: 0, enIyiSaniye: 0.5 }).enIyiSaniye).toBeNull()
  })

  it('merdiven basamağı olmayan en iyi saniye elenir', () => {
    for (const kotu of [999, -3, 7, 0.7, 3, NaN]) {
      expect(sanitize({ oynanan: 1, kazanilan: 1, enIyiSaniye: kotu }).enIyiSaniye).toBeNull()
    }
    for (const iyi of [0, 0.5, 1, 2, 5, 10]) {
      expect(sanitize({ oynanan: 1, kazanilan: 1, enIyiSaniye: iyi }).enIyiSaniye).toBe(iyi)
    }
  })

  it('seri kazanılanı aşamaz ve en iyi seri seriden küçük kalamaz', () => {
    const s = sanitize({ oynanan: 10, kazanilan: 4, seri: 100, enIyiSeri: 1 })
    expect(s.seri).toBe(4)
    expect(s.enIyiSeri).toBe(4)
  })

  it('negatif ve ondalıklı sayaçlar toparlanır', () => {
    const s = sanitize({ oynanan: -5, toplamDinleme: 3.7 })
    expect(s.oynanan).toBe(0)
    expect(s.toplamDinleme).toBe(3)
  })

  it('geçersiz tarih null olur', () => {
    expect(sanitize({ sonOynama: 'dün' }).sonOynama).toBeNull()
    expect(sanitize({ sonOynama: '2026-09-13T00:00:00.000Z' }).sonOynama).toBe(
      '2026-09-13T00:00:00.000Z',
    )
  })
})

describe('birlestir', () => {
  const tur = (won: boolean, tier: Difficulty, heardSeconds: number) =>
    ({ won, tier, heardSeconds, listens: 1 }) as const

  it('sayaçları toplar, rekorları en iyiden alır', () => {
    const a = uygula(uygula(BOS, tur(true, 1, 0.5), new Date('2026-01-01')), tur(false, 2, 10), new Date('2026-01-02'))
    const b = uygula(BOS, tur(true, 3, 2), new Date('2026-03-01'))

    const c = birlestir(a, b)
    expect(c.oynanan).toBe(3)
    expect(c.kazanilan).toBe(2)
    expect(c.kademeDagilimi).toEqual([1, 0, 1, 0, 0])
    expect(c.toplamDinleme).toBe(3)
    // En iyi saniye KÜÇÜK olan, en iyi seri BÜYÜK olan.
    expect(c.enIyiSaniye).toBe(0.5)
    expect(c.enIyiSeri).toBe(1)
    // Süren seri ve son oynama, en son oynanan taraftan.
    expect(c.seri).toBe(1)
    expect(c.sonOynama).toBe(b.sonOynama)
  })

  it('boşla birleşmek kimliği bozmaz', () => {
    const a = uygula(BOS, tur(true, 2, 1), new Date('2026-02-02'))
    expect(birlestir(a, BOS)).toEqual(a)
    expect(birlestir(BOS, a)).toEqual(a)
  })

  it('sonuç sanitize süzgecinden geçer (tutarlı kalır)', () => {
    const a = uygula(BOS, tur(true, 1, 0), new Date('2026-01-01'))
    const b = uygula(BOS, tur(false, 1, 10), new Date('2026-01-02'))
    const c = birlestir(a, b)
    expect(sanitize(c)).toEqual(c)
  })
})
