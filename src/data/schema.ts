import type { CategoryId, EraId, Difficulty } from './categories'

/**
 * Havuzdaki bir şarkı kaydı. Alan adları kısa, çünkü bu JSON her istemciye iner.
 *
 * ⚠️ `p` (previewUrl) yalnızca Apple'dan gelir. Deezer'ın preview URL'leri
 * ~24 saatlik imzalı token taşıyor (`hdnea=exp=...`), bu yüzden statik havuza
 * gömülemezler — bir gün sonra 403 dönerler.
 */
export interface Song {
  /** "itunes:1834674002" */
  id: string
  /** başlık (gösterim biçimi) */
  t: string
  /** sanatçı (gösterim biçimi) */
  a: string
  /**
   * Kapak URL'i, 100x100 — istemci 600x600bb.jpg'ye yükseltir.
   *
   * ⚠️ Toplu havuzda GELMEZ, yalnızca oynanan şarkı için çekilir. Üç URL alanı
   * (kapak, önizleme, mağaza) 5089 şarkılık yanıtın %60'ıydı ve hiçbiri havuzun
   * tamamı için gerekli değil.
   */
  ar?: string
  /** previewUrl — imzasız, kalıcı Apple CDN yolu. Toplu havuzda gelmez. */
  p?: string
  /** klip başlangıcı (sn). Pre-roll payı için >= 0.325 */
  cs: number
  /** preview süresi (sn) */
  du: number
  /** küratörün verdiği ORİJİNAL çıkış yılı */
  y: number
  e: EraId
  d: Difficulty
  c: CategoryId
  /** trackViewUrl — Apple Music atıf linki. Toplu havuzda gelmez. */
  u?: string
  /** önceden normalize edilmiş başlık */
  nT: string
  /** önceden normalize edilmiş sanatçı */
  nA: string
  /** kabul anahtarları */
  k: string[]
  /**
   * Küratör tarafından kapatılmış mı?
   *
   * Kapatılan şarkı havuzdan SİLİNMEZ, yalnızca işaretlenir — aksi hâlde
   * iTunes metadata'sı (preview, kapak, trackId) kaybolur ve geri açmak
   * yeniden build gerektirirdi. Yükleme sırasında süzülür.
   */
  off?: 0 | 1
}

export interface Pool {
  v: number
  cat: CategoryId
  builtAt: string
  songs: Song[]
}

export const POOL_VERSION = 1

/**
 * Kapak görselini istenen boyuta yükseltir.
 *
 * ⚠️ Kapak toplu havuzda GELMEZ (bkz. `POOL_COLUMNS`); şarkı alanları henüz
 * çekilmemişse boş döner ve çağıran yer yedek bir kutu gösterir.
 */
export function artworkAt(ar: string | undefined, size: number): string {
  if (!ar) return ''
  return ar.replace(/\/\d+x\d+bb\.jpg$/, `/${size}x${size}bb.jpg`)
}
