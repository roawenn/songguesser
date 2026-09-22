import { describe, it, expect } from 'vitest'
import { havuzGerekli, judgeGuess } from '../match'
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
      // Doğru cevap listede OLMALI — ama belirli bir sırada değil, bkz. altı.
      expect(v.candidates.some((s) => s.id === a.id)).toBe(true)
      expect(v.candidates.length).toBeLessThanOrEqual(5)
    } else {
      // Eşikler değişmiş olabilir; en azından yanlış kabul etmemeli.
      expect(v.kind).toBe('correct')
    }
  })

  /**
   * ⚠️ Cevap SABİT BİR YERDE DURMAMALI.
   *
   * Eskiden `[answer, ...rivals]` döndürülüyordu ve arayüz diziyi olduğu gibi
   * çizdiği için en soldaki çip her zaman doğru cevaptı: oyuncuyu kayırmak
   * için var olan koruma, bedava kazanca dönüşmüştü.
   */
  /*
   * ⚠️ Tahmin BULANIK olmalı: anahtarla tam eşleşen bir yazım 2. adımda
   * doğrudan "doğru" dönüyor ve belirsizlik yoluna hiç girilmiyor. Aşağıdaki
   * tahmin cevaptan bir harf eksik (mesafe 1), rakipten iki (mesafe 2).
   */
  const bulanik = 'yalnizlik paylasilmz'

  it('doğru cevap listede sabit bir konumda değil', () => {
    // Hep 0 döndüren rand, Fisher-Yates'te son elemanı başa taşır.
    const bas = judgeGuess(bulanik, a, ikiz, easy, () => 0)
    expect(bas.kind).toBe('ambiguous')
    if (bas.kind !== 'ambiguous') return
    expect(bas.candidates[0]!.id).not.toBe(a.id)
    expect(bas.candidates.some((s) => s.id === a.id)).toBe(true)
  })

  /**
   * ⚠️ Karıştırmayı kırpmadan SONRA yapmak, beşten fazla rakip varken cevabı
   * listeden tamamen düşürür ve turu kazanılamaz hâle getirirdi.
   */
  it('rakip sayısı tavanı aşsa da cevap listede kalır', () => {
    const cevap = song('Sanatçı 0', 'Yalnızlık Paylaşılmaz')
    // Her rakip son harfte farklı: tahmine mesafeleri eşit (2), yani hepsi aday.
    const rakipler = 'bcdefghjklmn'
      .split('')
      .map((ch, i) => song(`Sanatçı ${i + 1}`, `Yalnızlık Paylaşılma${ch}`))
    const genisHavuz = [cevap, ...rakipler]

    for (const r of [() => 0, () => 0.5, () => 0.999, Math.random]) {
      const v = judgeGuess(bulanik, cevap, genisHavuz, easy, r)
      expect(v.kind).toBe('ambiguous')
      if (v.kind !== 'ambiguous') continue
      expect(v.candidates.length).toBeLessThanOrEqual(5)
      expect(v.candidates.some((s) => s.id === cevap.id)).toBe(true)
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

/**
 * İkinci oyun (ünlü tanıma) `judgeGuess`'i SANATÇISIZ öğelerle kullanacak:
 * `nA` boş dize olacak. Bu blok, o durumda davranışın bozulmadığını kilitliyor.
 *
 * ⚠️ En sinsi tuzak: `sameArtist` hesabındaki `guessAsArtist.length > 0`
 * koşulu silinirse iki boş dize eşit sayılır ve HER yanlış tahmin "sanatçı
 * doğru" rozeti gösterir. Aşağıdaki ilk test tam olarak bunu yakalar.
 */
describe('sanatçısız öğeler (ünlü oyunu şekli)', () => {
  const unlu = (ad: string) => ({
    id: `unlu:${cleanKey(ad)}`,
    nA: '',
    k: buildKeys({ title: ad, artist: '' }),
  })

  const tarkan = unlu('Tarkan')
  const cem = unlu('Cem Yılmaz')
  const havuz = [tarkan, cem]

  it('boş nA yüzünden "sanatçı doğru" DEMEZ', () => {
    const v = judgeGuess('bambaska birisi', tarkan, havuz, easy)
    expect(v.kind).toBe('wrong')
    if (v.kind === 'wrong') expect(v.sameArtist).toBe(false)
  })

  /**
   * ⚠️ Bu testin girdisi ÖZENLE seçildi ve kırılarak doğrulandı.
   *
   * "(remix)" `normalizeLoose` altında "remix" (yani boş değil, erken `empty`
   * dönüşü olmuyor) ama `cleanKey` altında BOŞ — parantez ve gürültü siliniyor.
   * `sameArtist` hesabındaki `guessAsArtist.length > 0` koşulu kaldırılırsa
   * boş tahmin anahtarı boş `nA` ile eşleşir ve rozet yanlışlıkla çıkar.
   *
   * "bambaska birisi" gibi sıradan bir yanlış tahmin bunu YAKALAMAZ: o zaten
   * boş olmadığı için boş `nA` ile hiçbir koşulda eşleşmiyor.
   */
  it('tahmin gürültüden ibaretse de "sanatçı doğru" DEMEZ', () => {
    const v = judgeGuess('(remix)', tarkan, havuz, easy)
    expect(v.kind).toBe('wrong')
    if (v.kind === 'wrong') expect(v.sameArtist).toBe(false)
  })

  it('adı doğru yazınca kabul eder', () => {
    expect(judgeGuess('Tarkan', tarkan, havuz, easy).kind).toBe('correct')
    expect(judgeGuess('cem yilmaz', cem, havuz, easy).kind).toBe('correct')
  })

  it('sanatçısız anahtarlar boşluk dolgulu üretilmez', () => {
    for (const o of havuz) {
      expect(o.k.length).toBeGreaterThan(0)
      expect(o.k.every((x) => x === x.trim() && x.length > 0)).toBe(true)
    }
  })

  it('Türkçe karakter olmadan da bilinir', () => {
    expect(judgeGuess('cem yilmaz', cem, havuz, easy).kind).toBe('correct')
  })
})

/**
 * Günlük modda sunucu, havuzu yalnızca gerektiğinde yüklüyor (bkz. `havuzGerekli`).
 * Bu bloğun işi o kısayolun DAVRANIŞI DEĞİŞTİRMEDİĞİNİ kilitlemek: havuz
 * gerekmediği söylenen her tahminde boş havuzla verilen karar, tam havuzla
 * verilenin birebir aynısı olmalı. Aksi hâlde kısayol, yalnızca yazım hatası
 * yapan oyuncuda görünen sessiz bir yanlış karara dönüşür.
 */
describe('havuzGerekli', () => {
  const genisHavuz = [gulpembe, kumbara, song('Sezen Aksu', 'Gülümse'), song('Ajda Pekkan', 'Palavra Palavra')]

  it('tam ve kelime-kümesi eşleşmesinde havuz gerekmez', () => {
    for (const g of ['Gülpembe', 'gulpembe', 'GÜLPEMBE']) {
      expect([g, havuzGerekli(g, gulpembe, easy)]).toEqual([g, false])
    }
  })

  it('boş ve alakasız tahminde havuz gerekmez', () => {
    for (const g of ['', '   ', 'zxcvbnm asdf', 'bambaşka bir şarkı']) {
      expect([g, havuzGerekli(g, gulpembe, easy)]).toEqual([g, false])
    }
  })

  it('cevaba YAKIN yazım hatasında havuz gerekir', () => {
    expect(havuzGerekli('Gülpemve', gulpembe, easy)).toBe(true)
  })

  it('zor modda eşik daralır — aynı tahmin havuz gerektirmeyebilir', () => {
    // Kolay aramada yakın sayılan bir yazım, zor modda uzak sayılabilir.
    const kolay = havuzGerekli('Gülpemve', gulpembe, easy)
    const zor = havuzGerekli('Gülpemve', gulpembe, hard)
    expect(kolay).toBe(true)
    expect(typeof zor).toBe('boolean')
  })

  it('DENKLİK: havuz gerekmiyorsa boş havuz tam havuzla AYNI kararı verir', () => {
    const tahminler = [
      '', '   ', 'Gülpembe', 'gulpembe', 'GULPEMBE', 'Barış Manço',
      'zxcvbnm', 'bambaşka bir şarkı', 'Kaybolan Yıllar', 'kaybolan yillar',
      'Gülümse', 'Palavra Palavra', 'palavra', 'Gülpemve', 'Kayboln Yllar',
    ]
    for (const g of tahminler) {
      for (const mod of [easy, hard]) {
        for (const cevap of [gulpembe, kumbara]) {
          if (havuzGerekli(g, cevap, mod)) continue
          expect([g, mod.easySearch, cevap.id, judgeGuess(g, cevap, [], mod)]).toEqual([
            g, mod.easySearch, cevap.id, judgeGuess(g, cevap, genisHavuz, mod),
          ])
        }
      }
    }
  })
})
