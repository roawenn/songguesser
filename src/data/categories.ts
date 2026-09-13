/**
 * Kategori ve seviye modeli.
 *
 * Tasarım (theme/Nakarat.dc.html) tür ve dönemi TEK bir yatay şeritte
 * karıştırıyor. Bu dosya o şeridi tanımlar: tür çipleri kendi havuz
 * dosyasından, dönem çipleri tüm havuzların birleşiminden süzülerek beslenir.
 */

// --- Havuz dosyaları (disk üzerindeki tür havuzları) ---

export const CATEGORY_IDS = [
  'pop', 'rap', 'arabesk', 'rock', 'halk', 'sanat', 'fantezi',
] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

// --- Dönemler ---

export const ERA_IDS = ['70', '80', '90', '00', '10', '20'] as const
export type EraId = (typeof ERA_IDS)[number]

export const ERA_LABELS: Record<EraId, string> = {
  '70': '70’ler ve öncesi',
  '80': '80’ler',
  '90': '90’lar',
  '00': '2000’ler',
  '10': '2010’lar',
  '20': '2020’ler',
}

export function eraForYear(year: number): EraId {
  if (year < 1980) return '70'
  if (year < 1990) return '80'
  if (year < 2000) return '90'
  if (year < 2010) return '00'
  if (year < 2020) return '10'
  return '20'
}

// --- Şarkı zorluk kademesi ---
//
// Küratörün her şarkıya elle verdiği 1-5 değeri. Kategori şeridinin altındaki
// zorluk seçicisi doğrudan bunu filtreler: "Kolay" en bilinen şarkıları,
// "İmkansız" en derin kesimi getirir.

export type Difficulty = 1 | 2 | 3 | 4 | 5

/**
 * Kademeler kendi renklerini taşır: yeşilden mora doğru ısınan bir skala.
 *
 * ⚠️ Bu renk SAHNEYİ sürmez — sahne rengi kategoriden gelir. Zorluk yalnızca
 * kendi pill'ini boyar, böylece iki bilgi de renkle okunur ama çakışmaz.
 */
export const TIERS: ReadonlyArray<{
  id: Difficulty
  label: string
  hint: string
  hue: number
}> = [
  { id: 1, label: 'Kolay', hint: 'Herkesin bildiği şarkılar', hue: 150 },
  { id: 2, label: 'Orta', hint: 'Radyoda çok duyulmuş olanlar', hue: 100 },
  { id: 3, label: 'Zor', hint: 'Tanıdık ama adı dilin ucunda', hue: 60 },
  { id: 4, label: 'Uzman', hint: 'Türü takip edenlerin bileceği', hue: 25 },
  { id: 5, label: 'İmkansız', hint: 'Derin kesim', hue: 310 },
]

export const TIER_LABELS: Record<Difficulty, string> = {
  1: 'Kolay',
  2: 'Orta',
  3: 'Zor',
  4: 'Uzman',
  5: 'İmkansız',
}

// --- Kategori şeridi ---

export type ChipId =
  | 'karisik'
  | CategoryId
  | 'eskiler'
  | 'doksanlar'
  | 'iki-binler'

/** Çip ya bir tür havuzundan ya da tüm havuzlardan + dönem süzgecinden beslenir. */
export type ChipSource =
  | { kind: 'all' }
  | { kind: 'genre'; genre: CategoryId }
  | { kind: 'eras'; eras: EraId[] }

export interface Chip {
  id: ChipId
  label: string
  /** Sahnenin tek değişkeni. Vurgu, spot, kaset şeridi hepsi bundan türer. */
  hue: number
  source: ChipSource
}

/**
 * Şerit sırası ekrandaki sırayla aynı.
 *
 * Hue'lar: tasarımın verdiği değerler (Karışık 205, Pop 330, Rock 12,
 * Arabesk 38, Rap 80, 90'lar 265, 2000'ler 175) aynen korundu; yeni çipler
 * aradaki boşluklara yerleştirildi.
 */
export const CHIPS: Chip[] = [
  { id: 'karisik', label: 'Karışık', hue: 205, source: { kind: 'all' } },
  { id: 'pop', label: 'Pop', hue: 330, source: { kind: 'genre', genre: 'pop' } },
  { id: 'rap', label: 'Rap', hue: 80, source: { kind: 'genre', genre: 'rap' } },
  { id: 'arabesk', label: 'Arabesk', hue: 38, source: { kind: 'genre', genre: 'arabesk' } },
  { id: 'rock', label: 'Rock', hue: 12, source: { kind: 'genre', genre: 'rock' } },
  { id: 'halk', label: 'Halk Müziği', hue: 145, source: { kind: 'genre', genre: 'halk' } },
  { id: 'sanat', label: 'Sanat Müziği', hue: 60, source: { kind: 'genre', genre: 'sanat' } },
  { id: 'fantezi', label: 'Fantezi', hue: 300, source: { kind: 'genre', genre: 'fantezi' } },
  { id: 'eskiler', label: 'Eskiler', hue: 105, source: { kind: 'eras', eras: ['70', '80', '90'] } },
  { id: 'doksanlar', label: '90’lar', hue: 265, source: { kind: 'eras', eras: ['90'] } },
  { id: 'iki-binler', label: '2000’ler', hue: 175, source: { kind: 'eras', eras: ['00'] } },
]

const CHIP_BY_ID = new Map(CHIPS.map((c) => [c.id, c]))

export function chipById(id: ChipId): Chip {
  return CHIP_BY_ID.get(id) ?? CHIPS[0]!
}

/**
 * Bir zorluk kademesinde oyunun anlamlı olması için gereken en az şarkı.
 * Altına düşerse komşu kademeler devreye alınır (bkz. `filterByTier`).
 */
export const MIN_PLAYABLE = 8

// --- İkinci oyun: ünlüyü görselinden tanı ---
//
// ⚠️ Ayrı bir uzay. Şarkının `CategoryId`/`ChipId`'si ile karışmasın diye
// paylaşılmıyor: iki oyunun kategorileri birbirine hiç benzemiyor ve ortak bir
// birleşim tipi her iki tarafta da imkânsız değerleri geçerli gösterirdi.
//
// ⚠️ DÖNEM boyutu YOK. Şarkıda "Eskiler/90'lar/2000'ler" çipleri var; ünlünün
// dönemi oyunun sorusuyla ilgisiz (kimse "90'ların ünlüsü" diye tahmin etmiyor).

export const UNLU_CATEGORY_IDS = [
  'sarkici',
  'oyuncu',
  'sporcu',
  'tarihi',
  'dunya',
] as const

export type UnluCategoryId = (typeof UNLU_CATEGORY_IDS)[number]

export type UnluChipId = 'unlu-karisik' | UnluCategoryId

/** Şarkı çipleriyle aynı şekil; `CategoryStrip` ikisini de çiziyor. */
export interface UnluChip {
  id: UnluChipId
  label: string
  hue: number
  /** `null` = bütün kategoriler (Karışık). */
  kategori: UnluCategoryId | null
}

/**
 * Hue'lar şarkı çiplerinden ayrı seçildi ki iki oyun renkten de ayırt edilsin;
 * "Karışık" ikisinde de 205, çünkü o ikisinde de aynı şeyi anlatıyor.
 */
export const UNLU_CHIPS: UnluChip[] = [
  { id: 'unlu-karisik', label: 'Karışık', hue: 205, kategori: null },
  { id: 'sarkici', label: 'Şarkıcı', hue: 330, kategori: 'sarkici' },
  { id: 'oyuncu', label: 'Oyuncu', hue: 285, kategori: 'oyuncu' },
  { id: 'sporcu', label: 'Sporcu', hue: 150, kategori: 'sporcu' },
  { id: 'tarihi', label: 'Tarihî', hue: 38, kategori: 'tarihi' },
  { id: 'dunya', label: 'Dünya ünlüleri', hue: 190, kategori: 'dunya' },
]

const UNLU_CHIP_BY_ID = new Map(UNLU_CHIPS.map((c) => [c.id, c]))

export function unluChipById(id: UnluChipId): UnluChip {
  return UNLU_CHIP_BY_ID.get(id) ?? UNLU_CHIPS[0]!
}

export const UNLU_CATEGORY_LABELS: Record<UnluCategoryId, string> = {
  sarkici: 'Şarkıcı',
  oyuncu: 'Oyuncu',
  sporcu: 'Sporcu',
  tarihi: 'Tarihî',
  dunya: 'Dünya ünlüleri',
}
