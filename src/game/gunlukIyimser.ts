import { ATTEMPTS } from './ladder'
import { IPUCU_SAYISI, type Step } from './machine'
import type { GunlukGorunum, GunlukTurGorunum } from './gunlukGorunum'

/**
 * İYİMSER GÖRÜNÜM: sunucu yanıtı beklenirken ekranda hemen uygulanabilen hamleler.
 *
 * Hamle sunucuda yargılanıyor ve yanıt ~200 ms (ölçüldü; ağ uzaksa daha fazla)
 * sürüyor. Bu sürede hiçbir şey değişmiyordu, oyun "takılmış" gibi hissettiriyordu.
 *
 * ⚠️ YALNIZCA SONUCU CEVABA BAĞLI OLMAYAN hamleler: pas ve ipucu. Tahminin
 * doğru mu yanlış mı olduğunu istemci BİLEMEZ (cevap sunucuda), dolayısıyla
 * tahminde iyimserlik yok.
 *
 * ⚠️ TURU BİTİREN hamlede de yok: bitişte cevap açılıyor ve o yalnızca
 * sunucudan gelir. Son adımdaki pas bu yüzden beklenir.
 *
 * ⚠️ ÜNLÜ VE KAPAKTA da yok: orada bir adım açmak yeni bir İMZALI görsel
 * adresi gerektiriyor (bkz. `api/gunluk/gorsel`); adres sunucudan gelmeden
 * ekranda değişen tek şey sayaçlar olurdu — yanıltıcı olurdu.
 *
 * Sunucu yanıtı gelince görünüm zaten onunla değiştiriliyor; iyimser hâl
 * yanlışsa (sunucu reddetti) kendiliğinden düzelir.
 */

const IPUCU_YER_TUTUCU = '…'

function sonTur(g: GunlukGorunum): { tur: GunlukTurGorunum; index: number } | null {
  if (g.durum !== 'oynaniyor') return null
  const index = g.turlar.length - 1
  const tur = g.turlar[index]
  return tur && tur.durum === 'oynaniyor' ? { tur, index } : null
}

function yeniGorunum(g: GunlukGorunum, index: number, tur: GunlukTurGorunum): GunlukGorunum {
  return { ...g, turlar: g.turlar.map((t, i) => (i === index ? tur : t)) }
}

export function iyimserPas(g: GunlukGorunum): GunlukGorunum | null {
  const son = sonTur(g)
  if (!son || son.tur.oyun !== 'sarki') return null
  const { tur, index } = son
  // Son kademedeki pas turu bitirir → cevap sunucudan gelmeli.
  if (tur.attempt + 1 >= ATTEMPTS) return null
  const steps: Step[] = [...tur.steps, { kind: 'skip', text: '', sameArtist: false }]
  return yeniGorunum(g, index, { ...tur, attempt: tur.attempt + 1, steps, sira: tur.sira + 1 })
}

export function iyimserIpucu(g: GunlukGorunum): GunlukGorunum | null {
  const son = sonTur(g)
  if (!son || son.tur.oyun !== 'sarki') return null
  const { tur, index } = son
  if (tur.ipuclari.length >= IPUCU_SAYISI || tur.attempt + 1 >= ATTEMPTS) return null
  const steps: Step[] = [...tur.steps, { kind: 'hint', text: '', sameArtist: false }]
  return yeniGorunum(g, index, {
    ...tur,
    attempt: tur.attempt + 1,
    steps,
    sira: tur.sira + 1,
    // İpucunun METNİ sunucudan gelir; yerine kısa bir bekleme işareti.
    ipuclari: [...tur.ipuclari, IPUCU_YER_TUTUCU],
  })
}
