import { describe, it, expect } from 'vitest'
import { sanatciSlug, slugGecerli } from '../sanatci'
import { cleanKey } from '../keys'

describe('sanatciSlug', () => {
  it('normalize addan kısa ad üretir', () => {
    expect(sanatciSlug('sezen aksu')).toBe('sezen-aksu')
  })

  it('Türkçe karakterli adlar aynı kısa ada düşer', () => {
    // Kaynak normalize ad; görüntü adının iki yazımı aynı sonuca varmalı.
    expect(sanatciSlug(cleanKey('MFÖ'))).toBe(sanatciSlug(cleanKey('Mfö')))
    expect(sanatciSlug(cleanKey('İbrahim Tatlıses'))).toBe('ibrahim-tatlises')
  })

  it('baştaki, sondaki ve tekrarlanan ayırıcıları temizler', () => {
    expect(sanatciSlug('  ceza  ')).toBe('ceza')
    expect(sanatciSlug('athena  x  gokhan')).toBe('athena-x-gokhan')
  })

  it('Latin dışı ad boş kısa ada düşer — sanatçı moduna alınmaz', () => {
    expect(sanatciSlug('кино')).toBe('')
  })
})

describe('slugGecerli', () => {
  it('düzgün kısa adı kabul eder', () => {
    expect(slugGecerli('sezen-aksu')).toBe(true)
    expect(slugGecerli('mfo')).toBe(true)
  })

  it('bozuk ya da tehlikeli girdiyi reddeder', () => {
    for (const k of ['', '-ceza', 'ceza-', 'a--b', 'Sezen', '../x', 'a b', 'x'.repeat(81)]) {
      expect(slugGecerli(k)).toBe(false)
    }
  })
})
