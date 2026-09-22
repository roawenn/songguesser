import { describe, it, expect } from 'vitest'
import type { GunlukOturum } from '../gunluk'
import { adayaGecir, hamleUygula, oluDenetle, type GunlukHamle, type HamleSonucu } from '../gunlukHamle'
import { hakemKur } from '../gunlukHakem'
import {
  KAPAK_1, KAPAK_2, SARKI_1, SARKI_2, UNLU_1, UNLU_2, ornekSet, sarki, yeniOturum,
} from './gunlukOrnek'

const SET = ornekSet()
const BENZER = sarki(3, 'Şımarıkk', 'Başkası', 1)
const HAKEM = hakemKur(
  {
    sarkilar: [SARKI_1, SARKI_2, sarki(4, 'Kuzu Kuzu', 'Tarkan', 1), sarki(5, 'Dudu', 'Tarkan', 2)],
    unluler: [UNLU_1, UNLU_2],
    kapaklar: [KAPAK_1, KAPAK_2],
  },
  () => 0,
)
const SON_TESLIM = 10_000_000

function uygula(o: GunlukOturum, tur: number, hamle: GunlukHamle, simdi = 1000, hazirMs?: number): HamleSonucu {
  const sira = o.turlar[tur]?.olaylar.length ?? 0
  return hamleUygula(o, SET, { tur, sira, hamle, hazirMs }, simdi, HAKEM, SON_TESLIM)
}

function uygulandi(r: HamleSonucu): GunlukOturum {
  if (r.tur !== 'uygulandi') throw new Error(`beklenmeyen: ${JSON.stringify(r)}`)
  return r.oturum
}

/** Turu açıp verilen hamlelerle oynar. */
function oyna(o: GunlukOturum, hamleler: GunlukHamle[], simdi = 1000): GunlukOturum {
  const tur = o.turlar.length
  let x = uygulandi(uygula(o, tur, { t: 'sonraki' }, simdi))
  for (const h of hamleler) x = uygulandi(uygula(x, tur, h, simdi))
  return x
}

describe('sonraki', () => {
  it('ilk turu açar, medya anını sunucu saatinden yazar', () => {
    const o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }, 5000))
    expect(o.turlar).toHaveLength(1)
    expect(o.turlar[0]).toMatchObject({ aday: 0, medyaVerildi: 5000, olaylar: [], sonuc: null })
  })

  it('tekrar istenirse değişmez; ileri tur ve süren turda sonraki reddedilir', () => {
    const o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }))
    expect(uygula(o, 0, { t: 'sonraki' }).tur).toBe('degismedi')
    expect(uygula(o, 1, { t: 'sonraki' })).toMatchObject({ tur: 'hata', kod: 409 })
    expect(uygula(o, 2, { t: 'sonraki' })).toMatchObject({ tur: 'hata', kod: 409 })
  })

  it('setin aktif adayını alır', () => {
    const set = { ...SET, slotlar: SET.slotlar.map((s, i) => (i === 0 ? { ...s, aktif: 2 } : s)) }
    const r = hamleUygula(yeniOturum(), set, { tur: 0, sira: 0, hamle: { t: 'sonraki' } }, 1, HAKEM, SON_TESLIM)
    expect(uygulandi(r).turlar[0]!.aday).toBe(2)
  })
})

describe('tahmin', () => {
  it('ilk adımda doğru: 100 + hız bonusu, hazırlanma düşülür', () => {
    let o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }, 0))
    const r = uygula(o, 0, { t: 'tahmin', metin: '  şımarık ' }, 12_000, 12_000)
    o = uygulandi(r)
    expect(r.tur === 'uygulandi' && r.geri).toEqual({ kind: 'dogru' })
    expect(o.turlar[0]!.hazirMs).toBe(12_000)
    expect(o.turlar[0]!.sonuc).toMatchObject({ kazandi: true, adimIndeksi: 0, sureMs: 0, hizBonusu: 20, puan: 120 })
  })

  it('yanlış hüküm olarak saklanır, sanatçı tutarsa işaretlenir', () => {
    const o = oyna(yeniOturum(), [{ t: 'tahmin', metin: 'Kuzu Kuzu' }])
    expect(o.turlar[0]!.olaylar).toEqual([{ t: 'Y', m: 'Kuzu Kuzu', sa: false, z: 0 }])
    const r = uygula(o, 0, { t: 'tahmin', metin: 'tarkan' })
    expect(r.tur === 'uygulandi' && r.geri).toEqual({ kind: 'yanlis', sameArtist: true })
  })

  it('boş tahmin yazılmaz; belirsiz tahmin hak yakmaz', () => {
    const o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }))
    expect(uygula(o, 0, { t: 'tahmin', metin: '   ' }).tur).toBe('bos')

    const hakem = hakemKur({ sarkilar: [SARKI_1, BENZER], unluler: [], kapaklar: [] }, () => 0)
    const r = hamleUygula(o, SET, { tur: 0, sira: 0, hamle: { t: 'tahmin', metin: 'şımarıkk' } }, 1, hakem, SON_TESLIM)
    expect(r.tur).toBe('belirsiz')
    if (r.tur === 'belirsiz') {
      expect(r.adaylar.map((a) => a.id).sort()).toEqual([BENZER.id, SARKI_1.id].sort())
      expect(r.adaylar.find((a) => a.id === SARKI_1.id)).toEqual({ id: SARKI_1.id, ust: 'Şımarık', alt: 'Tarkan' })
    }
  })

  it('seçim: doğru kimlik kazanır, başka kimlik hak yakar, uydurma kimlik 400', () => {
    const o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }))
    const yanlis = uygulandi(uygula(o, 0, { t: 'sec', id: 'itunes:4' }))
    expect(yanlis.turlar[0]!.olaylar[0]).toMatchObject({ t: 'Y', m: 'Kuzu Kuzu', sa: true })
    expect(uygulandi(uygula(yanlis, 0, { t: 'sec', id: SARKI_1.id })).turlar[0]!.sonuc?.kazandi).toBe(true)
    expect(uygula(o, 0, { t: 'sec', id: 'itunes:999' })).toMatchObject({ tur: 'hata', kod: 400 })
  })

  it('uzun metin kırpılır', () => {
    const o = oyna(yeniOturum(), [{ t: 'tahmin', metin: 'a'.repeat(500) }])
    const olay = o.turlar[0]!.olaylar[0]!
    expect(olay.t === 'Y' && olay.m.length).toBe(60)
  })
})

describe('idempotentlik', () => {
  it('eski sira değişmez, ileri sira 409, geçmiş tur değişmez', () => {
    const o = oyna(yeniOturum(), [{ t: 'pas' }])
    const eski = hamleUygula(o, SET, { tur: 0, sira: 0, hamle: { t: 'pas' } }, 1, HAKEM, SON_TESLIM)
    expect(eski.tur).toBe('degismedi')
    const ileri = hamleUygula(o, SET, { tur: 0, sira: 5, hamle: { t: 'pas' } }, 1, HAKEM, SON_TESLIM)
    expect(ileri).toMatchObject({ tur: 'hata', kod: 409 })

    const iki = oyna(oyna(yeniOturum(), [{ t: 'tahmin', metin: 'şımarık' }]), [])
    expect(hamleUygula(iki, SET, { tur: 0, sira: 0, hamle: { t: 'pas' } }, 1, HAKEM, SON_TESLIM).tur).toBe('degismedi')
  })

  it('bitmiş turda yeni hamle 409; kural dışı hamle 409', () => {
    const o = oyna(yeniOturum(), [{ t: 'tahmin', metin: 'şımarık' }])
    expect(uygula(o, 0, { t: 'pas' })).toMatchObject({ tur: 'hata', kod: 409 })

    const unluTuru = oyna(oyna(oyna(yeniOturum(), [{ t: 'pas' }, { t: 'pas' }, { t: 'pas' }, { t: 'pas' }, { t: 'pas' }]), [{ t: 'tahmin', metin: 'Gülpembe' }]), [])
    expect(unluTuru.turlar[2]!.olaylar).toEqual([])
    expect(uygula(unluTuru, 2, { t: 'ipucu' })).toMatchObject({ tur: 'hata', kod: 409 })
  })
})

describe('oturumun bitişi', () => {
  it('altıncı tur bitince toplam puan ve bitiş yazılır', () => {
    let o = yeniOturum()
    o = oyna(o, [{ t: 'tahmin', metin: 'Şımarık' }], 0) // 120
    o = oyna(o, [{ t: 'pas' }, { t: 'tahmin', metin: 'Gülpembe' }], 0) // 100
    o = oyna(o, [{ t: 'tahmin', metin: 'kemal sunal' }], 0) // 120
    o = oyna(o, [{ t: 'pas' }, { t: 'pas' }, { t: 'pas' }, { t: 'pas' }], 0) // 0
    o = oyna(o, [{ t: 'tahmin', metin: 'ölürüm sana' }], 0) // 120
    expect(o.bitti).toBeNull()
    o = uygulandi(uygula(o, 5, { t: 'sonraki' }, 0))
    o = uygulandi(uygula(o, 5, { t: 'tahmin', metin: 'Yalnızlık Senfonisi' }, 30_000)) // 100 + 10
    expect(o.bitti).toBe(30_000)
    expect(o.puan).toBe(120 + 100 + 120 + 0 + 120 + 110)
    expect(uygula(o, 5, { t: 'pas' }).tur).toBe('degismedi')
    expect(uygula(o, 6, { t: 'sonraki' }).tur).toBe('degismedi')
  })

  it('son teslimden sonra zaman aşımı; arşivde son teslim yok', () => {
    const o = oyna(yeniOturum(), [{ t: 'tahmin', metin: 'şımarık' }])
    const r = hamleUygula(o, SET, { tur: 1, sira: 0, hamle: { t: 'sonraki' } }, SON_TESLIM + 1, HAKEM, SON_TESLIM)
    expect(r.tur).toBe('zaman-asimi')
    if (r.tur === 'zaman-asimi') expect(r.oturum).toMatchObject({ zamanAsimi: true, puan: 120, bitti: SON_TESLIM + 1 })

    const arsiv = { ...o, sirali: false }
    expect(hamleUygula(arsiv, SET, { tur: 1, sira: 0, hamle: { t: 'sonraki' } }, SON_TESLIM + 1, HAKEM, SON_TESLIM).tur).toBe('uygulandi')
  })
})

describe('ölü medya', () => {
  it('yalnız olaysız süren turda geçerli; takas saati sıfırlar', () => {
    const o = uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }, 100))
    expect(oluDenetle(o, { tur: 0, sira: 0 }, 200, SON_TESLIM)).toBeNull()
    const takas = adayaGecir(o, 0, 1, 900, true)
    expect(takas.turlar[0]).toEqual({ aday: 1, medyaVerildi: 900, hazirMs: null, olaylar: [], sonuc: null })
    expect(takas.yedekKullanildi).toBe(true)

    const olayli = uygulandi(uygula(o, 0, { t: 'pas' }))
    expect(oluDenetle(olayli, { tur: 0, sira: 1 }, 200, SON_TESLIM)).toMatchObject({ tur: 'hata', kod: 409 })
    expect(oluDenetle(yeniOturum(), { tur: 0, sira: 0 }, 200, SON_TESLIM)).toMatchObject({ tur: 'hata', kod: 409 })
  })
})

/**
 * Sunucu, tahmin başına 7-9 MB'lık havuzu yüklemesin diye hakem önce HAVUZSUZ
 * kuruluyor; karara varamadığında `havuz-gerekli` diyor ve rota havuzu yükleyip
 * hamleyi tekrar uyguluyor (bkz. `api/gunluk/hamle`). Buradaki testler o
 * sinyalin DOĞRU anlarda çıktığını kilitliyor: gereğinden sık çıkarsa kazanç
 * kaybolur, gereğinden seyrek çıkarsa belirsizlik koruması sessizce devre dışı
 * kalır ve oyuncular hak etmedikleri turları kazanır.
 */
describe('havuzsuz hakem', () => {
  const HAVUZSUZ = hakemKur(null, () => 0)
  const havuzsuzUygula = (o: GunlukOturum, tur: number, hamle: GunlukHamle) =>
    hamleUygula(o, SET, { tur, sira: o.turlar[tur]?.olaylar.length ?? 0, hamle }, 1000, HAVUZSUZ, SON_TESLIM)

  const acik = () => uygulandi(uygula(yeniOturum(), 0, { t: 'sonraki' }))

  it('tam doğru tahmin havuzsuz karara bağlanır', () => {
    const r = havuzsuzUygula(acik(), 0, { t: 'tahmin', metin: 'Şımarık' })
    expect(r.tur).toBe('uygulandi')
    if (r.tur === 'uygulandi') expect(r.geri).toEqual({ kind: 'dogru' })
  })

  it('alakasız yanlış tahmin havuzsuz karara bağlanır', () => {
    const r = havuzsuzUygula(acik(), 0, { t: 'tahmin', metin: 'zxcvbnm qwerty' })
    expect(r.tur).toBe('uygulandi')
    if (r.tur === 'uygulandi') expect(r.geri).toMatchObject({ kind: 'yanlis' })
  })

  it('boş tahmin havuzsuz karara bağlanır', () => {
    expect(havuzsuzUygula(acik(), 0, { t: 'tahmin', metin: '   ' }).tur).toBe('bos')
  })

  it('cevaba YAKIN yazım havuz ister', () => {
    expect(havuzsuzUygula(acik(), 0, { t: 'tahmin', metin: 'şımarıkk' }).tur).toBe('havuz-gerekli')
  })

  it('belirsizlikten seçim havuz ister — kimlik indeksi gerçekten lazım', () => {
    expect(havuzsuzUygula(acik(), 0, { t: 'sec', id: 'itunes:4' }).tur).toBe('havuz-gerekli')
  })

  it('doğru kimlikle seçim havuzsuz da çözülür — indeks gerekmiyor', () => {
    const r = havuzsuzUygula(acik(), 0, { t: 'sec', id: SARKI_1.id })
    expect(r.tur).toBe('uygulandi')
  })

  it('pas, ipucu ve sonraki havuza hiç dokunmaz', () => {
    for (const h of [{ t: 'pas' }, { t: 'ipucu' }] as const) {
      expect([h.t, havuzsuzUygula(acik(), 0, h).tur]).toEqual([h.t, 'uygulandi'])
    }
  })

  it('havuz yüklenince aynı hamle normal sonucunu verir', () => {
    const o = acik()
    expect(havuzsuzUygula(o, 0, { t: 'tahmin', metin: 'şımarıkk' }).tur).toBe('havuz-gerekli')
    const hakem = hakemKur({ sarkilar: [SARKI_1, BENZER], unluler: [], kapaklar: [] }, () => 0)
    const r = hamleUygula(o, SET, { tur: 0, sira: 0, hamle: { t: 'tahmin', metin: 'şımarıkk' } }, 1, hakem, SON_TESLIM)
    expect(r.tur).toBe('belirsiz')
  })
})
