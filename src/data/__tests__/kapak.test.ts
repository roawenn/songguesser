import { describe, it, expect } from 'vitest'
import { judgeGuess } from '@/text/match'
import { albumAnahtarlari } from '@/text/album'
import { cleanKey } from '@/text/keys'
import { kolayAnahtarlar, kapakSamanligi, type Kapak } from '../kapak'

const kapak = (id: string, al: string, a: string): Kapak => ({
  id,
  sid: `itunes:${id}`,
  al,
  a,
  y: 2000,
  d: 1,
  c: 'pop',
  nT: cleanKey(al),
  nA: cleanKey(a),
  k: albumAnahtarlari(al),
  ks: [cleanKey(a)],
})

const cevap = kapak('1', 'Gülümse', 'Sezen Aksu')
const havuz = [cevap, kapak('2', 'Hadi Bakalım', 'Sezen Aksu'), kapak('3', 'Şımarık', 'Tarkan')]

/** Hook'taki sıra: cevap ve evren AYNI dönüşümden geçer (bkz. `useKapakTur`). */
function yargila(raw: string, kolay: boolean) {
  const evren = havuz.map((k) => kolayAnahtarlar(k, kolay))
  return judgeGuess(raw, kolayAnahtarlar(cevap, kolay), evren, { easySearch: true })
}

describe('Kapaktan Albüm kabul kuralı', () => {
  it('kolay mod AÇIK: albüm adı kabul', () => {
    expect(yargila('Gülümse', true).kind).toBe('correct')
  })

  it('kolay mod AÇIK: sanatçı adı da kabul', () => {
    expect(yargila('Sezen Aksu', true).kind).toBe('correct')
  })

  it('kolay mod KAPALI: albüm adı kabul', () => {
    expect(yargila('gulumse', false).kind).toBe('correct')
  })

  it('kolay mod KAPALI: sanatçı adı KABUL DEĞİL', () => {
    expect(yargila('Sezen Aksu', false).kind).not.toBe('correct')
  })

  it('kolay mod açıkken başka sanatçı yanlış', () => {
    expect(yargila('Tarkan', true).kind).toBe('wrong')
  })

  it('kolayAnahtarlar kaydı yerinde değiştirmez', () => {
    const once = [...cevap.k]
    kolayAnahtarlar(cevap, true)
    expect(cevap.k).toEqual(once)
  })

  it('samanlık kolay modda sanatçıyı içerir, kapalıda içermez', () => {
    expect(kapakSamanligi(true)(cevap)).toContain('sezen')
    expect(kapakSamanligi(false)(cevap)).not.toContain('sezen')
  })
})
