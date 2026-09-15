import { describe, it, expect } from 'vitest'
import { KAPAK_ADIM, kolayAnahtarlar, type Kapak } from '@/data/kapak'
import {
  kapakKalanHak, kapakReducer, kapakTurBitti, kapakTurIcinde, type KapakDurum,
} from '../kapakMachine'

/**
 * Kapak oyununun kuralı ünlüyle aynı: beşinci adım açılınca tur biter.
 * Kilitlenen iki şey: bitiş koşulu ve `s` alanının spread sırası.
 */

const kapak: Kapak = {
  id: 'kapak:1',
  sid: 'itunes:1',
  al: 'Gülümse',
  a: 'Sezen Aksu',
  y: 1991,
  d: 1,
  c: 'pop',
  nT: 'gulumse',
  nA: 'sezen aksu',
  k: ['gulumse'],
  ks: ['sezen aksu'],
}

const hazir = (): KapakDurum =>
  kapakReducer(kapakReducer({ s: 'booting' }, { type: 'ARM', kapak }), { type: 'ARM_OK' })

const yanlis = (d: KapakDurum, t = 'x') => kapakReducer(d, { type: 'WRONG', text: t, sameArtist: false })

describe('kapak turu', () => {
  it('8×8 adımıyla, adımsız başlar', () => {
    const d = hazir()
    expect(d.s).toBe('ready')
    if (kapakTurIcinde(d)) {
      expect(d.adim).toBe(1)
      expect(d.steps).toEqual([])
    }
  })

  it(`dört yanlıştan sonra ${KAPAK_ADIM}. adımda kaybedilir`, () => {
    let d = hazir()
    for (let i = 0; i < KAPAK_ADIM - 2; i++) {
      d = yanlis(d)
      expect(d.s).toBe('ready')
    }
    d = yanlis(d)
    expect(d.s).toBe('lost')
    expect(kapakTurBitti(d)).toBe(true)
  })

  it('pas da bir adım açar', () => {
    const d = kapakReducer(hazir(), { type: 'SKIP' })
    if (kapakTurIcinde(d)) {
      expect(d.adim).toBe(2)
      expect(d.steps[0]?.kind).toBe('skip')
    }
  })

  it('yanlış tahmin "sanatçı doğru" işaretini taşır', () => {
    const d = kapakReducer(hazir(), { type: 'WRONG', text: 'sezen aksu', sameArtist: true })
    if (kapakTurIcinde(d)) expect(d.steps[0]?.sameArtist).toBe(true)
  })

  it('doğru tahmin kazandırır, sonrası durumu değiştirmez', () => {
    const won = kapakReducer(hazir(), { type: 'CORRECT' })
    expect(won.s).toBe('won')
    expect(yanlis(won)).toBe(won)
  })

  it('kalan hak adımla azalır', () => {
    expect(kapakKalanHak(1)).toBe(4)
    expect(kapakKalanHak(4)).toBe(1)
    expect(kapakKalanHak(KAPAK_ADIM)).toBe(0)
  })
})

describe('kolay mod', () => {
  it('açıkken sanatçı anahtarını ekler, kaydı DEĞİŞTİRMEZ', () => {
    const kolay = kolayAnahtarlar(kapak, true)
    expect(kolay.k).toEqual(['gulumse', 'sezen aksu'])
    expect(kapak.k).toEqual(['gulumse'])
  })

  it('kapalıyken yalnızca albüm adı', () => {
    expect(kolayAnahtarlar(kapak, false).k).toEqual(['gulumse'])
  })
})
