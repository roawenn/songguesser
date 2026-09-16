import {
  EN_UZUN_TAHMIN, GUNLUK_TUR, turOgesi,
  type GunlukOge, type GunlukOlay, type GunlukOturum, type GunlukSet, type GunlukTurKaydi,
} from './gunluk'
import { adimIndeksi, olayGecerli, olayUygula, turBitisi, turDurumu } from './gunlukKural'
import { hazirKirp, turPuani, turSuresi } from './gunlukPuan'

/**
 * Günlük hamlenin işlenmesi — saf çekirdek. Ağ, veritabanı ve havuz yok;
 * yargılama `Hakem` ile dışarıdan geliyor, saat `simdi` ile.
 *
 * İDEMPOTENTLİK: istemci her hamlede turu (`tur`) ve o turda gördüğü olay
 * sayısını (`sira`) gönderir.
 *   · Geçmiş tur ya da `sira` geride → `degismedi`: tekrar denenen istek
 *     (ağ koptu, düğmeye iki kez basıldı, ikinci sekme) mevcut görünümü alır,
 *     ikinci kez uygulanmaz.
 *   · `sira` ileride → 409: istemci durumu kaçırmış, görünümü tazelemeli.
 */

export type GunlukHamle =
  | { t: 'tahmin'; metin: string }
  /** Belirsizlik listesinden seçim. */
  | { t: 'sec'; id: string }
  | { t: 'pas' }
  | { t: 'ipucu' }
  /** Sıradaki turun medyasını iste — hız saati burada başlar. */
  | { t: 'sonraki' }

export interface HamleIstegi {
  tur: number
  sira: number
  hamle: GunlukHamle
  /** İstemcinin ölçtüğü hazırlanma süresi — yalnızca turun ilk olayında okunur. */
  hazirMs?: number | null
}

export interface BelirsizAday {
  id: string
  ust: string
  alt?: string
}

export type HakemHukmu =
  | { kind: 'empty' }
  | { kind: 'correct' }
  | { kind: 'wrong'; sameArtist: boolean }
  | { kind: 'ambiguous'; adaylar: BelirsizAday[] }

export interface Hakem {
  tahmin(metin: string, oge: GunlukOge): HakemHukmu
  /** `null` → id havuzda yok (uydurma istek). */
  secim(id: string, oge: GunlukOge): { dogru: true } | { dogru: false; metin: string; sameArtist: boolean } | null
}

export type GeriBildirim =
  | { kind: 'dogru' }
  | { kind: 'yanlis'; sameArtist: boolean }
  | { kind: 'pas' }
  | { kind: 'ipucu' }
  | { kind: 'sonraki' }

export type HamleSonucu =
  | { tur: 'uygulandi'; oturum: GunlukOturum; geri: GeriBildirim }
  /** Hak yakmaz, yazma yok. */
  | { tur: 'belirsiz'; adaylar: BelirsizAday[] }
  | { tur: 'bos' }
  | { tur: 'degismedi' }
  /** Son teslim geçti — oturum kapatılmalı, sıralamaya girmez. */
  | { tur: 'zaman-asimi'; oturum: GunlukOturum }
  | { tur: 'hata'; kod: 400 | 409; mesaj: string }

export function oturumPuani(turlar: readonly GunlukTurKaydi[]): number {
  return turlar.reduce((t, k) => t + (k.sonuc?.puan ?? 0), 0)
}

function hata(kod: 400 | 409, mesaj: string): HamleSonucu {
  return { tur: 'hata', kod, mesaj }
}

/** Hamleden önce ortak denetim: oturum açık mı, son teslim geçti mi? */
function oturumAcik(oturum: GunlukOturum, simdi: number, sonTeslim: number): HamleSonucu | null {
  if (oturum.bitti !== null) return { tur: 'degismedi' }
  // ⚠️ Arşiv oturumunun son teslimi yok — sıralamaya zaten girmiyor.
  if (oturum.sirali && simdi > sonTeslim) {
    return {
      tur: 'zaman-asimi',
      oturum: { ...oturum, bitti: simdi, zamanAsimi: true, puan: oturumPuani(oturum.turlar) },
    }
  }
  return null
}

export function hamleUygula(
  oturum: GunlukOturum,
  set: GunlukSet,
  istek: HamleIstegi,
  simdi: number,
  hakem: Hakem,
  sonTeslim: number,
): HamleSonucu {
  const kapali = oturumAcik(oturum, simdi, sonTeslim)
  if (kapali) return kapali

  const n = oturum.turlar.length
  const { hamle } = istek

  if (hamle.t === 'sonraki') {
    if (istek.tur < n) return { tur: 'degismedi' }
    if (istek.tur > n || n >= GUNLUK_TUR) return hata(409, 'Bu tur henüz açılamaz.')
    if (n > 0 && oturum.turlar[n - 1]!.sonuc === null) return hata(409, 'Önceki tur sürüyor.')
    const slot = set.slotlar[n]
    if (!slot) return hata(409, 'Tur bulunamadı.')
    const kayit: GunlukTurKaydi = {
      aday: slot.aktif,
      medyaVerildi: simdi,
      hazirMs: null,
      olaylar: [],
      sonuc: null,
    }
    return {
      tur: 'uygulandi',
      oturum: { ...oturum, turlar: [...oturum.turlar, kayit] },
      geri: { kind: 'sonraki' },
    }
  }

  const i = istek.tur
  if (i < n - 1) return { tur: 'degismedi' }
  if (i !== n - 1) return hata(409, 'Tur henüz başlamadı.')

  const kayit = oturum.turlar[i]!
  if (istek.sira < kayit.olaylar.length) return { tur: 'degismedi' }
  if (istek.sira > kayit.olaylar.length) return hata(409, 'Durum eskimiş.')
  if (kayit.sonuc) return hata(409, 'Tur bitti.')

  const oge = turOgesi(set, i, kayit)
  if (!oge) return hata(409, 'Tur bulunamadı.')

  const durum = turDurumu(oge, kayit.olaylar)
  const z = Math.max(0, simdi - kayit.medyaVerildi)

  let olay: GunlukOlay
  let geri: GeriBildirim
  switch (hamle.t) {
    case 'tahmin': {
      const metin = hamle.metin.trim().slice(0, EN_UZUN_TAHMIN)
      if (!metin) return { tur: 'bos' }
      const h = hakem.tahmin(metin, oge)
      if (h.kind === 'empty') return { tur: 'bos' }
      if (h.kind === 'ambiguous') return { tur: 'belirsiz', adaylar: h.adaylar }
      if (h.kind === 'correct') {
        olay = { t: 'D', z }
        geri = { kind: 'dogru' }
      } else {
        olay = { t: 'Y', m: metin, sa: h.sameArtist, z }
        geri = { kind: 'yanlis', sameArtist: h.sameArtist }
      }
      break
    }
    case 'sec': {
      const r = hakem.secim(hamle.id, oge)
      if (!r) return hata(400, 'Geçersiz seçim.')
      if (r.dogru) {
        olay = { t: 'D', z }
        geri = { kind: 'dogru' }
      } else {
        olay = { t: 'Y', m: r.metin.slice(0, EN_UZUN_TAHMIN), sa: r.sameArtist, z }
        geri = { kind: 'yanlis', sameArtist: r.sameArtist }
      }
      break
    }
    case 'pas':
      olay = { t: 'P', z }
      geri = { kind: 'pas' }
      break
    case 'ipucu':
      olay = { t: 'I', z }
      geri = { kind: 'ipucu' }
      break
  }

  // Kural makinesi reddediyorsa (son kademede ipucu, ünlüde ipucu…) geçersiz.
  if (!olayGecerli(durum, olay)) return hata(409, 'Bu hamle şu an yapılamaz.')

  const yeniDurum = olayUygula(durum, olay)
  const hazirMs = kayit.olaylar.length === 0 && kayit.hazirMs === null
    ? hazirKirp(istek.hazirMs)
    : kayit.hazirMs

  let yeniKayit: GunlukTurKaydi = { ...kayit, hazirMs, olaylar: [...kayit.olaylar, olay] }

  const bitis = turBitisi(yeniDurum)
  if (bitis) {
    const kazandi = bitis === 'kazandi'
    const sureMs = turSuresi(kayit.medyaVerildi, hazirMs, simdi)
    const adim = adimIndeksi(yeniDurum)
    const p = turPuani({ kazandi, adimIndeksi: adim, sureMs })
    yeniKayit = {
      ...yeniKayit,
      sonuc: { kazandi, adimIndeksi: adim, sureMs, hizBonusu: p.hizBonusu, puan: p.puan, bitti: simdi },
    }
  }

  const turlar = oturum.turlar.map((k, j) => (j === i ? yeniKayit : k))
  const hepsiBitti = turlar.length === GUNLUK_TUR && turlar.every((k) => k.sonuc !== null)

  return {
    tur: 'uygulandi',
    oturum: {
      ...oturum,
      turlar,
      ...(hepsiBitti ? { bitti: simdi, puan: oturumPuani(turlar) } : {}),
    },
    geri,
  }
}

/**
 * Ölü medya bildirimi geçerli mi?
 *
 * ⚠️ YALNIZCA OLAYSIZ TURDA. Tahmin yapıldıktan sonra takas, kötü giden bir
 * turu bedavaya sıfırlamanın yolu olurdu.
 */
export function oluDenetle(
  oturum: GunlukOturum,
  istek: { tur: number; sira: number },
  simdi: number,
  sonTeslim: number,
): HamleSonucu | null {
  const kapali = oturumAcik(oturum, simdi, sonTeslim)
  if (kapali) return kapali
  const n = oturum.turlar.length
  if (istek.tur !== n - 1) return istek.tur < n - 1 ? { tur: 'degismedi' } : hata(409, 'Tur başlamadı.')
  const kayit = oturum.turlar[n - 1]!
  if (kayit.sonuc || kayit.olaylar.length > 0 || istek.sira !== 0) {
    return hata(409, 'Tur başladıktan sonra değiştirilemez.')
  }
  return null
}

/** Turu başka bir adayla SIFIRDAN başlatır — hız saati de sıfırlanır. */
export function adayaGecir(
  oturum: GunlukOturum,
  turIndex: number,
  aday: number,
  simdi: number,
  dogrulanmamis: boolean,
): GunlukOturum {
  const turlar = oturum.turlar.map((k, j) =>
    j === turIndex ? { aday, medyaVerildi: simdi, hazirMs: null, olaylar: [], sonuc: null } : k,
  )
  return { ...oturum, turlar, yedekKullanildi: oturum.yedekKullanildi || dogrulanmamis }
}
