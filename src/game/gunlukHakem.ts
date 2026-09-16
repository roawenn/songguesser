import { kapakSatiri, type Kapak } from '@/data/kapak'
import { sarkiSatiri, type Song } from '@/data/schema'
import { unluSatiri, type Unlu } from '@/data/unlu'
import { judgeGuess, type Tahminlenebilir } from '@/text/match'
import { ogeCevabi, type GunlukOge, type GunlukOyun } from './gunluk'
import type { Hakem, HakemHukmu } from './gunlukHamle'

/**
 * Günlüğün hakemi — normal oyunun `judgeGuess`'i, sunucudaki havuzla.
 *
 * ⚠️ Kolay arama AÇIK sabit (ayarların varsayılanı). Oyuncunun kendi ayarına
 * bırakılsaydı aynı günün sıralamasında iki farklı kabul eşiği olurdu.
 *
 * ⚠️ Belirsizlik adayları KİMLİKLE dönüyor ama cevabı ele vermiyor: adaylar
 * zaten adlarıyla gösteriliyor ve cevap listede her zaman diğerleriyle
 * karışık (bkz. `judgeGuess` → önce kırp, sonra karıştır).
 */

export interface HakemHavuzlari {
  sarkilar: readonly Song[]
  unluler: readonly Unlu[]
  kapaklar: readonly Kapak[]
}

interface OyunHavuzu {
  liste: readonly Tahminlenebilir[]
  kimlikle: Map<string, Tahminlenebilir>
  satir: (o: Tahminlenebilir) => { ust: string; alt?: string }
}

export function hakemKur(havuzlar: HakemHavuzlari, rand: () => number = Math.random): Hakem {
  const onbellek = new Map<GunlukOyun, OyunHavuzu>()

  const havuz = (oyun: GunlukOyun): OyunHavuzu => {
    const hazir = onbellek.get(oyun)
    if (hazir) return hazir
    const [liste, satir]: [readonly Tahminlenebilir[], OyunHavuzu['satir']] =
      oyun === 'sarki' ? [havuzlar.sarkilar, (o) => sarkiSatiri(o as Song)]
      : oyun === 'unlu' ? [havuzlar.unluler, (o) => unluSatiri(o as Unlu)]
      : [havuzlar.kapaklar, (o) => kapakSatiri(o as Kapak)]
    const h = { liste, satir, kimlikle: new Map(liste.map((o) => [o.id, o])) }
    onbellek.set(oyun, h)
    return h
  }

  return {
    tahmin(metin: string, oge: GunlukOge): HakemHukmu {
      const cevap = ogeCevabi(oge)
      const h = havuz(oge.oyun)
      const v = judgeGuess(metin, cevap, h.liste, { easySearch: true }, rand)
      switch (v.kind) {
        case 'empty':
          return { kind: 'empty' }
        case 'correct':
          return { kind: 'correct' }
        case 'wrong':
          return { kind: 'wrong', sameArtist: v.sameArtist }
        case 'ambiguous': {
          // Cevap anlık görüntüden geliyor, havuzdaki kopyası değil: satırı da oradan yaz.
          const satir = (o: Tahminlenebilir) => (o.id === cevap.id ? satirOge(oge) : h.satir(o))
          return { kind: 'ambiguous', adaylar: v.candidates.map((o) => ({ id: o.id, ...satir(o) })) }
        }
      }
    },

    secim(id: string, oge: GunlukOge) {
      const cevap = ogeCevabi(oge)
      if (id === cevap.id) return { dogru: true }
      const h = havuz(oge.oyun)
      const secilen = h.kimlikle.get(id)
      if (!secilen) return null
      return {
        dogru: false,
        metin: h.satir(secilen).ust,
        // Ünlüde `nA` boş — boş ad hiçbir zaman "sanatçı doğru" sayılmaz.
        sameArtist: cevap.nA.length > 0 && secilen.nA === cevap.nA,
      }
    },
  }
}

function satirOge(oge: GunlukOge): { ust: string; alt?: string } {
  if (oge.oyun === 'sarki') return sarkiSatiri(oge.sarki)
  if (oge.oyun === 'unlu') return unluSatiri(oge.unlu)
  return kapakSatiri(oge.kapak)
}
