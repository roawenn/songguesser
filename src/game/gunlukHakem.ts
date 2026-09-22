import { kapakSatiri, type Kapak } from '@/data/kapak'
import { sarkiSatiri, type Song } from '@/data/schema'
import { unluSatiri, type Unlu } from '@/data/unlu'
import { havuzGerekli, judgeGuess, type Tahminlenebilir } from '@/text/match'
import { ogeCevabi, type GunlukOge, type GunlukOyun } from './gunluk'
import { HAVUZ_GEREKLI, type Hakem, type HakemHukmu } from './gunlukHamle'

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
  /**
   * ⚠️ TEMBEL. Eskiden `new Map(liste.map(…))` ile eager kuruluyordu: `sarki`
   * turunda 15 binden fazla elemanlı bir ara dizi ve o kadar girdilik bir Map,
   * HER istekte. Oysa `tahmin` yolu bu indeksi hiç kullanmıyor, yalnızca
   * `secim` kullanıyor — her tahminde ödenen ölü işti.
   */
  kimlikle: () => Map<string, Tahminlenebilir>
  satir: (o: Tahminlenebilir) => { ust: string; alt?: string }
}

/** Kolay arama AÇIK sabit — gerekçe dosya başında. */
const MOD = { easySearch: true }

/**
 * Hakemi kurar.
 *
 * ⚠️ `havuzlar` `null` OLABİLİR: o zaman hakem yalnızca havuz gerektirmeyen
 * kararları verir (tam doğru, alakasız yanlış, boş) ve gerisi için
 * `havuz-gerekli` sinyali döner. Günlük modda tahmin yolunun varsayılanı bu —
 * havuz ancak sinyal gelince yükleniyor (bkz. `api/gunluk/hamle`).
 */
export function hakemKur(havuzlar: HakemHavuzlari | null, rand: () => number = Math.random): Hakem {
  const onbellek = new Map<GunlukOyun, OyunHavuzu>()

  const havuz = (oyun: GunlukOyun): OyunHavuzu | null => {
    if (!havuzlar) return null
    const hazir = onbellek.get(oyun)
    if (hazir) return hazir
    const [liste, satir]: [readonly Tahminlenebilir[], OyunHavuzu['satir']] =
      oyun === 'sarki' ? [havuzlar.sarkilar, (o) => sarkiSatiri(o as Song)]
      : oyun === 'unlu' ? [havuzlar.unluler, (o) => unluSatiri(o as Unlu)]
      : [havuzlar.kapaklar, (o) => kapakSatiri(o as Kapak)]
    let indeks: Map<string, Tahminlenebilir> | null = null
    const h: OyunHavuzu = {
      liste,
      satir,
      kimlikle: () => (indeks ??= new Map(liste.map((o) => [o.id, o]))),
    }
    onbellek.set(oyun, h)
    return h
  }

  return {
    tahmin(metin: string, oge: GunlukOge): HakemHukmu {
      const cevap = ogeCevabi(oge)
      const h = havuz(oge.oyun)

      /*
       * Havuzsuz hakem: karar havuza muhtaçsa çağırana haber ver. Değilse BOŞ
       * havuzla değerlendir — `havuzGerekli` false iken `judgeGuess`'in havuz
       * tarayan kademesine hiç girilmiyor, sonuç tam havuzlu çağrıyla birebir
       * aynı (bu denklik `text/__tests__/match.test.ts`'te kilitli).
       */
      if (!h) {
        if (havuzGerekli(metin, cevap, MOD)) return { kind: 'havuz-gerekli' }
        const bos = judgeGuess(metin, cevap, [], MOD, rand)
        return bos.kind === 'empty' ? { kind: 'empty' }
          : bos.kind === 'correct' ? { kind: 'correct' }
          : bos.kind === 'wrong' ? { kind: 'wrong', sameArtist: bos.sameArtist }
          // Boş havuzda belirsizlik doğamaz; yine de tip güvenliği için.
          : { kind: 'havuz-gerekli' }
      }

      const v = judgeGuess(metin, cevap, h.liste, MOD, rand)
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
      // Seçim kimlik indeksine gerçekten muhtaç: havuz yoksa yüklenmeli.
      if (!h) return HAVUZ_GEREKLI
      const secilen = h.kimlikle().get(id)
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
