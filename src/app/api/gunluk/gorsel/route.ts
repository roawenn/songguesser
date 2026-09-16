import sharp from 'sharp'
import { KAPAK_ADIM, KAPAK_BOYUTLARI } from '@/data/kapak'
import { artworkAt } from '@/data/schema'
import { SERIT } from '@/data/unlu'
import { gunGecerli } from '@/game/gun'
import { GUNLUK_TUR } from '@/game/gunluk'
import { gorselImzaDogru, gunlukSetiGetir, ogeMedyaAdresi } from '@/lib/gunlukSunucu'

/**
 * Günlük görseli — yalnızca oyuncunun ulaştığı adıma kadar.
 *
 * ⚠️ NEDEN VEKİL: Normal oyunda kapak adresi tarayıcıda (`…/8x8bb.jpg`) ve
 * `600x600bb` yazmak net kapağı veriyor; ünlü görseli tam iniyor, şeritler
 * yalnızca CSS ile gizleniyor. Sunucu hakemli bir sıralamada ikisi de
 * Network sekmesinden bir tıkla cevap demek.
 *
 *   · Ünlü: kapalı şeritler SUNUCUDA siyaha boyanıyor; tarayıcıya inen
 *     görselde açılmamış bölgenin pikseli yok.
 *   · Kapak: yalnızca o adımın boyutu (8, 16, 32, 64, 600) iletiliyor.
 *
 * Adım imzanın içinde (bkz. `gorselAdresi`): imza yalnızca oyuncu o adıma
 * ulaşınca görünümde üretiliyor, `n` elle büyütülürse tutmuyor. Bu yüzden
 * yanıt paylaşılan önbelleğe de konabiliyor.
 */

const ONBELLEK = 'public, max-age=86400, s-maxage=86400, immutable'
const bellek = new Map<string, { govde: Uint8Array<ArrayBuffer>; tip: string }>()
const BELLEK_TAVAN = 64

function bellegeYaz(anahtar: string, deger: { govde: Uint8Array<ArrayBuffer>; tip: string }) {
  bellek.set(anahtar, deger)
  if (bellek.size > BELLEK_TAVAN) bellek.delete(bellek.keys().next().value!)
}

async function indir(url: string): Promise<{ govde: Uint8Array<ArrayBuffer>; tip: string } | null> {
  // Apple küçük boyutları zaman zaman saniyelerce geç veriyor (ölçüldü); 8 sn kısa kalıyordu.
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!res.ok) return null
  return { govde: new Uint8Array(await res.arrayBuffer()), tip: res.headers.get('content-type') ?? 'image/jpeg' }
}

/** Açılmamış şeritleri siyaha boyar. */
async function seritleriKapat(govde: Uint8Array, acilan: number): Promise<Uint8Array<ArrayBuffer>> {
  const gorsel = sharp(govde)
  const { width, height } = await gorsel.metadata()
  if (!width || !height) throw new Error('boyut okunamadı')
  const acik = Math.round((height * acilan) / SERIT)
  const kapali = height - acik
  const cikti = kapali > 0
    ? gorsel.composite([{
        input: { create: { width, height: kapali, channels: 3, background: '#000000' } },
        top: acik,
        left: 0,
      }])
    : gorsel
  return new Uint8Array(await cikti.webp({ quality: 82 }).toBuffer())
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const gun = q.get('g')
  const tur = Number(q.get('t'))
  const aday = Number(q.get('a'))
  const adim = Number(q.get('n'))
  const imza = q.get('i') ?? ''

  if (
    !gunGecerli(gun) ||
    !Number.isInteger(tur) || tur < 0 || tur >= GUNLUK_TUR ||
    !Number.isInteger(aday) || aday < 0 || aday > 10 ||
    !Number.isInteger(adim) || adim < 1 || adim > Math.max(SERIT, KAPAK_ADIM) ||
    !gorselImzaDogru(gun, tur, aday, adim, imza)
  ) {
    return new Response('Geçersiz istek.', { status: 400 })
  }

  const anahtar = `${gun}:${tur}:${aday}:${adim}`
  const hazir = bellek.get(anahtar)
  if (hazir) {
    return new Response(hazir.govde, { headers: { 'Content-Type': hazir.tip, 'Cache-Control': ONBELLEK } })
  }

  try {
    const set = await gunlukSetiGetir(gun, { olustur: false })
    const oge = set?.slotlar[tur]?.adaylar[aday]
    if (!oge || oge.oyun === 'sarki') return new Response('Bulunamadı.', { status: 404 })

    let sonuc: { govde: Uint8Array<ArrayBuffer>; tip: string } | null
    if (oge.oyun === 'kapak') {
      sonuc = await indir(artworkAt(oge.ar, KAPAK_BOYUTLARI[adim - 1] ?? 600))
    } else {
      const ham = await indir(ogeMedyaAdresi(oge))
      sonuc = ham && { govde: adim >= SERIT ? ham.govde : await seritleriKapat(ham.govde, adim), tip: adim >= SERIT ? ham.tip : 'image/webp' }
    }
    if (!sonuc) return new Response('Görsel alınamadı.', { status: 502 })

    bellegeYaz(anahtar, sonuc)
    return new Response(sonuc.govde, { headers: { 'Content-Type': sonuc.tip, 'Cache-Control': ONBELLEK } })
  } catch {
    return new Response('Görsel alınamadı.', { status: 502 })
  }
}
