import { describe, expect, it } from 'vitest'
import { epostaNormu, yoneticiListesi, yoneticiMi } from '../eposta'

const YONETICI = 'bilgehanilgar@gmail.com'

describe('epostaNormu', () => {
  it('kırpar ve küçültür', () => {
    expect(epostaNormu('  BilgehanIlgar@Gmail.COM ')).toBe(YONETICI)
  })

  it('Türkçe küçültme KULLANMAZ — "I" harfi "i" olur', () => {
    // turkishLower olsaydı "ılgar" çıkar ve eşleşme bozulurdu.
    expect(epostaNormu('BILGEHANILGAR@GMAIL.COM')).toBe(YONETICI)
  })

  it('Gmail: nokta ve +etiket yok sayılır', () => {
    expect(epostaNormu('bilgehan.ilgar@gmail.com')).toBe(YONETICI)
    expect(epostaNormu('bilgehanilgar+yonetim@gmail.com')).toBe(YONETICI)
    expect(epostaNormu('b.i.l.g.e.h.a.n.ilgar+x@googlemail.com')).toBe('bilgehanilgar@googlemail.com')
  })

  it('Gmail DIŞINDA nokta anlamlıdır, korunur', () => {
    expect(epostaNormu('ad.soyad@sirket.com')).toBe('ad.soyad@sirket.com')
    expect(epostaNormu('ad.soyad@sirket.com')).not.toBe('adsoyad@sirket.com')
  })

  it('bozuk adreslerde çökmez', () => {
    expect(epostaNormu('')).toBe('')
    expect(epostaNormu('@gmail.com')).toBe('@gmail.com')
    expect(epostaNormu('bilgehan@')).toBe('bilgehan@')
    expect(epostaNormu('...@gmail.com')).toBe('...@gmail.com')
  })
})

describe('yoneticiListesi', () => {
  it('virgülle ayrılır, boşluklara aldırmaz', () => {
    const l = yoneticiListesi(' a@gmail.com , b@sirket.com ')
    expect([...l].sort()).toEqual(['a@gmail.com', 'b@sirket.com'])
  })

  it('boş ve tanımsız girdi boş küme verir', () => {
    expect(yoneticiListesi(undefined).size).toBe(0)
    expect(yoneticiListesi('').size).toBe(0)
    expect(yoneticiListesi('   ').size).toBe(0)
    expect(yoneticiListesi(',,,').size).toBe(0)
  })
})

describe('yoneticiMi', () => {
  it('listedeki adresi tanır — yazım biçimi ne olursa olsun', () => {
    for (const giren of [YONETICI, 'BilgehanIlgar@gmail.com', 'bilgehan.ilgar@gmail.com', 'bilgehanilgar+x@gmail.com']) {
      expect([giren, yoneticiMi(giren, YONETICI)]).toEqual([giren, true])
    }
  })

  it('LİSTE YOKSA KİMSE YÖNETİCİ DEĞİL — açığa değil kapalıya düşer', () => {
    expect(yoneticiMi(YONETICI, undefined)).toBe(false)
    expect(yoneticiMi(YONETICI, '')).toBe(false)
    expect(yoneticiMi(YONETICI, '   ')).toBe(false)
  })

  it('benzer ama farklı adresleri reddeder', () => {
    for (const sahte of [
      'bilgehanilgar@gmail.com.tr',
      'xbilgehanilgar@gmail.com',
      'bilgehanilgar@gmail.co',
      'bilgehanilgar@googlemail.com',
      'bilgehanilgar@evil.com',
      'bilgehanilgar@gmail.com.evil.com',
    ]) {
      expect([sahte, yoneticiMi(sahte, YONETICI)]).toEqual([sahte, false])
    }
  })

  it('e-posta yoksa reddeder', () => {
    expect(yoneticiMi(null, YONETICI)).toBe(false)
    expect(yoneticiMi('', YONETICI)).toBe(false)
    expect(yoneticiMi('bilgehanilgar', YONETICI)).toBe(false)
  })

  it('çoklu listede her adres geçerli', () => {
    const liste = 'a@gmail.com, bilgehanilgar@gmail.com ,c@sirket.com'
    expect(yoneticiMi('A@GMAIL.COM', liste)).toBe(true)
    expect(yoneticiMi(YONETICI, liste)).toBe(true)
    expect(yoneticiMi('d@gmail.com', liste)).toBe(false)
  })
})
