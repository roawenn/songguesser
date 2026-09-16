import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { artworkAt } from '@/data/schema'
import { unluGorselYolu } from '@/data/unlu'
import { gunBaslangici, gunEkle, istanbulGunu, type Gun } from '@/game/gun'
import {
  GUNLUK_TUR, ogeKimligi,
  type GunlukOge, type GunlukOturum, type GunlukSet, type GunlukSlot, type GunlukTurKaydi,
} from '@/game/gunluk'
import { gorunumOlustur, type GunlukGorunum } from '@/game/gunlukGorunum'
import { hakemKur, type HakemHavuzlari } from '@/game/gunlukHakem'
import type { Hakem } from '@/game/gunlukHamle'
import { gunlukSec } from '@/game/gunlukSec'
import { tohumluRastgele } from '@/game/rastgele'
import { loadSongsByIds } from '@/lib/duelSongs'
import { havuzSatirlari } from '@/lib/havuzSunucu'
import { grupla } from '@/lib/kapakHavuz'
import { kapakSatirlari } from '@/lib/kapakHavuzSunucu'
import { storagePublicUrl, UNLU_KOVA } from '@/lib/storage'
import { restHeaders, restUrl } from '@/lib/supabase'
import { unluSatirlari } from '@/lib/unluHavuzSunucu'

/**
 * Günlük modun sunucu katmanı: set, oturum, hakem, imzalar.
 *
 * Kurallar saf modüllerde (`game/gunluk*`); burada yalnızca veritabanı,
 * havuzlar ve saat var. Tablolar RLS'li ve politikasız — her okuma/yazma
 * gizli anahtarla buradan geçer.
 */

const GIZLI = process.env.SUPABASE_SECRET_KEY ?? 'tahmin.net'

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

// --- saat ---------------------------------------------------------------

/**
 * Sunucu saati.
 *
 * ⚠️ `GUNLUK_SIMDI` YALNIZCA GELİŞTİRMEDE okunur (gece yarısı ve son teslim
 * denemesi için). Üretimde okunsaydı yanlış bir ortam değişkeni herkesin
 * gününü kaydırırdı.
 */
export function gunlukSimdi(): number {
  if (process.env.NODE_ENV !== 'production' && process.env.GUNLUK_SIMDI) {
    const t = Date.parse(process.env.GUNLUK_SIMDI)
    if (Number.isFinite(t)) return t
  }
  return Date.now()
}

/**
 * Sıralamaya sayılan en geç bitiş: ertesi gün 03:00 (İstanbul).
 *
 * 23:58'de başlayan oyuncu gece yarısında kesilmesin. Arşiv o gün için ancak
 * bu andan sonra açılır — yoksa arşivden cevaba bakıp sıralamalı oturumu
 * bitirmek mümkün olurdu.
 */
export const SON_TESLIM_PAYI_MS = 3 * 3600_000

export function sonTeslimAni(gun: Gun): number {
  return gunBaslangici(gunEkle(gun, 1)).getTime() + SON_TESLIM_PAYI_MS
}

// --- cihaz --------------------------------------------------------------

const CIHAZ_DESENI = /^[0-9a-f]{64}$/

export function yeniCihazGizlisi(): string {
  return randomBytes(32).toString('hex')
}

/** Başlıktaki gizlinin özeti; biçim yanlışsa null. Ham gizli SAKLANMAZ. */
export function cihazOzeti(gizli: string | null | undefined): string | null {
  if (!gizli || !CIHAZ_DESENI.test(gizli)) return null
  return createHash('sha256').update(gizli).digest('hex')
}

// --- görsel imzası ------------------------------------------------------

const IMZA_ANAHTARI = createHash('sha256').update(`gunluk-gorsel:${GIZLI}`).digest()

function imzaMetni(gun: Gun, tur: number, aday: number, adim: number): string {
  return `${gun}:${tur}:${aday}:${adim}`
}

export function gorselImzasi(gun: Gun, tur: number, aday: number, adim: number): string {
  return createHmac('sha256', IMZA_ANAHTARI).update(imzaMetni(gun, tur, aday, adim)).digest('hex').slice(0, 32)
}

export function gorselImzaDogru(gun: Gun, tur: number, aday: number, adim: number, imza: string): boolean {
  const beklenen = Buffer.from(gorselImzasi(gun, tur, aday, adim))
  const gelen = Buffer.from(imza)
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen)
}

/**
 * Görsel adresi — adım imzada. İmza yalnızca oyuncu o adıma ULAŞINCA
 * görünümde üretildiği için, `n=5` elle yazılsa imza tutmaz.
 */
export function gorselAdresi(gun: Gun, tur: number, aday: number, adim: number): string {
  const q = new URLSearchParams({
    g: gun, t: String(tur), a: String(aday), n: String(adim), i: gorselImzasi(gun, tur, aday, adim),
  })
  return `/api/gunluk/gorsel?${q}`
}

// --- medya --------------------------------------------------------------

/** Öğenin tarayıcıya (ya da vekile) inecek asıl medya adresi. */
export function ogeMedyaAdresi(oge: GunlukOge): string {
  switch (oge.oyun) {
    case 'sarki':
      return oge.sarki.p ?? ''
    case 'kapak':
      return artworkAt(oge.ar, 600)
    case 'unlu':
      return storagePublicUrl(UNLU_KOVA, unluGorselYolu(oge.unlu))
  }
}

/**
 * Medya yerinde mi?
 *
 * ⚠️ YALNIZCA KESİN RET ölü sayılır (404/403/410). Zaman aşımı ya da ağ
 * hatası "bilinmiyor"dur ve canlı kabul edilir: Apple bir an yavaşladığında
 * bütün seti ölü sayıp günü kuramamak, tek bir bozuk şarkıdan çok daha kötü.
 */
export async function medyaCanli(oge: GunlukOge): Promise<boolean> {
  const url = ogeMedyaAdresi(oge)
  if (!url) return false
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) })
    return ![403, 404, 410].includes(res.status)
  } catch {
    return true
  }
}

// --- havuzlar ve hakem --------------------------------------------------

const HAVUZ_TTL_MS = 10 * 60_000
let havuzBellek: { zaman: number; deger: Promise<HakemHavuzlari> } | null = null

/**
 * Yargılama ve seçim için üç havuz.
 *
 * ⚠️ Şarkı havuzu `havuzSatirlari`nın kendi önbelleğinden geliyor; kapak
 * gruplaması 15 bin satırı dolaştığı için sonucu burada tutuluyor.
 */
async function havuzlar(): Promise<HakemHavuzlari> {
  const simdi = Date.now()
  if (havuzBellek && simdi - havuzBellek.zaman < HAVUZ_TTL_MS) return havuzBellek.deger
  const deger = Promise.all([
    havuzSatirlari('karisik'),
    unluSatirlari('unlu-karisik'),
    kapakSatirlari('karisik'),
  ]).then(([s, unluler, k]) => ({ sarkilar: s.songs, unluler, kapaklar: grupla(k) }))
  havuzBellek = { zaman: simdi, deger }
  deger.catch(() => {
    if (havuzBellek?.deger === deger) havuzBellek = null
  })
  return deger
}

export async function hakemGetir(): Promise<Hakem> {
  return hakemKur(await havuzlar())
}

// --- set ----------------------------------------------------------------

interface SetSatiri {
  gun: string
  surum: number
  turlar: GunlukSlot[]
}

const SET_TTL_MS = 60_000
const setBellek = new Map<Gun, { zaman: number; set: GunlukSet }>()

function setBellegeYaz(set: GunlukSet) {
  setBellek.set(set.gun, { zaman: Date.now(), set })
  // Bellek günlerce açık kalan örnekte büyümesin.
  if (setBellek.size > 8) setBellek.delete(setBellek.keys().next().value!)
}

async function setOku(gun: Gun): Promise<GunlukSet | null> {
  const res = await rest(`gunluk?gun=eq.${gun}&select=gun,surum,turlar`)
  if (!res.ok) throw new Error(`gunluk ${res.status}`)
  const [satir] = (await res.json()) as SetSatiri[]
  if (!satir) return null
  const set = { gun: satir.gun, surum: satir.surum, slotlar: satir.turlar }
  setBellegeYaz(set)
  return set
}

/** Tekrar önleme: son 90 günün öğeleri. */
async function yakinIdler(gun: Gun): Promise<Set<string>> {
  const res = await rest(`gunluk?gun=gte.${gunEkle(gun, -90)}&gun=lt.${gun}&select=oge_idleri`)
  if (!res.ok) return new Set()
  const satirlar = (await res.json()) as { oge_idleri: string[] }[]
  return new Set(satirlar.flatMap((s) => s.oge_idleri))
}

const TOHUM_TUZU = createHash('sha256').update(`gunluk-tohum:${GIZLI}`).digest('hex')
const KURULUM_DENEMESI = 3

/**
 * Seti seçer, medya ve oynanabilirlik alanlarıyla doldurur, ölüleri eler.
 *
 * ⚠️ Toplu havuzda URL alanları YOK (`POOL_COLUMNS`); şarkı ve kapak
 * adayları kimlikle yeniden okunuyor. Ölü medya bulunursa o öğe dışarıda
 * bırakılıp seçim aynı tohumla yeniden yapılıyor.
 */
async function setKur(gun: Gun): Promise<GunlukSet | null> {
  const [h, yakin] = await Promise.all([havuzlar(), yakinIdler(gun)])
  const rand = tohumluRastgele(`${gun}:${TOHUM_TUZU}`)
  const olu = new Set<string>()

  for (let deneme = 0; deneme < KURULUM_DENEMESI; deneme++) {
    const secim = gunlukSec(h, new Set([...yakin, ...olu]), rand)
    if (!secim) return null

    const sarkiIdleri = secim.flatMap((s) => s.adaylar.flatMap((a) => (a.oyun === 'sarki' ? [a.oge.id] : [])))
    const kapakSidleri = secim.flatMap((s) => s.adaylar.flatMap((a) => (a.oyun === 'kapak' ? [a.oge.sid] : [])))
    const tam = new Map((await loadSongsByIds([...sarkiIdleri, ...kapakSidleri])).map((s) => [s.id, s]))

    const slotlar: GunlukSlot[] = secim.map((s) => ({
      oyun: s.oyun,
      zorluk: s.zorluk,
      aktif: 0,
      adaylar: s.adaylar.flatMap((a): GunlukOge[] => {
        if (a.oyun === 'unlu') return [{ oyun: 'unlu', unlu: a.oge }]
        if (a.oyun === 'sarki') {
          const s = tam.get(a.oge.id)
          return s?.p && s.off !== 1 ? [{ oyun: 'sarki', sarki: s }] : []
        }
        const temsilci = tam.get(a.oge.sid)
        return temsilci?.ar ? [{ oyun: 'kapak', kapak: a.oge, ar: temsilci.ar, u: temsilci.u ?? '' }] : []
      }),
    }))

    const denetim = await Promise.all(
      slotlar.flatMap((s) => s.adaylar.map(async (o) => [ogeKimligi(o), await medyaCanli(o)] as const)),
    )
    for (const [id, canli] of denetim) if (!canli) olu.add(id)
    // Doldurulamayan adaylar da (kapatılmış, önizlemesiz) bir sonraki seçimde dışarıda.
    for (const s of secim) for (const a of s.adaylar) {
      if (!slotlar.some((sl) => sl.adaylar.some((o) => ogeKimligi(o) === a.oge.id))) olu.add(a.oge.id)
    }

    const temiz = slotlar.map((s) => ({ ...s, adaylar: s.adaylar.filter((o) => !olu.has(ogeKimligi(o))) }))
    if (temiz.length === GUNLUK_TUR && temiz.every((s) => s.adaylar.length > 0)) {
      return { gun, surum: 0, slotlar: temiz }
    }
  }
  return null
}

/**
 * Günün setini getirir; yoksa ve `olustur` ise kurar.
 *
 * ⚠️ Yalnızca BUGÜN kurulabilir — geçmiş bir gün istenip set yoksa kurmak,
 * bugünün havuzuyla sahte bir "arşiv" üretmek olurdu.
 */
export async function gunlukSetiGetir(gun: Gun, secenek: { olustur: boolean }): Promise<GunlukSet | null> {
  const bellek = setBellek.get(gun)
  if (bellek && Date.now() - bellek.zaman < SET_TTL_MS) return bellek.set

  const var_ = await setOku(gun)
  if (var_ || !secenek.olustur || gun !== istanbulGunu(new Date(gunlukSimdi()))) return var_

  const kurulan = await setKur(gun)
  if (!kurulan) return null

  // İki örnek aynı anda kurduysa ilk yazan kazanır; herkes yazılanı okur.
  const res = await rest('gunluk', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      gun,
      turlar: kurulan.slotlar,
      oge_idleri: kurulan.slotlar.flatMap((s) => s.adaylar.map(ogeKimligi)),
    }),
  })
  if (!res.ok) throw new Error(`gunluk yazılamadı ${res.status}`)
  return setOku(gun)
}

/**
 * Slotun aktif adayını ilerletir (ölü medya) — surum ile CAS.
 *
 * Başka bir örnek araya girdiyse yeniden okunmuş set döner; ilerletme zaten
 * yapılmış olabilir.
 */
export async function setAdayIlerlet(set: GunlukSet, slot: number, aday: number): Promise<GunlukSet> {
  const slotlar = set.slotlar.map((s, i) => (i === slot && s.aktif < aday ? { ...s, aktif: aday } : s))
  const res = await rest(`gunluk?gun=eq.${set.gun}&surum=eq.${set.surum}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal,count=exact' },
    body: JSON.stringify({ turlar: slotlar, surum: set.surum + 1 }),
  })
  if (res.ok && etkilenen(res) === 1) {
    const yeni = { ...set, surum: set.surum + 1, slotlar }
    setBellegeYaz(yeni)
    return yeni
  }
  return (await setOku(set.gun)) ?? set
}

// --- oturum -------------------------------------------------------------

interface OturumSatiri {
  id: string
  gun: string
  cihaz_ozet: string
  kullanici_id: string | null
  sirali: boolean
  bitti: string | null
  zaman_asimi: boolean
  turlar: GunlukTurKaydi[]
  puan: number | null
  surum: number
  yedek_kullanildi: boolean
}

const OTURUM_KOLONLARI =
  'id,gun,cihaz_ozet,kullanici_id,sirali,bitti,zaman_asimi,turlar,puan,surum,yedek_kullanildi'

export interface OturumKaydi {
  oturum: GunlukOturum
  cihazOzet: string
  kullaniciId: string | null
}

function satirdan(r: OturumSatiri): OturumKaydi {
  return {
    cihazOzet: r.cihaz_ozet,
    kullaniciId: r.kullanici_id,
    oturum: {
      id: r.id,
      gun: r.gun,
      sirali: r.sirali,
      bitti: r.bitti ? Date.parse(r.bitti) : null,
      zamanAsimi: r.zaman_asimi,
      turlar: r.turlar ?? [],
      puan: r.puan,
      surum: r.surum,
      yedekKullanildi: r.yedek_kullanildi,
    },
  }
}

// PATCH'in kaç satıra dokunduğu: `Content-Range` paydası ("0-0/1" ya da yıldız/1).
function etkilenen(res: Response): number {
  const n = Number(res.headers.get('content-range')?.split('/')[1])
  return Number.isFinite(n) ? n : 0
}

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function oturumKimligiGecerli(s: unknown): s is string {
  return typeof s === 'string' && UUID_DESENI.test(s)
}

export async function oturumGetir(id: string): Promise<OturumKaydi | null> {
  if (!oturumKimligiGecerli(id)) return null
  const res = await rest(`gunluk_oturum?id=eq.${id}&select=${OTURUM_KOLONLARI}`)
  if (!res.ok) throw new Error(`gunluk_oturum ${res.status}`)
  const [satir] = (await res.json()) as OturumSatiri[]
  return satir ? satirdan(satir) : null
}

/** Cihazın verilen günlerdeki girişsiz, sıralamalı oturumları. */
export async function cihazOturumlari(gunler: Gun[], cihazOzet: string): Promise<GunlukOturum[]> {
  const q = new URLSearchParams({
    select: OTURUM_KOLONLARI,
    cihaz_ozet: `eq.${cihazOzet}`,
    gun: `in.(${gunler.join(',')})`,
    sirali: 'eq.true',
    kullanici_id: 'is.null',
  })
  const res = await rest(`gunluk_oturum?${q}`)
  if (!res.ok) throw new Error(`gunluk_oturum ${res.status}`)
  return ((await res.json()) as OturumSatiri[]).map((r) => satirdan(r).oturum)
}

export async function oturumAc(g: {
  gun: Gun
  cihazOzet: string
  kullaniciId: string | null
  sirali: boolean
  ipOzet: string | null
}): Promise<GunlukOturum | null> {
  const res = await rest('rpc/gunluk_oturum_ac', {
    method: 'POST',
    body: JSON.stringify({
      p_gun: g.gun,
      p_cihaz_ozet: g.cihazOzet,
      p_kullanici: g.kullaniciId,
      p_sirali: g.sirali,
      p_ip_ozet: g.ipOzet,
    }),
  })
  if (!res.ok) throw new Error(`gunluk_oturum_ac ${res.status}`)
  const [satir] = (await res.json()) as OturumSatiri[]
  return satir ? satirdan(satir).oturum : null
}

/**
 * Oturumu yazar — `surum` ile CAS. Bitmişse atomik bitirme RPC'si.
 *
 * `false` → araya başka bir yazma girdi; çağıran yeniden okuyup denemeli.
 */
export async function oturumYaz(eski: GunlukOturum, yeni: GunlukOturum): Promise<boolean> {
  if (yeni.bitti !== null) {
    const res = await rest('rpc/gunluk_bitir', {
      method: 'POST',
      body: JSON.stringify({
        p_oturum: eski.id,
        p_surum: eski.surum,
        p_turlar: yeni.turlar,
        p_puan: yeni.puan ?? 0,
        p_zaman_asimi: yeni.zamanAsimi,
      }),
    })
    if (!res.ok) throw new Error(`gunluk_bitir ${res.status}`)
    return (await res.json()) === true
  }

  const res = await rest(`gunluk_oturum?id=eq.${eski.id}&surum=eq.${eski.surum}&bitti=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal,count=exact' },
    body: JSON.stringify({
      turlar: yeni.turlar,
      surum: eski.surum + 1,
      yedek_kullanildi: yeni.yedekKullanildi,
    }),
  })
  if (!res.ok) throw new Error(`gunluk_oturum yazılamadı ${res.status}`)
  return etkilenen(res) === 1
}

export function gorunum(oturum: GunlukOturum, set: GunlukSet): GunlukGorunum {
  return gorunumOlustur(oturum, set, {
    sonTeslim: sonTeslimAni(oturum.gun),
    gorselAdresi: (tur, aday, adim) => gorselAdresi(set.gun, tur, aday, adim),
  })
}

// --- dağılım ------------------------------------------------------------

export async function dagilimOku(gun: Gun): Promise<[number, number][]> {
  const res = await rest(`gunluk_dagilim?gun=eq.${gun}&select=puan,adet&order=puan.asc`)
  if (!res.ok) throw new Error(`gunluk_dagilim ${res.status}`)
  return ((await res.json()) as { puan: number; adet: number }[]).map((r) => [r.puan, r.adet])
}

/** Seyrek temizlik — düello kurulumundaki desen. */
export function belkiTemizle() {
  if (Math.random() < 1 / 200) void rest('rpc/temizle', { method: 'POST', body: '{}' }).catch(() => {})
}
