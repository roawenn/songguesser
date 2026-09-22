import { CHIPS, chipById, type ChipId } from '@/data/categories'
import { ATTEMPTS, STEPS } from './ladder'
import type { Step } from './machine'

/**
 * Paylaşım kodu.
 *
 * Sonuç bir sayfaya değil bir URL'e sığar: `/paylas/<kod>`. Böylece Twitter
 * linki açtığında sunucu o koddan hem tweet kartını hem de görseli üretir —
 * hiçbir şey veritabanına yazılmaz, hiçbir şey saklanmaz.
 *
 * ⚠️ Ayırıcı `_`, `-` DEĞİL: `iki-binler` gibi seçki kimlikleri tire içeriyor.
 * Nokta da kullanılmaz, Next dinamik segmentte onu dosya uzantısı sanabilir.
 */

/** Kutu durumları — tek harf, URL'de okunaklı. */
export type Mark = 'dogru' | 'yanlis' | 'pas' | 'bos'

const TO_LETTER: Record<Mark, string> = { dogru: 'd', yanlis: 'y', pas: 'p', bos: 'b' }
const FROM_LETTER: Record<string, Mark> = { d: 'dogru', y: 'yanlis', p: 'pas', b: 'bos' }

export const EMOJI: Record<Mark, string> = {
  dogru: '🟩',
  yanlis: '🟥',
  pas: '⬜',
  bos: '⬛',
}

export interface ShareResult {
  chip: ChipId
  marks: Mark[]
  won: boolean
  /** Gerçekten duyulan en uzun klip (sn). 0 = hiç dinlemeden bildi. */
  heardSeconds: number
  listens: number
  /**
   * Turdaki şarkının kimliği — `itunes:1834674002`.
   *
   * ⚠️ İSTEĞE BAĞLI ve kodun BEŞİNCİ parçası. Story görseli "hangi şarkıydı"
   * kartını gösterebilsin diye eklendi; dört parçalı eski kodlar hâlâ
   * çözülüyor, yalnızca kart olmadan.
   *
   * ⚠️ Cevabı ifşa etmek burada sorun DEĞİL: paylaşan kişi o turu zaten
   * bitirmiş ve görseli kendisi paylaşıyor. URL tabanlı meydan okuma
   * kaldırıldığı için kimseye oynamadan cevap sızdırmıyor.
   */
  songId?: string
}

/** `itunes:123` → `123`. Başka biçimdeki kimlikler kodlanmaz. */
const ITUNES = /^itunes:(\d+)$/

/**
 * Turu beş kutuya çevirir: kademeyi tüketen her eylem bir kutu.
 *
 * ⚠️ Ölçüt "yanlış mı", "pas mı" DEĞİL. Eskiden pas olmayan her adım kırmızı
 * sayılıyordu; ipucu (`hint`) eklenince o da yanlış görünecekti. İpucu pas gibi
 * kademe yakıyor ama hak yakmıyor, dolayısıyla gri kutu. Paylaşım kodunun
 * biçimi bu yüzden DEĞİŞMEDİ — eski bağlantılar çözülmeye devam ediyor.
 */
export function marksOf(steps: Step[], won: boolean): Mark[] {
  return Array.from({ length: ATTEMPTS }, (_, i): Mark => {
    if (i < steps.length) return steps[i]!.kind === 'wrong' ? 'yanlis' : 'pas'
    if (i === steps.length && won) return 'dogru'
    return 'bos'
  })
}

export function encodeShare(r: ShareResult): string {
  const letters = r.marks.map((m) => TO_LETTER[m]).join('')
  // Saniye ondalıklı olabilir (0,5); onda birlik tamsayı olarak taşınır.
  const taban = `${r.chip}_${letters}_${Math.round(r.heardSeconds * 10)}_${r.listens}`
  const sayi = r.songId?.match(ITUNES)?.[1]
  return sayi ? `${taban}_${sayi}` : taban
}

export function decodeShare(kod: string): ShareResult | null {
  const parts = kod.split('_')
  // ⚠️ 4 parça ESKİ kodlar, 5. parça şarkı kimliği. Dördü de zorunlu.
  if (parts.length !== 4 && parts.length !== 5) return null
  const [chip, letters, dec, listens, sarki] = parts as [
    string,
    string,
    string,
    string,
    string | undefined,
  ]
  if (sarki !== undefined && !/^\d+$/.test(sarki)) return null

  /*
   * ⚠️ Kaldırılmış dönem çipleri BURADA hâlâ kabul ediliyor.
   *
   * `eskiler`, `doksanlar` ve `iki-binler` `CHIPS`'ten çıktı (dönem artık yıl
   * şeridinde). Ama bu kodlar sosyal medyada paylaşılmış linklerin içinde
   * yaşıyor ve tek satırlık bir kimlik kontrolü onları TAMAMEN çözülemez
   * yapıyordu: `/paylas/<kod>` skoru da, kutuları da göstermeyip "geçersiz
   * kod" diyordu. Seçki adı paylaşımın süsü, skoru ise özü — süs için özü
   * çöpe atmak yanlış. Eskiler `karisik` olarak çözülüyor.
   *
   * ⚠️ Doğrulama GEVŞETİLMEDİ: bilinmeyen rastgele bir metin yine reddedilir,
   * yalnızca bu üç kimlik açıkça tanınıyor.
   */
  const EMEKLI_CIPLER = new Set(['eskiler', 'doksanlar', 'iki-binler'])
  const emekli = EMEKLI_CIPLER.has(chip)
  if (!emekli && !CHIPS.some((c) => c.id === chip)) return null
  if (letters.length !== ATTEMPTS) return null

  const marks: Mark[] = []
  for (const ch of letters) {
    const m = FROM_LETTER[ch]
    if (!m) return null
    marks.push(m)
  }

  const tenths = Number(dec)
  const n = Number(listens)
  if (!Number.isFinite(tenths) || tenths < 0 || tenths > 600) return null
  if (!Number.isFinite(n) || n < 0 || n > 999) return null

  return {
    chip: (emekli ? 'karisik' : chip) as ChipId,
    marks,
    won: marks.includes('dogru'),
    heardSeconds: tenths / 10,
    listens: Math.round(n),
    ...(sarki ? { songId: `itunes:${sarki}` } : {}),
  }
}

/** "2 saniyede bildim" / "bilemedim" — tweet ve görsel aynı cümleyi kullanır. */
export function verdictLine(r: ShareResult): string {
  if (!r.won) return 'bilemedim'
  if (r.heardSeconds === 0) return 'hiç dinlemeden bildim'
  const sn = String(r.heardSeconds).replace('.', ',')
  return `${sn} saniyede bildim`
}

export function emojiLine(marks: Mark[]): string {
  return marks.map((m) => EMOJI[m]).join('')
}

export function chipLabel(chip: ChipId): string {
  return chipById(chip).label
}

export function chipHue(chip: ChipId): number {
  return chipById(chip).hue
}

/** Görselde ve kartta gösterilen merdiven: 0,5 → 1 → 2 → 5 → 10 */
export const LADDER_LABEL = STEPS.map((s) => String(s).replace('.', ',')).join(' → ')

/**
 * `oklch(L C H)` → `#rrggbb`.
 *
 * ⚠️ Satori (paylaşım görselini üreten motor) `oklch()` ANLAMAZ; desteklemediği
 * bir rengi sessizce siyaha çevirir. Sahnenin tüm renk sistemi hue tabanlı
 * olduğu için dönüşümü burada yapıyoruz, elle hex listesi tutmuyoruz —
 * yeni bir seçki eklendiğinde görsel kendiliğinden doğru renkte çıksın.
 */
export function oklchToHex(L: number, C: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  const hex = lin
    .map((v) => {
      const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055
      const n = Math.round(Math.min(1, Math.max(0, g)) * 255)
      return n.toString(16).padStart(2, '0')
    })
    .join('')

  return `#${hex}`
}

/** Seçkinin vurgu rengi — sahnedeki `--acc` ile aynı formül. */
export function accentHex(chip: ChipId): string {
  return oklchToHex(0.81, 0.12, chipHue(chip))
}
