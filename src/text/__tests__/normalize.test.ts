import { describe, it, expect } from 'vitest'
import { turkishLower, normalizeLoose, foldDiacritics } from '../normalize'
import { cleanKey, buildKeys } from '../keys'
import { damerau, maxDistanceFor } from '../distance'

describe('turkishLower — noktasız/noktalı i tuzağı', () => {
  it('İ büyük harfini birleşen nokta bırakmadan küçültür', () => {
    const out = turkishLower('İSTANBUL')
    expect(out).toBe('istanbul')
    // Regresyon koruması: yerleşik toLowerCase U+0307 sızdırır.
    expect(out).not.toContain('\u0307')
    expect([...out].length).toBe(8)
  })

  it('noktasız I büyük harfini ı yapar (toLowerCase burada YANLIŞ olurdu)', () => {
    expect(turkishLower('ILGIN')).toBe('ılgın')
    expect(turkishLower('ISPARTA')).toBe('ısparta')
  })

  it('İstanbul yazımlarının hepsi aynıya yakınsar', () => {
    expect(turkishLower('İstanbul')).toBe('istanbul')
    expect(turkishLower('istanbul')).toBe('istanbul')
  })
})

describe('foldDiacritics', () => {
  it('Türkçe diyakritikleri katlar', () => {
    expect(foldDiacritics('şğüöçı')).toBe('sguoci')
  })

  it('yabancı isimlerdeki aksanları da temizler', () => {
    expect(foldDiacritics('josé')).toBe('jose')
    expect(foldDiacritics('beyoncé')).toBe('beyonce')
  })
})

describe('normalizeLoose', () => {
  const cases: Array<[string, string]> = [
    ['Şımarık', 'simarik'],
    ['Gülpembe', 'gulpembe'],
    ['Ağla Kalbim', 'agla kalbim'],
    ["Kalbim Ege'de Kaldı", 'kalbim egede kaldi'],
    ['Uzun İnce Bir Yoldayım', 'uzun ince bir yoldayim'],
    ['ÇOK GÜZEL GÜLÜYORSUN', 'cok guzel guluyorsun'],
  ]
  it.each(cases)('%s → %s', (input, expected) => {
    expect(normalizeLoose(input)).toBe(expected)
  })

  it('ı ve i kasıtlı olarak aynı anahtara katlanır', () => {
    expect(normalizeLoose('sarkı')).toBe(normalizeLoose('sarki'))
  })
})

describe('cleanKey — gürültü temizliği', () => {
  const cases: Array<[string, string]> = [
    ['Bir Derdim Var (Remastered 2011)', 'bir derdim var'],
    ['Leyla feat. Ceza', 'leyla'],
    ['Yalnız Kurt (feat. Poizi)', 'yalniz kurt'],
    ['Bu Akşam - Live', 'bu aksam'],
    ['Sebebi Yar - Akustik', 'sebebi yar'],
    ['Heyecanı Yok [Remix]', 'heyecani yok'],
    ['Mavi Mavi - Remastered 2015', 'mavi mavi'],
  ]
  it.each(cases)('%s → %s', (input, expected) => {
    expect(cleanKey(input)).toBe(expected)
  })

  it('gerçekten "Remix" adlı bir şarkıyı yok etmez', () => {
    expect(cleanKey('Remix')).toBe('remix')
  })

  it('başlığın ortasındaki gürültü kelimesini silmez', () => {
    expect(cleanKey('Canlı Canlı Yaşamak')).toBe('canli canli yasamak')
  })
})

describe('buildKeys', () => {
  it('başlığı tek başına kabul eder, sanatçıyı ETMEZ', () => {
    const keys = buildKeys({ title: 'Suspus', artist: 'Ceza' })
    expect(keys).toContain('suspus')
    expect(keys).not.toContain('ceza')
    expect(keys).toContain('suspus ceza')
    expect(keys).toContain('ceza suspus')
  })

  it('normalize edilince boşalan başlıkta boşluk dolgulu anahtar ÜRETMEZ', () => {
    // Gerçek havuzdan: "[.]" — Replikas. Başlık yalnızca noktalama.
    const keys = buildKeys({ title: '[.]', artist: 'Replikas' })
    expect(keys.every((k) => k === k.trim())).toBe(true)
    expect(keys).not.toContain(' replikas')
    expect(keys).not.toContain('replikas ')
  })

  it('başlığın bir kısmı sağ kalıyorsa birleşik anahtarlar durur', () => {
    // "? (Aşk Olunca)" — Kargo: parantez içi normalize edilince "ask olunca".
    const keys = buildKeys({ title: '? (Aşk Olunca)', artist: 'Kargo' })
    expect(keys).toContain('ask olunca')
    expect(keys.every((k) => k === k.trim())).toBe(true)
  })

  it('takma adları dahil eder', () => {
    const keys = buildKeys({ title: 'Şımarık', artist: 'Tarkan', aliases: ['Kiss Kiss'] })
    expect(keys).toContain('kiss kiss')
  })
})

describe('damerau', () => {
  it('yer değiştirmeyi tek düzenleme sayar', () => {
    expect(damerau('gulpembe', 'gulpemeb', 3)).toBe(1)
  })

  it('max aşılınca erken çıkar', () => {
    expect(damerau('abcdefgh', 'zzzzzzzz', 2)).toBeGreaterThan(2)
  })

  it('aynı dizede sıfır', () => {
    expect(damerau('suspus', 'suspus', 2)).toBe(0)
  })
})

describe('maxDistanceFor — kısa Türkçe başlık koruması', () => {
  it('4 harf ve altında sıfır tolerans', () => {
    expect(maxDistanceFor(3)).toBe(0)
    expect(maxDistanceFor(4)).toBe(0)
  })

  it('kısa gerçek şarkı adları birbirini kabul etmemeli', () => {
    // Sus / Sen / Gel / Sos hepsi gerçek Türkçe şarkı adları.
    for (const other of ['sen', 'gel', 'sos', 'dus', 'sas']) {
      const allowed = maxDistanceFor('sus'.length)
      expect(damerau('sus', other, allowed)).toBeGreaterThan(allowed)
    }
  })

  it('uzun başlıklarda yazım hatası affeder', () => {
    expect(maxDistanceFor(15)).toBe(3)
    expect(maxDistanceFor(10)).toBe(2)
  })

  it('zor modda eşik sıkılaşır', () => {
    expect(maxDistanceFor(10, true)).toBe(1)
    expect(maxDistanceFor(6, true)).toBe(0)
  })
})
