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
 *
 * ⚠️ Dönüş tipi `Record<string, string>` OLMALI, `Headers` değil: çağrı
 * yerleri onu spread ediyor (`{ ...restHeaders({secret:true}), Prefer: … }`)
 * ve `Headers` ile spread sessizce boş nesne verir.
 */
export function restHeaders(
  opts: { secret?: boolean; tip?: string | null } = {},
): Record<string, string> {
  const key = opts.secret
    ? (process.env.SUPABASE_SECRET_KEY ?? '')
    : SUPABASE_ANON
  const h: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    /*
     * ⚠️ `Accept-Encoding` ŞART: Node'un `fetch`'i (undici) tarayıcının
     * aksine bunu KENDİLİĞİNDEN göndermiyor. Başlıksız her okuma
     * sıkıştırılmamış iniyordu ve Supabase egress'i yedi katına çıkıyordu.
     *
     * Ölçüldü (1000 satır, `POOL_COLUMNS`): 333 KB → 47 KB. Tam "Karışık"
     * havuz okuması 5,1 MB → 722 KB, yönetim panelinin listesi 12 MB → 2 MB.
     * Gövdeyi undici saydam açıyor; çağrı yerlerinin hiçbiri değişmiyor.
     *
     * `br` %6 daha küçük ama Node sürümüne göre açılmayabiliyor; gzip her
     * yerde çalışıyor ve kazancın tamamına yakınını veriyor.
     */
    'Accept-Encoding': 'gzip',
  }
  /*
   * ⚠️ `Content-Type` artık SABİT DEĞİL. Görsel yükleme `image/webp` istiyor;
   * `application/json` başlığıyla gönderilen bir WebP depoya bozuk yazılır.
   * `tip: null` başlığı hiç yazmamak için (gövdesiz istekler).
   */
  if (opts.tip !== null) h['Content-Type'] = opts.tip ?? 'application/json'
  return h
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
 * Toplam satır sayısı AYRI bir istekle okunuyor (`toplamSayi`), o yüzden kaç
 * sayfa gerektiğini tahmin etmeye gerek yok — ilk sayfadan sonra kalanlar
 * PARALEL çekilebiliyor. Sayımın neden sayfalardan ayrıldığı `sayfaCek`'in
 * başında yazıyor: 206 dönen bir yanıt Next'in veri önbelleğine giremiyor.
 */
/** Aynı anda açık sayfa isteği sayısı. */
const ES_ZAMANLI = 6

/**
 * Tek sayfa — VERİ ÖNBELLEĞİNE GİREBİLİR.
 *
 * ⚠️ `Prefer: count=exact` BURADA OLMAMALI, ne kadar masum görünürse görünsün.
 * PostgREST toplamı bilince yanıtı `206 Partial Content` yapıyor; Next'in veri
 * önbelleği ise YALNIZCA `200` saklıyor (`patch-fetch.js`: `res.status === 200
 * && incrementalCache && …`). Başlık oradayken havuzun 16 sayfası önbelleğe
 * hiç girmiyordu: `next: { revalidate, tags }` yazılıydı, `.next/cache/
 * fetch-cache` içinde tek bir havuz girdisi yoktu ve SOĞUK her istek 5 MB'lık
 * tam okumaya dönüyordu. Ücretsiz plandaki 5 GB'ın günde birkaç GB'ını yiyen
 * şey buydu.
 *
 * Toplam artık ayrı ve ~200 baytlık bir istekle okunuyor (`toplamSayi`).
 */
async function sayfaCek<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
  bas: number,
): Promise<T[]> {
  const res = await fetch(restUrl(path), {
    ...init,
    headers: {
      ...init.headers,
      Range: `${bas}-${bas + REST_SAYFA - 1}`,
      'Range-Unit': 'items',
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return (await res.json()) as T[]
}

/**
 * Sorgunun toplam satır sayısı — tek satırlık, sayfalamayı paralelleştirmek için.
 *
 * ⚠️ Bu istek ÖNBELLEĞE GİRMEZ (206 döner) ve girmesine gerek de yok: `select`
 * `id`'ye indirildiği ve `Range: 0-0` istendiği için gövde ~200 bayt. Pahalı
 * olan sayfaların kendisiydi ve onlar artık önbellekte.
 *
 * ⚠️ `next` seçeneği TEMİZLENİYOR: `cache: 'no-store'` ile `next.revalidate`
 * aynı anda verilemez, Next hata fırlatır.
 */
async function toplamSayi(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<number> {
  const [yol, sorgu = ''] = path.split('?')
  const params = new URLSearchParams(sorgu)
  params.set('select', 'id')
  // Sayım sıralamadan etkilenmez; sıralatmak boşuna iş.
  params.delete('order')
  const { next: _next, ...kalan } = init as RequestInit & { next?: unknown }

  const res = await fetch(restUrl(`${yol}?${params}`), {
    ...kalan,
    cache: 'no-store',
    headers: { ...init.headers, Range: '0-0', 'Range-Unit': 'items', Prefer: 'count=exact' },
  })
  if (!res.ok && res.status !== 206) return NaN
  // Gövde okunmazsa bağlantı açık kalır.
  await res.arrayBuffer()
  const toplam = Number(res.headers.get('content-range')?.split('/')[1])
  return Number.isFinite(toplam) ? toplam : NaN
}

export async function restTumSatirlar<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<T[]> {
  // İlk sayfa ve toplam PARALEL: sayım küçük, ilk sayfayı bekletmesin.
  const [ilk, toplam] = await Promise.all([
    sayfaCek<T>(path, init, 0),
    toplamSayi(path, init).catch(() => NaN),
  ])
  if (ilk.length < REST_SAYFA) return ilk

  /*
   * Toplam okunamadıysa (ör. `count` kapalıysa) eski ardışık davranışa dön:
   * kaç sayfa gerektiğini bilmeden paralel istek atmak ya eksik okur ya da
   * boşuna istek yakar.
   */
  if (!Number.isFinite(toplam)) {
    const hepsi = [...ilk]
    for (let b = REST_SAYFA; ; b += REST_SAYFA) {
      const satirlar = await sayfaCek<T>(path, init, b)
      hepsi.push(...satirlar)
      if (satirlar.length < REST_SAYFA) return hepsi
    }
  }

  const baslangiclar: number[] = []
  for (let b = REST_SAYFA; b < toplam; b += REST_SAYFA) baslangiclar.push(b)

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
      parcalar[i] = await sayfaCek<T>(path, init, baslangiclar[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(ES_ZAMANLI, baslangiclar.length) }, isci))

  return [ilk, ...parcalar].flat()
}

/**
 * Yönetim panelinin okuduğu kolonlar.
 *
 * ⚠️ `SONG_COLUMNS`'tan ayrı: `created_at` yalnızca panelde ("son eklenenler")
 * işe yarıyor, oyun onu `toSong` içinde zaten atıyor. Oyunun okuma yolu
 * mümkün olduğunca dar kalsın.
 */
export const ADMIN_COLUMNS = `${SONG_COLUMNS},created_at`
