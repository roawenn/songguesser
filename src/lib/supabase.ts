import 'server-only'
import type { Song } from '@/data/schema'
import type { CategoryId, EraId, Difficulty } from '@/data/categories'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Supabase yapılandırılmamışsa oyun statik yedeğe düşer. */
export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON)

/** Veritabanındaki satır biçimi (okunaklı kolon adları). */
export interface SongRow {
  id: string
  category: string
  title: string
  artist: string
  artwork: string
  preview: string
  store_url: string
  clip_start: number
  duration: number
  year: number
  era: string
  tier: number
  enabled: boolean
  norm_title: string
  norm_artist: string
  accept_keys: string[]
  /** Panelde "son eklenenler" sıralaması için. */
  created_at?: string
}

/**
 * DB satırını oyunun kullandığı kompakt biçime çevirir.
 *
 * ⚠️ URL alanları YOKSA hiç yazılmaz. `POOL_COLUMNS` ile çekilen satırlarda
 * kapak/önizleme/mağaza gelmiyor; `ar: undefined` yazmak JSON'a `null` basıp
 * satır başına boşuna bayt eklerdi.
 */
export function toSong(r: SongRow): Song {
  const s: Song = {
    id: r.id,
    t: r.title,
    a: r.artist,
    cs: r.clip_start,
    du: r.duration,
    y: r.year,
    e: r.era as EraId,
    d: r.tier as Difficulty,
    c: r.category as CategoryId,
    nT: r.norm_title,
    nA: r.norm_artist,
    k: r.accept_keys ?? [],
    off: r.enabled ? 0 : 1,
  }
  if (r.artwork) s.ar = r.artwork
  if (r.preview) s.p = r.preview
  if (r.store_url) s.u = r.store_url
  return s
}

export const SONG_COLUMNS =
  'id,category,title,artist,artwork,preview,store_url,clip_start,duration,year,era,tier,enabled,norm_title,norm_artist,accept_keys'

/**
 * Oyunun TOPLU havuzda okuduğu kolonlar — URL'ler YOK.
 *
 * ⚠️ Üç URL alanı (`artwork`, `preview`, `store_url`) 5089 satırlık yanıtın
 * **%60'ıydı**: sırasıyla 659, 792 ve 428 KB. Hiçbiri havuzun tamamı için
 * gerekli değil — `preview` yalnızca kurulan şarkıda, `artwork` ve `store_url`
 * yalnızca sonuç kartında lazım. Ölçüm: 3,04 MB → 1,16 MB.
 *
 * ⚠️ `accept_keys` ve norm alanları BURADA KALIYOR. Başlık/sanatçıdan
 * türetilebildikleri doğrulandı (5089/5089 birebir aynı) ama istemcide
 * hesaplamak ~200 ms ana iş parçacığı demek — kazandırdığı indirme süresinden
 * fazla. Ölçülmeden yapılsaydı iyileştirme sanılacak bir gerileme olurdu.
 */
export const POOL_COLUMNS =
  'id,category,title,artist,clip_start,duration,year,era,tier,enabled,norm_title,norm_artist,accept_keys'

/** Yalnızca oynanabilirlik için gereken alanlar — şarkı başına çekilir. */
export const PLAY_COLUMNS = 'id,preview,artwork,store_url'

/**
 * Sunucu tarafı istek başlığı.
 *
 * ⚠️ `secret` yalnızca sunucuda kullanılır — RLS'i baypas eder, tarayıcıya
 * ASLA gönderilmez. Okuma yolunda anon anahtar yeter; secret sadece yönetim
 * panelinin yazma işlemlerinde devreye girer.
 */
export function restHeaders(opts: { secret?: boolean } = {}): HeadersInit {
  const key = opts.secret
    ? (process.env.SUPABASE_SECRET_KEY ?? '')
    : SUPABASE_ANON
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export function restUrl(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`
}

/**
 * PostgREST'in tek yanıtta döndürdüğü en fazla satır.
 *
 * ⚠️ Bu, sorgudaki `limit` ile DEĞİŞMEZ. Supabase projesinde sunucu tarafında
 * `db-max-rows` tanımlı ve bizim projede 1000. Ölçüldü:
 * `?limit=50000` → `206 content-range: 0-999/5089`.
 */
export const REST_SAYFA = 1000

/**
 * Bütün satırları sayfalayarak çeker.
 *
 * ⚠️ Bu ZORUNLU, süs değil. Havuz 5089 satıra çıktığında sorgudaki `limit`
 * yükseltilmişti ama işe yaramadı: PostgREST kendi tavanında kesiyor ve
 * `200` yerine sessizce `206` dönüyordu. Tarayıcı aylarca havuzun yalnızca
 * ilk 1000 satırını gördü — geri kalan %80'i oyunda hiç çıkmadı, panelde hiç
 * görünmedi, tekrar kontrolüne hiç girmedi.
 *
 * Toplam satır sayısı `content-range`'in paydasından okunuyor, o yüzden kaç
 * sayfa gerektiğini tahmin etmeye gerek yok — ilk sayfadan sonra kalanlar
 * PARALEL çekilebiliyor.
 */
/** Aynı anda açık sayfa isteği sayısı. */
const ES_ZAMANLI = 6

async function sayfaCek<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
  bas: number,
): Promise<{ satirlar: T[]; toplam: number }> {
  const res = await fetch(restUrl(path), {
    ...init,
    headers: {
      ...init.headers,
      Range: `${bas}-${bas + REST_SAYFA - 1}`,
      'Range-Unit': 'items',
      Prefer: 'count=exact',
    },
  })
  if (!res.ok && res.status !== 206) throw new Error(`Supabase ${res.status}`)
  const satirlar = (await res.json()) as T[]
  const toplam = Number(res.headers.get('content-range')?.split('/')[1])
  return { satirlar, toplam: Number.isFinite(toplam) ? toplam : NaN }
}

export async function restTumSatirlar<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<T[]> {
  const ilk = await sayfaCek<T>(path, init, 0)
  if (ilk.satirlar.length < REST_SAYFA) return ilk.satirlar

  /*
   * Toplam okunamadıysa (ör. `count` kapalıysa) eski ardışık davranışa dön:
   * kaç sayfa gerektiğini bilmeden paralel istek atmak ya eksik okur ya da
   * boşuna istek yakar.
   */
  if (!Number.isFinite(ilk.toplam)) {
    const hepsi = [...ilk.satirlar]
    for (let b = REST_SAYFA; ; b += REST_SAYFA) {
      const { satirlar } = await sayfaCek<T>(path, init, b)
      hepsi.push(...satirlar)
      if (satirlar.length < REST_SAYFA) return hepsi
    }
  }

  const baslangiclar: number[] = []
  for (let b = REST_SAYFA; b < ilk.toplam; b += REST_SAYFA) baslangiclar.push(b)

  /*
   * Sayfalar SIRAYLA birleştiriliyor ama ARDIŞIK çekilmiyor. Havuz 15358
   * satıra çıkınca bu 16 sayfa demek; sayfa başına 180-400 ms ile yönetim
   * paneli her açılışta ~4 saniye, derleme ve her yeniden doğrulama da o
   * kadar bekliyordu. Sıra `order` sayesinde sunucuda belirli, dolayısıyla
   * indeksle yerine koymak güvenli.
   */
  const parcalar: T[][] = new Array(baslangiclar.length)
  let sonraki = 0
  const isci = async () => {
    for (;;) {
      const i = sonraki++
      if (i >= baslangiclar.length) return
      parcalar[i] = (await sayfaCek<T>(path, init, baslangiclar[i])).satirlar
    }
  }
  await Promise.all(Array.from({ length: Math.min(ES_ZAMANLI, baslangiclar.length) }, isci))

  return [ilk.satirlar, ...parcalar].flat()
}

/**
 * Yönetim panelinin okuduğu kolonlar.
 *
 * ⚠️ `SONG_COLUMNS`'tan ayrı: `created_at` yalnızca panelde ("son eklenenler")
 * işe yarıyor, oyun onu `toSong` içinde zaten atıyor. Oyunun okuma yolu
 * mümkün olduğunca dar kalsın.
 */
export const ADMIN_COLUMNS = `${SONG_COLUMNS},created_at`
