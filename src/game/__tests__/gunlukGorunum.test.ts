import { describe, it, expect } from 'vitest'
import type { GunlukOturum } from '../gunluk'
import { gorunumOlustur } from '../gunlukGorunum'
import { hamleUygula, type GunlukHamle } from '../gunlukHamle'
import { hakemKur } from '../gunlukHakem'
import { KAPAK_1, KAPAK_2, SARKI_1, SARKI_2, UNLU_1, UNLU_2, ornekSet, yeniOturum } from './gunlukOrnek'

const SET = ornekSet()
const HAKEM = hakemKur({ sarkilar: [SARKI_1, SARKI_2], unluler: [UNLU_1, UNLU_2], kapaklar: [KAPAK_1, KAPAK_2] })
const SECENEK = {
  sonTeslim: 99,
  gorselAdresi: (t: number, a: number, adim: number) => `/api/gunluk/gorsel?t=${t}&a=${a}&n=${adim}&i=imza`,
}

function adim(o: GunlukOturum, hamle: GunlukHamle): GunlukOturum {
  const tur = hamle.t === 'sonraki' ? o.turlar.length : o.turlar.length - 1
  const r = hamleUygula(o, SET, { tur, sira: o.turlar[tur]?.olaylar.length ?? 0, hamle }, 1, HAKEM, 1e12)
  if (r.tur !== 'uygulandi') throw new Error(r.tur)
  return r.oturum
}

/** Süren turun JSON'unda cevaba dair hiçbir iz olmamalı. */
function sizintiYok(json: string, yasakli: string[]) {
  for (const y of yasakli) expect(json.toLowerCase()).not.toContain(y.toLowerCase())
}

describe('gorunumOlustur', () => {
  it('süren şarkı turunda kimlik, ad, sanatçı, kapak ve anahtar yok', () => {
    let o = adim(yeniOturum(), { t: 'sonraki' })
    o = adim(o, { t: 'tahmin', metin: 'yanlış bir şey' })
    const g = gorunumOlustur(o, SET, SECENEK)
    const tur = g.turlar[0]!
    expect(tur).toMatchObject({ oyun: 'sarki', durum: 'oynaniyor', attempt: 1, sira: 1, hakKalan: 2, cevap: null })
    expect(tur.oyun === 'sarki' && tur.medya).toEqual({ p: SARKI_1.p, cs: 30, du: 30 })
    sizintiYok(JSON.stringify({ ...tur, medya: null }), [SARKI_1.id, SARKI_1.t, SARKI_1.a, SARKI_1.ar!, SARKI_1.u!, ...SARKI_1.k, 'itunes'])
  })

  it('ipucu metinleri alındıkça eklenir', () => {
    let o = adim(yeniOturum(), { t: 'sonraki' })
    o = adim(o, { t: 'ipucu' })
    o = adim(o, { t: 'ipucu' })
    const tur = gorunumOlustur(o, SET, SECENEK).turlar[0]!
    expect(tur.oyun === 'sarki' && tur.ipuclari).toEqual(['1999', 'T…'])
  })

  it('süren ünlü ve kapak turunda yalnızca imzalı görsel adresi', () => {
    let o = yeniOturum()
    // İki şarkı turu merdivenin sonunda kaybedilir (beş pas).
    for (let i = 0; i < 2; i++) {
      o = adim(o, { t: 'sonraki' })
      for (let p = 0; p < 5; p++) o = adim(o, { t: 'pas' })
    }
    o = adim(o, { t: 'sonraki' })
    o = adim(o, { t: 'pas' })
    let g = gorunumOlustur(o, SET, SECENEK)
    const unlu = g.turlar[2]!
    expect(unlu).toMatchObject({ oyun: 'unlu', acilan: 2, cevap: null, medya: { gorsel: '/api/gunluk/gorsel?t=2&a=0&n=2&i=imza' } })
    sizintiYok(JSON.stringify(unlu), [UNLU_1.id, 'aaaa-1111', UNLU_1.ad, ...UNLU_1.k])

    o = adim(o, { t: 'tahmin', metin: 'kemal sunal' })
    for (const h of [{ t: 'sonraki' }, { t: 'pas' }, { t: 'pas' }, { t: 'pas' }, { t: 'pas' }, { t: 'sonraki' }] as GunlukHamle[]) o = adim(o, h)
    g = gorunumOlustur(o, SET, SECENEK)
    expect(g.turlar[2]).toMatchObject({ durum: 'kazandi', cevap: { ad: 'Kemal Sunal' }, medya: { gorsel: expect.stringContaining('n=5') } })
    const kapak = g.turlar[4]!
    expect(kapak).toMatchObject({ oyun: 'kapak', adim: 1, cevap: null, medya: { gorsel: '/api/gunluk/gorsel?t=4&a=0&n=1&i=imza' } })
    sizintiYok(JSON.stringify(kapak), [KAPAK_1.id, KAPAK_1.al, KAPAK_1.a, KAPAK_1.sid, 'mzstatic', ...KAPAK_1.k])
  })

  it('bitmiş turda cevap ve puan', () => {
    let o = adim(yeniOturum(), { t: 'sonraki' })
    o = adim(o, { t: 'tahmin', metin: 'şımarık' })
    const g = gorunumOlustur(o, SET, SECENEK)
    expect(g.turlar[0]).toMatchObject({
      durum: 'kazandi',
      cevap: { t: 'Şımarık', a: 'Tarkan', y: 1999, ar: SARKI_1.ar, u: SARKI_1.u },
      sonuc: { adimIndeksi: 0, puan: expect.any(Number) },
    })
    expect(g).toMatchObject({ durum: 'oynaniyor', puan: null, sonTeslim: 99, sirali: true })
  })
})
