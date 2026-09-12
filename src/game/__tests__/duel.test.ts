import { describe, it, expect } from 'vitest'
import {
  kodUret, kodGecerli, KOD_UZUNLUK, skorla, kazanan, ilerleyebilir,
  BEKLEME_SINIRI_MS, DUELLO_SARKI, type DuelloCevap,
} from '../duel'

/** Testte belirlenimci bayt kaynağı — gerçekte crypto kullanılıyor. */
const sahteBayt = (deger: number) => (n: number) => new Uint8Array(n).fill(deger)

function cevap(over: Partial<DuelloCevap> = {}): DuelloCevap {
  return { slot: 1, songIndex: 0, won: true, heardSeconds: 0.5, listens: 1, ...over }
}

describe('lobi kodu', () => {
  it('doğru uzunlukta ve geçerli', () => {
    const kod = kodUret(sahteBayt(7))
    expect(kod).toHaveLength(KOD_UZUNLUK)
    expect(kodGecerli(kod)).toBe(true)
  })

  it('⚠️ karışan harfleri İÇERMEZ', () => {
    // 0/O, 1/I/l ve U elle yazılırken karışıyor; kod telefonda okunabiliyor.
    for (let i = 0; i < 256; i++) {
      const kod = kodUret(sahteBayt(i))
      expect(kod).not.toMatch(/[01OILU]/)
    }
  })

  it('farklı bayt farklı kod verir', () => {
    expect(kodUret(sahteBayt(1))).not.toBe(kodUret(sahteBayt(2)))
  })

  it('bozuk kodu reddeder', () => {
    for (const bad of ['', 'ABC', 'ABCDEFG', 'ABCDE0', 'abcdef', 'ABCDE!', 'ABCDEO']) {
      expect(kodGecerli(bad)).toBe(false)
    }
  })
})

describe('skorlama', () => {
  it('doğruları ve süreyi toplar', () => {
    const c = [
      cevap({ songIndex: 0, won: true, heardSeconds: 0.5, listens: 1 }),
      cevap({ songIndex: 1, won: true, heardSeconds: 2, listens: 3 }),
      cevap({ songIndex: 2, won: false, heardSeconds: 10, listens: 5 }),
    ]
    const s = skorla(c, 1)
    expect(s.dogru).toBe(2)
    // ⚠️ Süre YALNIZCA doğru bilinenlerden toplanır; bilemediği şarkıda uzun
    // dinlemek onu cezalandırmamalı, zaten kaybetti.
    expect(s.sure).toBe(2.5)
    expect(s.listens).toBe(9)
    expect(s.eksik).toBe(DUELLO_SARKI - 3)
  })

  it('rakibin cevapları karışmaz', () => {
    const c = [cevap({ slot: 1 }), cevap({ slot: 2, songIndex: 0 })]
    expect(skorla(c, 1).dogru).toBe(1)
    expect(skorla(c, 2).dogru).toBe(1)
  })

  it('hiç cevap yoksa her şey eksik', () => {
    expect(skorla([], 1)).toEqual({ dogru: 0, sure: 0, listens: 0, eksik: DUELLO_SARKI })
  })
})

describe('kazanan', () => {
  const s = (dogru: number, sure: number, listens = 0) => ({ dogru, sure, listens, eksik: 0 })

  it('daha çok bilen kazanır', () => {
    expect(kazanan(s(4, 20), s(3, 2))).toBe('sen')
    expect(kazanan(s(3, 2), s(4, 20))).toBe('rakip')
  })

  it('eşitlikte daha kısa sürede bilen kazanır', () => {
    expect(kazanan(s(3, 4.5), s(3, 9))).toBe('sen')
  })

  it('süre de eşitse daha az dinleyen kazanır', () => {
    expect(kazanan(s(3, 4.5, 5), s(3, 4.5, 9))).toBe('sen')
  })

  it('her şey eşitse berabere', () => {
    expect(kazanan(s(3, 4.5, 5), s(3, 4.5, 5))).toBe('berabere')
  })

  it('⚠️ oyunu bırakan üstün çıkmaz', () => {
    // Bırakan kişinin cevapsız şarkıları doğru sayılmaz.
    const bırakan = skorla([cevap({ songIndex: 0, won: true, heardSeconds: 0.5 })], 1)
    const bitiren = skorla(
      Array.from({ length: 5 }, (_, i) =>
        cevap({ slot: 2, songIndex: i, won: i < 2, heardSeconds: 5 }),
      ),
      2,
    )
    expect(bırakan.dogru).toBe(1)
    expect(bitiren.dogru).toBe(2)
    expect(kazanan(bırakan, bitiren)).toBe('rakip')
  })
})

describe('ilerleme', () => {
  const benim = cevap({ slot: 1, songIndex: 0 })
  const rakibin = cevap({ slot: 2, songIndex: 0 })

  it('ben cevaplamadıysam ilerlemez', () => {
    expect(ilerleyebilir([rakibin], 0, 1, 0)).toBe(false)
  })

  it('ikimiz de cevapladıysak hemen ilerler', () => {
    expect(ilerleyebilir([benim, rakibin], 0, 1, 0)).toBe(true)
  })

  it('rakip yoksa süre dolana kadar bekler', () => {
    expect(ilerleyebilir([benim], 0, 1, 0)).toBe(false)
    expect(ilerleyebilir([benim], 0, 1, BEKLEME_SINIRI_MS - 1)).toBe(false)
  })

  it('⚠️ süre dolunca tek taraflı ilerler', () => {
    // Yoksa oyunu bırakan kişi diğerini sonsuza kadar ekranda tutar.
    expect(ilerleyebilir([benim], 0, 1, BEKLEME_SINIRI_MS)).toBe(true)
  })

  it('başka şarkının cevabı sayılmaz', () => {
    const baska = cevap({ slot: 2, songIndex: 1 })
    expect(ilerleyebilir([benim, baska], 0, 1, 0)).toBe(false)
  })
})
