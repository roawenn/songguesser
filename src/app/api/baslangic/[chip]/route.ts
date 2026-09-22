import { NextResponse } from 'next/server'
import { CHIPS, VARSAYILAN_YIL, type ChipId } from '@/data/categories'
import { kademeOku, yilOku } from '@/lib/havuzDilim'
import { baslangicSec } from '@/lib/havuzSunucu'

/**
 * Başlangıç paketi: seçki + kademeden birkaç rastgele şarkı, önizleme URL'i dahil.
 *
 * ⚠️ İlk turun kritik yolu için var. Eskiden sırayla bekleniyordu: havuz
 * (Karışık'ta 543 KB; soğuk sunucuda 16 sayfalık Supabase okuması) → ilk
 * şarkının alanları (`/api/sarki`, rastgele kimlik = hep önbellek ıskası) →
 * Apple'dan ses. Bu yanıt birkaç KB ve tek sorgu; istemci ilk turu hemen
 * kurar, havuz dilimi arkada paralel iner.
 *
 * ⚠️ CDN'de 30 sn tutuluyor: o pencerede gelen oyuncular AYNI şarkıları alır,
 * istemci aralarından rastgele seçer. Supabase'e giden çağrı böylece seçki ve
 * kademe başına dakikada birkaç taneyle sınırlı. Tarayıcı saklamaz — oturum
 * açılışında her seferinde yeni bir paket gelsin.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ chip: string }> },
) {
  const { chip: raw } = await ctx.params
  const chip = CHIPS.find((c) => c.id === raw)?.id as ChipId | undefined
  const sorgu = new URL(req.url).searchParams
  const kademe = kademeOku(sorgu.get('kademe'))
  if (!chip || !kademe) return NextResponse.json({ songs: [] }, { status: 400 })

  /*
   * ⚠️ Yıl paketi DE süzmeli. Tam havuzdan gelen 24 rastgele şarkının
   * varsayılan "Bu yıl" dilimine düşeni ortalama yarım tanedir (363/15.357);
   * süzmeseydik paket pratikte hep boşa gider, oyuncu da hızlı başlangıcı
   * kaybedip tam havuzu beklerdi.
   *
   * ⚠️ `yil` CDN anahtarına giriyor: varyant sayısı seçki × kademe × 6 oluyor.
   * Supabase tarafı yine 30 sn'de bir tek RPC (24 satır) olduğu için egress'e
   * etkisi ihmal edilebilir — tam havuz okumasını yıla göre bölmek olsaydı
   * durum bambaşkaydı (bkz. `havuzSunucu.fromSupabase`).
   */
  const yil = yilOku(sorgu.get('yil')) ?? VARSAYILAN_YIL

  const songs = await baslangicSec(chip, kademe, yil)
  return NextResponse.json(
    { songs },
    {
      headers: {
        // Boş paket (hata ya da yapılandırma yok) önbelleğe alınmasın.
        'Cache-Control': songs.length > 0
          ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
          : 'no-store',
      },
    },
  )
}
