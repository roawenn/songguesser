import { NextResponse } from 'next/server'
import { EN_UZUN_TAHMIN, GUNLUK_TUR, type GunlukOturum, type GunlukSet } from '@/game/gunluk'
import {
  adayaGecir, hamleUygula, oluDenetle,
  type BelirsizAday, type GeriBildirim, type GunlukHamle, type HamleSonucu,
} from '@/game/gunlukHamle'
import {
  cihazOzeti, gorunum, gunlukSetiGetir, gunlukSimdi, hakemGetir, medyaCanli, oturumGetir,
  oturumKimligiGecerli, oturumYaz, setAdayIlerlet, sonTeslimAni,
} from '@/lib/gunlukSunucu'
import { cokHizli, sinirAsildiAnahtar } from '@/lib/hizSinir'
import { oturumKullanici } from '@/lib/kullaniciAuth'

/**
 * Günlük hamlesi — tahmin, seçim, pas, ipucu, sıradaki tur, ölü medya.
 *
 * Akış: oturumu oku → sahipliği doğrula → saf `hamleUygula` → `surum` ile
 * CAS yaz. Yazma çakışırsa (ikinci sekme) bir kez yeniden okunup denenir;
 * o denemede hamle çoğunlukla `degismedi`ye düşer ve güncel görünüm döner.
 *
 * ⚠️ HIZ SINIRI YALNIZCA "BEDAVA" SONUÇLARDA. Normal bir hamle zaten hak
 * yakıyor ve oturum başına sınırlı; her hamlede ayrıca RPC atmak turu bir
 * gidiş-dönüş yavaşlatırdı. Belirsiz, boş ve reddedilen hamleler ise hak
 * yakmadığı için sonsuz denenebilir — sınır orada.
 */

type Istek = { oturum: string; tur: number; sira: number; hamle: GunlukHamle | { t: 'olu' }; hazirMs?: number }

function istekOku(govde: unknown): Istek | null {
  if (!govde || typeof govde !== 'object') return null
  const g = govde as Record<string, unknown>
  const h = g.hamle as Record<string, unknown> | undefined
  if (!oturumKimligiGecerli(g.oturum)) return null
  const tur = Number(g.tur)
  const sira = Number(g.sira)
  if (!Number.isInteger(tur) || tur < 0 || tur > GUNLUK_TUR) return null
  if (!Number.isInteger(sira) || sira < 0 || sira > 20) return null
  if (!h || typeof h.t !== 'string') return null

  let hamle: Istek['hamle']
  switch (h.t) {
    case 'tahmin':
      if (typeof h.metin !== 'string' || h.metin.length > EN_UZUN_TAHMIN * 4) return null
      hamle = { t: 'tahmin', metin: h.metin }
      break
    case 'sec':
      if (typeof h.id !== 'string' || h.id.length > 80) return null
      hamle = { t: 'sec', id: h.id }
      break
    case 'pas':
    case 'ipucu':
    case 'sonraki':
    case 'olu':
      hamle = { t: h.t }
      break
    default:
      return null
  }
  const hazirMs = typeof g.hazirMs === 'number' ? g.hazirMs : undefined
  return { oturum: g.oturum, tur, sira, hamle, hazirMs }
}

const YANIT_BASLIK = { 'Cache-Control': 'no-store' }

function yanit(
  oturum: GunlukOturum,
  set: GunlukSet,
  ek: { geri?: GeriBildirim; belirsiz?: BelirsizAday[]; cakisma?: boolean; hata?: string },
  status = 200,
) {
  return NextResponse.json({ gorunum: gorunum(oturum, set), ...ek }, { status, headers: YANIT_BASLIK })
}

export async function POST(req: Request) {
  const istek = istekOku(await req.json().catch(() => null))
  if (!istek) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const cihaz = cihazOzeti(req.headers.get('x-gunluk-cihaz'))

  const bosSinir = () =>
    sinirAsildiAnahtar(istek.oturum, { ad: 'gunluk-bos', limit: 60, pencere: '10 minutes', hataVarsaIzin: true })

  try {
    for (let deneme = 0; deneme < 2; deneme++) {
      const kayit = await oturumGetir(istek.oturum)
      /*
       * Sahiplik: önce cihaz (çerez okumadan, ucuz), tutmazsa hesaba bağlı
       * oturumda girişli kullanıcı — başka cihazdan devam edebilsin.
       *
       * ⚠️ Başkasının oturumu ile yok olan oturum AYNI yanıtı alır: kimlik
       * tahmini ipucu vermesin.
       */
      const sahip =
        kayit !== null &&
        ((cihaz !== null && kayit.cihazOzet === cihaz) ||
          (kayit.kullaniciId !== null && (await oturumKullanici())?.id === kayit.kullaniciId))
      if (!kayit || !sahip) {
        return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 404 })
      }
      const { oturum } = kayit
      let set = await gunlukSetiGetir(oturum.gun, { olustur: false })
      if (!set) return NextResponse.json({ error: 'Günün seti bulunamadı.' }, { status: 503 })

      const simdi = gunlukSimdi()
      const sonTeslim = sonTeslimAni(oturum.gun)
      let sonuc: HamleSonucu

      if (istek.hamle.t === 'olu') {
        const engel = oluDenetle(oturum, istek, simdi, sonTeslim)
        if (engel) {
          sonuc = engel
        } else {
          const i = istek.tur
          const kayitTur = oturum.turlar[i]!
          const slot = set.slotlar[i]!
          const sonraki = kayitTur.aday + 1
          if (sonraki >= slot.adaylar.length) {
            return yanit(oturum, set, { hata: 'Bu tur için yedek kalmadı.' }, 503)
          }
          const oge = slot.adaylar[kayitTur.aday]!
          if (!(await medyaCanli(oge))) {
            // Gerçekten ölü: sonraki oyuncular baştan yedeği alsın.
            set = await setAdayIlerlet(set, i, sonraki)
            const aday = Math.max(sonraki, set.slotlar[i]!.aktif)
            sonuc = aday < slot.adaylar.length
              ? { tur: 'uygulandi', oturum: adayaGecir(oturum, i, aday, simdi, false), geri: { kind: 'sonraki' } }
              : { tur: 'hata', kod: 409, mesaj: 'Bu tur için yedek kalmadı.' }
          } else if (!oturum.yedekKullanildi) {
            // Sunucuya göre çalışıyor ama oyuncuda çalmıyor (codec, ağ): bir kez izin.
            sonuc = { tur: 'uygulandi', oturum: adayaGecir(oturum, i, sonraki, simdi, true), geri: { kind: 'sonraki' } }
          } else {
            sonuc = { tur: 'hata', kod: 409, mesaj: 'Medya çalışıyor görünüyor; sayfayı yenileyip tekrar dene.' }
          }
        }
      } else {
        const hakem = istek.hamle.t === 'tahmin' || istek.hamle.t === 'sec'
          ? await hakemGetir()
          : { tahmin: () => ({ kind: 'empty' as const }), secim: () => null }
        sonuc = hamleUygula(oturum, set, { ...istek, hamle: istek.hamle }, simdi, hakem, sonTeslim)
      }

      switch (sonuc.tur) {
        case 'uygulandi':
          if (!(await oturumYaz(oturum, sonuc.oturum))) continue
          return yanit(sonuc.oturum, set, { geri: sonuc.geri })

        case 'zaman-asimi':
          if (!(await oturumYaz(oturum, sonuc.oturum))) continue
          return yanit(sonuc.oturum, set, { hata: 'Günün süresi doldu; bu oyun sıralamaya sayılmayacak.' }, 410)

        case 'degismedi':
          return yanit(oturum, set, { cakisma: true })

        case 'belirsiz':
          if (await bosSinir()) return cokHizli()
          return yanit(oturum, set, { belirsiz: sonuc.adaylar })

        case 'bos':
          if (await bosSinir()) return cokHizli()
          return yanit(oturum, set, {})

        case 'hata':
          if (await bosSinir()) return cokHizli()
          return yanit(oturum, set, { hata: sonuc.mesaj }, sonuc.kod)
      }
    }
    return NextResponse.json({ error: 'Aynı anda başka bir hamle işlendi; tekrar dene.' }, { status: 409 })
  } catch {
    return NextResponse.json({ error: 'Hamle işlenemedi.' }, { status: 502 })
  }
}
