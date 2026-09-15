import { describe, it, expect } from 'vitest'
import { grupla, type KapakSatiri } from '../kapakHavuz'

const satir = (over: Partial<KapakSatiri>): KapakSatiri => ({
  id: 'itunes:1',
  artist: 'Sezen Aksu',
  album: 'Gülümse',
  store_url: 'https://music.apple.com/tr/album/gulumse/111?i=1',
  year: 1991,
  tier: 3,
  category: 'pop',
  norm_artist: 'sezen aksu',
  ...over,
})

describe('grupla', () => {
  it('aynı albümün şarkılarını TEK kayda indirir', () => {
    const out = grupla([
      satir({ id: 'itunes:1', tier: 3, year: 1992 }),
      satir({ id: 'itunes:2', tier: 1, year: 1991, store_url: 'https://music.apple.com/tr/album/gulumse/111?i=2' }),
    ])
    expect(out).toHaveLength(1)
    // En tanınan şarkının kademesi, en erken yıl.
    expect(out[0]!.d).toBe(1)
    expect(out[0]!.y).toBe(1991)
    expect(out[0]!.id).toBe('kapak:111')
  })

  it('aynı ADLI farklı albümleri birleştirmez — ölçüt albüm kimliği', () => {
    const out = grupla([
      satir({ id: 'itunes:1', artist: 'A', store_url: 'https://music.apple.com/tr/album/ask/111?i=1', album: 'Aşk' }),
      satir({ id: 'itunes:2', artist: 'B', store_url: 'https://music.apple.com/tr/album/ask/222?i=2', album: 'Aşk' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('adı temizler ve anahtar üretir', () => {
    const [k] = grupla([satir({ album: 'Gülümse - Single' })])
    expect(k!.al).toBe('Gülümse')
    expect(k!.k).toContain('gulumse')
    expect(k!.ks).toEqual(['sezen aksu'])
  })

  it('albümü boş, kimliği okunamayan ya da derleme olan kaydı atlar', () => {
    const out = grupla([
      satir({ id: 'itunes:1', album: null }),
      satir({ id: 'itunes:2', store_url: 'https://music.apple.com/tr/song/x/5' }),
      satir({ id: 'itunes:3', album: 'Greatest Hits', store_url: 'https://music.apple.com/tr/album/gh/333?i=3' }),
    ])
    expect(out).toEqual([])
  })
})
