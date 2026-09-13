import { describe, it, expect } from 'vitest'
import { SERIT, type Unlu } from '@/data/unlu'
import { kalanHak, turBitti, turIcinde, unluReducer, type UnluDurum } from '../unluMachine'

/**
 * Ünlü oyununun kuralı tek cümle: beşinci şerit açılınca tur biter.
 * Sessizce bozulabilecek iki şey var — bitiş koşulu ve `s` alanının spread
 * sırası — ikisi de burada kilitleniyor.
 */

const kisi: Unlu = {
  id: 'unlu:test',
  ad: 'Test Kişi',
  d: 3,
  c: 'sarkici',
  v: 1,
  nT: 'test kisi',
  nA: '',
  k: ['test kisi'],
}

const hazir = (): UnluDurum =>
  unluReducer(unluReducer({ s: 'booting' }, { type: 'ARM', kisi }), { type: 'ARM_OK' })

const yanlis = (d: UnluDurum, t = 'x') => unluReducer(d, { type: 'WRONG', text: t })
const pas = (d: UnluDurum) => unluReducer(d, { type: 'SKIP' })

describe('kurulum', () => {
  it('ARM_OK ilk şerit açık, adımsız başlatır', () => {
    const d = hazir()
    expect(d.s).toBe('ready')
    if (turIcinde(d)) {
      expect(d.acilan).toBe(1)
      expect(d.steps).toEqual([])
      expect(d.kisi.id).toBe('unlu:test')
    }
  })

  it('ARM_OK yalnızca arming durumunda iş görür', () => {
    const d: UnluDurum = { s: 'booting' }
    expect(unluReducer(d, { type: 'ARM_OK' })).toBe(d)
  })

  it('RESET her durumdan booting\'e döner', () => {
    expect(unluReducer(hazir(), { type: 'RESET' })).toEqual({ s: 'booting' })
  })
})

describe('şerit açılması', () => {
  it('yanlış tahmin bir şerit açar', () => {
    const d = yanlis(hazir())
    expect(d.s).toBe('ready')
    if (turIcinde(d)) expect(d.acilan).toBe(2)
  })

  it('pas da bir şerit açar', () => {
    const d = pas(hazir())
    if (turIcinde(d)) expect(d.acilan).toBe(2)
  })

  /**
   * ⚠️ Oyunun TEK bitiş kuralı. Şarkı oyunundaki "3 yanlış" sınırı burada
   * uygulanmıyor; üçüncü yanlıştan sonra tur hâlâ sürüyor olmalı.
   */
  it('DÖRDÜNCÜ adımda (5. şerit) tur kaybedilir', () => {
    let d = hazir()
    for (const beklenen of [2, 3, 4]) {
      d = yanlis(d)
      expect(d.s).toBe('ready')
      if (turIcinde(d)) expect(d.acilan).toBe(beklenen)
    }
    d = yanlis(d)
    expect(d.s).toBe('lost')
    if (turBitti(d)) expect(d.acilan).toBe(SERIT)
  })

  it('üç yanlıştan sonra tur SÜRER (MAX_WRONG uygulanmaz)', () => {
    let d = hazir()
    d = yanlis(d, 'a')
    d = yanlis(d, 'b')
    d = yanlis(d, 'c')
    expect(d.s).toBe('ready')
  })

  it('yanlış ve pas karışık da dördüncüde biter', () => {
    let d = hazir()
    d = pas(d)
    d = yanlis(d)
    d = pas(d)
    expect(d.s).toBe('ready')
    d = yanlis(d)
    expect(d.s).toBe('lost')
  })

  /**
   * ⚠️ `s` alanı spread'den SONRA yazılmazsa tur ASLA bitmez —
   * `machine.ts:105-112`'deki tuzağın aynısı. Bu test tam onu tutuyor.
   */
  it('kaybedilen durumda s gerçekten lost', () => {
    let d = hazir()
    for (let i = 0; i < 4; i++) d = yanlis(d)
    expect(d.s).toBe('lost')
    expect(turIcinde(d)).toBe(false)
  })
})

describe('kazanma', () => {
  it('ilk bakışta bilmek kazandırır', () => {
    const d = unluReducer(hazir(), { type: 'CORRECT' })
    expect(d.s).toBe('won')
    if (turBitti(d)) expect(d.acilan).toBe(1)
  })

  it('son hakta da kazanılabilir', () => {
    let d = hazir()
    for (let i = 0; i < 3; i++) d = yanlis(d)
    if (turIcinde(d)) expect(d.acilan).toBe(4)
    d = unluReducer(d, { type: 'CORRECT' })
    expect(d.s).toBe('won')
  })

  it('bitmiş turda eylemler yutulur', () => {
    const kazandi = unluReducer(hazir(), { type: 'CORRECT' })
    expect(unluReducer(kazandi, { type: 'WRONG', text: 'x' })).toBe(kazandi)
    expect(unluReducer(kazandi, { type: 'SKIP' })).toBe(kazandi)
    expect(unluReducer(kazandi, { type: 'CORRECT' })).toBe(kazandi)
  })
})

describe('adımlar ve haklar', () => {
  it('adımlar ham metni korur', () => {
    let d = yanlis(hazir(), 'Tarkan')
    d = pas(d)
    if (turIcinde(d)) {
      expect(d.steps).toHaveLength(2)
      expect(d.steps[0]).toEqual({ kind: 'wrong', text: 'Tarkan', sameArtist: false })
      expect(d.steps[1]!.kind).toBe('skip')
    }
  })

  it('sameArtist HER ZAMAN false — ünlüde ikinci ad yok', () => {
    let d = hazir()
    for (let i = 0; i < 3; i++) d = yanlis(d, `deneme ${i}`)
    if (turIcinde(d)) expect(d.steps.every((s) => s.sameArtist === false)).toBe(true)
  })

  it('kalanHak açık şeritten türer', () => {
    expect(kalanHak(1)).toBe(4)
    expect(kalanHak(4)).toBe(1)
    expect(kalanHak(5)).toBe(0)
    expect(kalanHak(9)).toBe(0)
  })
})

describe('hata yolları', () => {
  it('ARM_FAIL sebebi taşır', () => {
    expect(unluReducer(hazir(), { type: 'ARM_FAIL', reason: 'image' })).toEqual({
      s: 'error',
      reason: 'image',
    })
  })

  it('EMPTY_POOL boş duruma geçer', () => {
    expect(unluReducer({ s: 'booting' }, { type: 'EMPTY_POOL' })).toEqual({ s: 'empty' })
  })

  it('booting durumunda tahmin yutulur', () => {
    const d: UnluDurum = { s: 'booting' }
    expect(unluReducer(d, { type: 'WRONG', text: 'x' })).toBe(d)
  })
})
