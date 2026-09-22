import { CHIPS, VARSAYILAN_YIL, type ChipId } from '@/data/categories'
import { filterByTier, filterByYear } from '@/game/select'
import { kademeOku, yilOku } from '@/lib/havuzDilim'
import { havuzSatirlari } from '@/lib/havuzSunucu'
import { sikistirilmisJson } from '@/lib/sikistir'

/**
 * Oyunun şarkı havuzu — Supabase'den canlı okunur (bkz. `lib/havuzSunucu`).
 *
 * `?kademe=N` verilirse yalnızca o kademenin DİLİMİ döner:
 * `filterByTier(havuz, N)`, yani istemcinin eskiden kendisi hesapladığı
 * listenin birebir aynısı (ince seçkide komşu kademe genişletmesi dahil).
 *
 * ⚠️ Dilim neden var: Karışık seçkinin tamamı 15 bin şarkı, brotli ile 543 KB
 * ve oyunun ilk turu bu yanıtı bekliyordu. Oysa tek oyunculu oyun ve düello
 * yalnızca oynanan kademeyi kullanıyor; dilim 40-190 KB. Tam havuz sanatçı
 * modu ve yayıncı modu için duruyor.
 */

/**
 * Tarayıcı ve CDN tazelik ömrü — küratör düzenlemesinin oyunculara ulaşma
 * gecikmesinin üst sınırı. Supabase okuma aralığından AYRI tutuluyor: biri
 * yayın hızını, diğeri veritabanı maliyetini belirliyor.
 */
const REVALIDATE_SECONDS = 60

export function generateStaticParams() {
  return CHIPS.map((c) => ({ chip: c.id }))
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ chip: string }> },
) {
  const { chip: raw } = await ctx.params
  const chip = (CHIPS.find((c) => c.id === raw)?.id ?? 'karisik') as ChipId
  const sorgu = new URL(req.url).searchParams
  const kademe = kademeOku(sorgu.get('kademe'))
  const yil = yilOku(sorgu.get('yil')) ?? VARSAYILAN_YIL

  /*
   * ⚠️ Gövde TEMBEL: yalnızca sıkıştırma önbelleği soğukken üretiliyor.
   * İsteği okumak rotayı dinamik yaptığı için her istek 16 sayfalık Supabase
   * okumasına dönüşüyordu (bkz. `lib/sikistir`).
   */
  return sikistirilmisJson(
    req,
    kademe ? `havuz:${chip}:${kademe}:${yil}` : `havuz:${chip}`,
    async () => {
      const { songs, kaynak } = await havuzSatirlari(chip)
      /*
       * ⚠️ SIRA: önce YIL, sonra KADEME. Tersi sessizce yanlış: `filterByTier`
       * ince kademede komşu kademeleri katıyor ve bu genişletme tüm seçki
       * üzerinde yapılırsa yıl dilimi dışından şarkı getirir. Daha kötüsü,
       * kademe dilimi önce alınıp sonra yıla süzülürse ince hücreler
       * (ör. Sanat Müziği + Bu yıl) neredeyse hep BOŞ çıkar: genişletme
       * yıl süzgecinden önce "yeterli" dediği için hiç devreye girmez.
       * Doğru sırada 5 şarkılık bir hücre bile tüm kademeler birleşerek
       * oynanabilir kalıyor.
       *
       * ⚠️ Yıl anahtara giriyor ama SUPABASE OKUMASINA girmiyor:
       * `havuzSatirlari(chip)` hâlâ seçki başına tek okuma ve kendi
       * önbelleğinde. Çoğalan tek şey sıkıştırılmış gövde sayısı — onun da
       * artık üst sınırı var (bkz. `sikistir`).
       */
      return kademe
        ? { chip, kademe, yil, kaynak, songs: filterByTier(filterByYear(songs, yil), kademe) }
        : { chip, kaynak, songs }
    },
    {
      /*
       * ⚠️ `max-age` ŞART. `s-maxage` yalnızca paylaşımlı önbellekleri
       * bağlar; onsuz tarayıcı için tazelik ömrü tanımsız kalıyor ve her
       * sayfa yüklemesi en az bir koşullu gidiş-dönüş ödüyordu.
       */
      'Cache-Control': `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
    },
  )
}
