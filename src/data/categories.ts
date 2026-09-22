/**
 * Kategori ve seviye modeli.
 *
 * Tasarım (theme/Nakarat.dc.html) tür ve dönemi TEK bir yatay şeritte
 * karıştırıyordu. Artık iki ayrı şerit var: üstte YIL (`YILLAR`), altta TÜR
 * (`CHIPS`). Böylece ikisi birlikte seçilebiliyor; eskiden biri diğerini
 * dışlıyordu.
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

export type ChipId = 'karisik' | CategoryId

// --- Yıl şeridi ---
//
// ⚠️ Yıl, türün RAKİBİ değil DİK BOYUTUDUR. Eskiden "Eskiler / 90'lar /
// 2000'ler" tür çipleriyle aynı şeritte KARDEŞ çiplerdi: oyuncu ya tür ya dönem
// seçebiliyordu, ikisi birden değil. Yıl kendi şeridine çıkınca "2020 sonrası
// rap" gibi kesişimler mümkün oldu.
//
// ⚠️ Eşikler KÜMÜLATİF ("ve sonrası"), tek bir on yıl değil. Ayrık on yıllar
// canlı veride kullanılamaz hâlde: rap×80'ler 0 şarkı, rap×70'ler 2. Kümülatifte
// en dar hücre bile (sanat 2020+) 127 şarkı.
//
// Tek istisna `yeni`: yalnızca havuzdaki EN YENİ yıl. Oyuncuların çoğu bugünün
// şarkılarını oynamak istiyor, o yüzden varsayılan bu.

export type YilId = 'yeni' | '2020' | '2010' | '2000' | '1990' | 'tumu'

export interface YilSecenegi {
  id: YilId
  label: string
  /**
   * `number` → o yıl ve sonrası. `'yeni'` → yalnızca havuzun en yeni yılı.
   * `null` → süzme yok.
   *
   * ⚠️ En yeni yıl SABİT YAZILMAZ. "2026" yazılsaydı seçenek önümüzdeki yıl
   * sessizce "geçen yıl" olurdu; havuzdan türetiliyor (bkz. `enYeniYil`).
   */
  esik: number | 'yeni' | null
}

/** Şerit sırası ekrandaki sırayla aynı: en yeni SOLDA. */
export const YILLAR: readonly YilSecenegi[] = [
  { id: 'yeni', label: 'Bu yıl', esik: 'yeni' },
  { id: '2020', label: '2020+', esik: 2020 },
  { id: '2010', label: '2010+', esik: 2010 },
  { id: '2000', label: '2000+', esik: 2000 },
  { id: '1990', label: '90+', esik: 1990 },
  { id: 'tumu', label: 'Tümü', esik: null },
]

export const VARSAYILAN_YIL: YilId = 'yeni'

const YIL_BY_ID = new Map(YILLAR.map((y) => [y.id, y]))

export function yilById(id: YilId): YilSecenegi {
  return YIL_BY_ID.get(id) ?? YILLAR[0]!
}

/**
 * Çip ya bir tür havuzundan ya da tüm havuzlardan beslenir.
 *
 * ⚠️ Üçüncü bir varyant (`{ kind: 'eras' }`) VARDI ve bilinçli olarak
 * kaldırıldı: dönem artık çip değil, kendi şeridinde dik bir boyut
 * (bkz. `YILLAR`). Varyantı tipten silmek, süzgeci sunucuda arayan eski
 * dalların derleme hatası vermesini sağladı — sessizce ölü kalmalarını değil.
 */
export type ChipSource = { kind: 'all' } | { kind: 'genre'; genre: CategoryId }

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
