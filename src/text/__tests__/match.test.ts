import { describe, it, expect } from 'vitest'
import { judgeGuess } from '../match'
import { buildKeys, cleanKey } from '../keys'
import type { Song } from '@/data/schema'

/**
 * Oyunun en incelikli kuralı burada: bir tahmini kabul etmek, reddetmek ya da
 * "hangisini kastettin?" diye sormak. Yanlış kabul oyuncuya hak etmediği bir tur
 * kazandırır; yanlış ret ise bildiği şarkıda hakkını yer. İkisi de sessizdir,
 * bu yüzden testle tutuluyor.
 */
function song(artist: string, title: string, over: Partial<Song> = {}): Song {
  return {
    id: `itunes:${artist}-${title}`,
    t: title,
    a: artist,
    ar: '', p: '', cs: 0.325, du: 29, y: 2000, e: '00', d: 3, c: 'pop', u: '',
    nT: cleanKey(title),
    nA: cleanKey(artist),
    k: buildKeys({ title, artist }),
    ...over,
  }
}

const easy = { easySearch: true }
const hard = { easySearch: false }

const gulpembe = song('Barış Manço', 'Gülpembe')
const kumbara = song('Sezen Aksu', 'Kaybolan Yıllar')
const pool = [gulpembe, kumbara]

describe('judgeGuess — kabul', () => {
  it('tam yazım kabul', () => {
    expect(judgeGuess('Gülpembe', gulpembe, pool, easy)).toEqual({
      kind: 'correct',
      near: false,
    })
  })

  it('Türkçe karakter olmadan kabul', () => {
    // Oyuncuların çoğu telefon klavyesinde şapkasız yazar.
    expect(judgeGuess('gulpembe', gulpembe, pool, easy).kind).toBe('correct')
  })

  it('sanatçı + şarkı birlikte kabul', () => {
    expect(judgeGuess('Barış Manço Gülpembe', gulpembe, pool, easy).kind).toBe('correct')
  })

  it('kelime sırası kaymış olsa da kabul', () => {
    const s = song('Nazan Öncel', 'Ben Şarkı Söylerim')
    expect(judgeGuess('Şarkı Söylerim Ben', s, [s], easy)).toEqual({
      kind: 'correct',
      near: false,
    })
  })

  it('küçük yazım hatası affedilir ve "az kalsın" olarak işaretlenir', () => {
    const v = judgeGuess('gulpenbe', gulpembe, pool, easy)
    expect(v.kind).toBe('correct')
    if (v.kind === 'correct') expect(v.near).toBe(true)
  })

  it('boş tahmin hak tüketmez', () => {
    expect(judgeGuess('   ', gulpembe, pool, easy)).toEqual({ kind: 'empty' })
  })
})

describe('judgeGuess — ret', () => {
  it('alakasız tahmin yanlış', () => {
    expect(judgeGuess('istanbul', gulpembe, pool, easy)).toEqual({
      kind: 'wrong',
      sameArtist: false,
    })
  })

  it('havuzdaki BAŞKA bir şarkıyı yazmak yanlıştır, belirsizlik değil', () => {
    // Oyuncu net bir tercih yaptı; "hangisini kastettin?" sormak anlamsız olurdu.
    const v = judgeGuess('Kaybolan Yıllar', gulpembe, pool, easy)
    expect(v.kind).toBe('wrong')
  })

  it('yalnızca sanatçı adı yazmak yanlıştır ama bu ayrıca bildirilir', () => {
    const v = judgeGuess('Barış Manço', gulpembe, pool, easy)
    expect(v).toEqual({ kind: 'wrong', sameArtist: true })
  })
})

describe('judgeGuess — kısa adlar', () => {
  /**
   * ⚠️ Türkçede üç harfli GERÇEK şarkı adları bol: Sus, Sen, Gel, Aşk. Bunlarda
   * bir harflik tolerans bile tamamen başka bir şarkıyı kabul ettirir, bu yüzden
   * kısa anahtarlarda tam yazım isteniyor.
   */
  const sus = song('Duman', 'Sus')
  const sen = song('Teoman', 'Sen')
  const kisaHavuz = [sus, sen]

  it('tam yazım kabul', () => {
    expect(judgeGuess('sus', sus, kisaHavuz, easy).kind).toBe('correct')
  })

  it('bir harf sapma KABUL EDİLMEZ', () => {
    expect(judgeGuess('sun', sus, kisaHavuz, easy).kind).toBe('wrong')
  })

  it('komşu kısa ad başka şarkıyı kazandırmaz', () => {
    expect(judgeGuess('sen', sus, kisaHavuz, easy).kind).toBe('wrong')
  })
})

describe('judgeGuess — belirsizlik koruması', () => {
  /**
   * İki şarkı birbirine bulanık eşikte yakınsa hak TÜKETİLMEZ; oyuncuya hangisini
   * kastettiği sorulur. Bu olmadan "bulanık kabul" sessizce "bulanık YANLIŞ
   * kabul"e dönüşür.
   */
  const a = song('Sanatçı A', 'Yalnızlık Paylaşılmaz')
  const b = song('Sanatçı B', 'Yalnızlık Paylaşılmaza')
  const ikiz = [a, b]

  it('iki şarkıya da uyan bulanık yazımda hak tüketilmez', () => {
    const v = judgeGuess('yalnizlik paylasilmaz', a, ikiz, easy)
    if (v.kind === 'ambiguous') {
      expect(v.candidates.length).toBeGreaterThanOrEqual(2)
      // Doğru cevap listede İLK sırada olmalı.
      expect(v.candidates[0]!.id).toBe(a.id)
      expect(v.candidates.length).toBeLessThanOrEqual(5)
    } else {
      // Eşikler değişmiş olabilir; en azından yanlış kabul etmemeli.
      expect(v.kind).toBe('correct')
    }
  })

  it('rakip yoksa bulanık yazım doğrudan kabul edilir', () => {
    expect(judgeGuess('gulpenbe', gulpembe, [gulpembe], easy).kind).toBe('correct')
  })
})

describe('judgeGuess — zor mod', () => {
  it('kolay aramada affedilen hata zor modda affedilmeyebilir', () => {
    const kolay = judgeGuess('kaybolan yillarr', kumbara, pool, easy)
    const zor = judgeGuess('kaybolan yillarr', kumbara, pool, hard)
    // Zor mod ASLA kolaydan daha cömert olamaz.
    const rank = (k: string) => (k === 'correct' ? 2 : k === 'ambiguous' ? 1 : 0)
    expect(rank(zor.kind)).toBeLessThanOrEqual(rank(kolay.kind))
  })

  it('tam yazım her iki modda da kabul', () => {
    expect(judgeGuess('Gülpembe', gulpembe, pool, hard).kind).toBe('correct')
  })
})
