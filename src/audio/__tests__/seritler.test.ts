import { describe, it, expect } from 'vitest'
import { seritSec, yenidenYuklenmeli, type SeritDurumu } from '../seritler'

const saglikli = {
  kaynak: 'https://cdn/a.m4a',
  url: 'https://cdn/a.m4a',
  hataVar: false,
  readyState: 4,
  bufferliAralik: 1,
  crossOrigin: 'anonymous',
}

describe('yenidenYuklenmeli', () => {
  it('aynı URL hazır ve arabellekliyse yeniden yüklemez', () => {
    expect(yenidenYuklenmeli(saglikli)).toBe(false)
  })

  it('farklı URL, hata, boş readyState, boş arabellek ve yanlış crossOrigin yükletir', () => {
    expect(yenidenYuklenmeli({ ...saglikli, url: 'https://cdn/b.m4a' })).toBe(true)
    expect(yenidenYuklenmeli({ ...saglikli, kaynak: null })).toBe(true)
    expect(yenidenYuklenmeli({ ...saglikli, hataVar: true })).toBe(true)
    expect(yenidenYuklenmeli({ ...saglikli, readyState: 0 })).toBe(true)
    expect(yenidenYuklenmeli({ ...saglikli, bufferliAralik: 0 })).toBe(true)
    // TUZAK 3: CORS'suz istek sessizlik üretir.
    expect(yenidenYuklenmeli({ ...saglikli, crossOrigin: null })).toBe(true)
  })
})

describe('seritSec', () => {
  const serit = (kaynak: string | null, ek: Partial<SeritDurumu> = {}): SeritDurumu => ({
    kaynak,
    hataVar: false,
    duraklamis: true,
    ...ek,
  })

  it('URL zaten bir şeritteyse o şerit seçilir (önyükleme korunur)', () => {
    expect(seritSec(0, [serit('a'), serit('b')], 'b')).toBe(1)
    expect(seritSec(1, [serit('b'), serit('a')], 'b')).toBe(0)
  })

  it('URL hiçbir şeritte yoksa boştaki şerit seçilir', () => {
    expect(seritSec(0, [serit('a'), serit('b')], 'c')).toBe(1)
    expect(seritSec(1, [serit('a'), serit('b')], 'c')).toBe(0)
  })

  it('çalan ya da hatalı şerit seçilmez', () => {
    expect(seritSec(0, [serit('a'), serit('b', { duraklamis: false })], 'b')).toBe(1)
    expect(seritSec(1, [serit('b', { hataVar: true }), serit('a')], 'b')).toBe(0)
  })

  it('aynı URL için art arda çağrı şeridi oynatmaz (çift tıklama)', () => {
    const seritler = [serit('a'), serit('b')]
    const ilk = seritSec(0, seritler, 'b')
    expect(seritSec(ilk, seritler, 'b')).toBe(ilk)
  })
})
