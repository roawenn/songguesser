import { describe, it, expect } from 'vitest'
import {
  encodeShare, decodeShare, marksOf, emojiLine, verdictLine, accentHex, oklchToHex,
  type ShareResult,
} from '../share'
import type { Step } from '../machine'

const base: ShareResult = {
  chip: 'pop',
  marks: ['yanlis', 'pas', 'dogru', 'bos', 'bos'],
  won: true,
  heardSeconds: 2,
  listens: 3,
}

describe('paylaşım kodu', () => {
  it('gidiş dönüş bozulmaz', () => {
    expect(decodeShare(encodeShare(base))).toEqual(base)
  })

  it('yarım saniye ondalığı korunur', () => {
    const r = { ...base, heardSeconds: 0.5 }
    expect(decodeShare(encodeShare(r))?.heardSeconds).toBe(0.5)
  })

  it('tire içeren seçki kimliği bozulmaz', () => {
    // ⚠️ `iki-binler` yüzünden ayırıcı `_`; tire kullanılsa kod parçalanırdı.
    const r = { ...base, chip: 'iki-binler' as const }
    expect(decodeShare(encodeShare(r))?.chip).toBe('iki-binler')
  })

  it('kayıp tur kodlanabilir', () => {
    const r: ShareResult = {
      chip: 'rap', marks: ['yanlis', 'yanlis', 'pas', 'yanlis', 'yanlis'],
      won: false, heardSeconds: 10, listens: 7,
    }
    const back = decodeShare(encodeShare(r))
    expect(back?.won).toBe(false)
    expect(back).toEqual(r)
  })

  it('bozuk kod null döner, patlamaz', () => {
    for (const bad of [
      '',
      'pop',
      'pop_zzzzz_20_3',
      'yok_ddddd_20_3',
      'pop_dd_20_3',
      'pop_ddddd_x_3',
      // 5. parça yalnızca rakam olabilir.
      'pop_ddddd_20_3_abc',
      'pop_ddddd_20_3_12_9',
    ]) {
      expect(decodeShare(bad)).toBeNull()
    }
  })

  /**
   * ⚠️ Şarkı kimliği 5. parça ve İSTEĞE BAĞLI. Story görseli "hangi şarkıydı"
   * kartını bundan üretiyor; eski 4 parçalı bağlantılar çözülmeye devam etmeli,
   * yoksa daha önce paylaşılmış her görsel kırılır.
   */
  describe('şarkı kimliği', () => {
    it('gidiş-dönüş', () => {
      const r = { ...base, songId: 'itunes:1834674002' }
      const kod = encodeShare(r)
      expect(kod.split('_')).toHaveLength(5)
      expect(decodeShare(kod)?.songId).toBe('itunes:1834674002')
    })

    it('kimliksiz kod 4 parça kalır', () => {
      expect(encodeShare(base).split('_')).toHaveLength(4)
      expect(decodeShare(encodeShare(base))?.songId).toBeUndefined()
    })

    it('eski 4 parçalı kod hâlâ çözülür', () => {
      const eski = decodeShare('pop_dbbbb_10_3')
      expect(eski).not.toBeNull()
      expect(eski?.songId).toBeUndefined()
      expect(eski?.heardSeconds).toBe(1)
    })

    it('itunes olmayan kimlik koda girmez', () => {
      expect(encodeShare({ ...base, songId: 'baska:5' }).split('_')).toHaveLength(4)
    })
  })
})

describe('kutular', () => {
  const wrong = (t: string): Step => ({ kind: 'wrong', text: t, sameArtist: false })
  const skip = (): Step => ({ kind: 'skip', text: '', sameArtist: false })

  it('kazanan tur: tüketilen kutular + doğru', () => {
    expect(marksOf([wrong('x'), skip()], true)).toEqual(['yanlis', 'pas', 'dogru', 'bos', 'bos'])
  })

  it('hiç hak harcamadan bilmek ilk kutuyu yeşil yapar', () => {
    expect(marksOf([], true)[0]).toBe('dogru')
  })

  it('kaybeden turda yeşil kutu yok', () => {
    const steps = [wrong('a'), wrong('b'), skip(), wrong('c'), wrong('d')]
    expect(marksOf(steps, false)).toEqual(['yanlis', 'yanlis', 'pas', 'yanlis', 'yanlis'])
  })

  it('ipucu kademesi PAS gibi görünür, yanlış gibi değil', () => {
    const hint = (): Step => ({ kind: 'hint', text: '', sameArtist: false })
    expect(marksOf([hint(), wrong('x')], true)).toEqual(['pas', 'yanlis', 'dogru', 'bos', 'bos'])
  })

  it('emoji şeridi beş karakter', () => {
    expect([...emojiLine(base.marks)].length).toBeGreaterThanOrEqual(5)
  })
})

describe('sonuç cümlesi', () => {
  it('Türkçe ondalık virgülle', () => {
    expect(verdictLine({ ...base, heardSeconds: 0.5 })).toBe('0,5 saniyede bildim')
  })
  it('hiç dinlemeden bilmek ayrı bir cümle', () => {
    expect(verdictLine({ ...base, heardSeconds: 0 })).toBe('hiç dinlemeden bildim')
  })
  it('kaybedince', () => {
    expect(verdictLine({ ...base, won: false })).toBe('bilemedim')
  })
})

describe('oklch → hex', () => {
  it('görselde kullanılabilir bir hex üretir', () => {
    for (const chip of ['pop', 'rap', 'karisik', 'rock', 'doksanlar'] as const) {
      expect(accentHex(chip)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('beyaz ve siyah uçları doğru', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchToHex(0, 0, 0)).toBe('#000000')
  })

  it('seçkiler birbirinden ayırt edilebilir renkler veriyor', () => {
    const renkler = new Set(['pop', 'rap', 'rock', 'karisik'].map((c) => accentHex(c as 'pop')))
    expect(renkler.size).toBe(4)
  })
})
