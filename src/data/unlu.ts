import type { Difficulty, UnluCategoryId } from './categories'

/**
 * Havuzdaki bir ünlü kaydı. Alan adları kısa — bu JSON her istemciye iner.
 *
 * ⚠️ `nT` ve `nA` alanları `Song` ile AYNI ADI taşıyor, çünkü `judgeGuess`,
 * `buildIndex` ve `GuessInput` ikisini birden yapısal tiple kabul ediyor
 * (bkz. `text/match.ts` → `Tahminlenebilir`).
 *
 * `nA` BOŞ dize. Ünlünün ikinci bir adı yok. Bu, `judgeGuess`'in "sanatçı
 * doğru" rozetini asla tetiklememeli — oradaki `guessAsArtist.length > 0`
 * koşulu bunu sağlıyor ve `match.test.ts` bunu kilitliyor.
 */
export interface Unlu {
  /** "unlu:ab12cd34…" */
  id: string
  /** Gösterim adı. */
  ad: string
  /** Zorluk kademesi (1 Kolay … 5 İmkansız). */
  d: Difficulty
  c: UnluCategoryId
  /** Görsel sürümü — yalnızca önbellek kırmak için. */
  v: number
  /** Normalize ad. `Tahminlenebilir` uyumu için `nT` adıyla. */
  nT: string
  /** ⚠️ Ünlüde İKİNCİ AD YOK — her zaman boş dize. */
  nA: string
  /** Kabul anahtarları. */
  k: string[]
  /** Küratör tarafından kapatılmış mı? */
  off?: 0 | 1
}

export interface UnluHavuz {
  v: number
  chip: string
  builtAt: string
  unluler: Unlu[]
}

export const UNLU_HAVUZ_SURUM = 1

/**
 * Görselin depodaki yolu — KİMLİKTEN TÜRETİLİR.
 *
 * ⚠️ Yol için ayrı bir kolon bilinçli olarak YOK. İki kaynak olsaydı yeniden
 * kırpmada biri güncellenip diğeri eski kalabilir ve oyun var olmayan bir
 * dosyayı isteyebilirdi. `?v=` yalnızca tarayıcı önbelleğini kırmak için.
 */
export function unluGorselYolu(u: Pick<Unlu, 'id' | 'v'>): string {
  return `${u.id.slice('unlu:'.length)}.webp?v=${u.v}`
}

/**
 * Görsel kaç eşit YATAY ŞERİDE bölünür.
 *
 * Başta yalnızca 1. şerit (saç) açık. Yanlış tahmin ya da pas bir şerit daha
 * açar; beşinci açılınca tur biter — yani pratikte 4 tahmin hakkı var.
 */
export const SERIT = 5

/** Normalleştirilmiş görsel boyutu. */
export const GORSEL_G = 900
export const GORSEL_Y = 1500

/**
 * ⚠️ Oran 3:5, kare ya da 3:4 DEĞİL.
 *
 * Beş eşit şeride bölününce her şerit 3:1 olur ve saç / göz / ağız bandı
 * okunur kalır. 3:4'te şeritler 3:0,8'e düşer ve yüz tanınmaz hâle gelir.
 */
export const GORSEL_ORAN = `${GORSEL_G} / ${GORSEL_Y}`

/** Öneri ve belirsizlik listelerinde bir ünlünün nasıl yazılacağı. */
export function unluSatiri(u: Unlu): { ust: string; alt?: string } {
  return { ust: u.ad }
}

/** Otomatik tamamlama samanlığı — ünlüde tek ad var. */
export function unluSamanligi(u: Unlu): string {
  return u.nT
}
