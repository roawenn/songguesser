/**
 * Şarkı başlıklarındaki "gürültü" eklerinin temizliği.
 *
 * Tasarım kuralı: bir gürültü kelimesi ASLA başlığın ortasından veya tamamından
 * silinmez — yalnızca güvenli konumlarda silinir. Aksi halde gerçekten "Remix"
 * ya da "Canlı" adlı bir şarkı yok edilirdi.
 *
 * Güvenli konumlar:
 *   1. `feat` / `ft` / `düet` kalıbı  → oradan sona kadar (kalanı katılımcılar)
 *   2. Bir ayraçtan (-, –, /, |) sonra gelen segment gürültü kelimesiyle BAŞLIYORSA
 *   3. Sondaki yalın yıl  ("... 2011")
 *
 * Girdi, katlanmış (diyakritiksiz) ama HENÜZ SIKIŞTIRILMAMIŞ metindir —
 * ayraçların hâlâ yerinde olması gerekir.
 */

/** Kalanın tamamını götüren kalıplar: katılımcı listeleri. */
const FEATURE_RE = /\s(?:feat|ft|featuring|with|duet|duett)\b[\s.]*.*$/i

/** Bir ayraçtan sonra gelirse o segmenti ve sonrasını götüren kelimeler (katlanmış hâlleriyle). */
const NOISE_HEADS = [
  'remix', 'mix', 'edit', 'extended', 'club', 'live', 'canli', 'konser',
  'akustik', 'acoustic', 'unplugged', 'enstrumantal', 'instrumental',
  'versiyon', 'version', 'orijinal', 'original', 'remaster', 'remastered',
  'yeniden', 'deluxe', 'bonus', 'karaoke', 'demo', 'cover', 'single',
  'soundtrack', 'potpuri', 'mastered', 'mono', 'stereo',
]

const SEPARATOR_RE = /\s[-\u2013\u2014/|]\s/

const TRAILING_YEAR_RE = /\s(?:19|20)\d{2}\s*$/

/**
 * Gürültü eklerini temizler. Sonuç boş kalırsa orijinali döndürür —
 * "Remix" adlı bir şarkıyı hiçliğe indirgememek için.
 */
export function stripNoise(folded: string): string {
  let out = folded.replace(FEATURE_RE, '')

  // Ayraçla bölünmüş segmentleri soldan sağa gez; gürültüyle başlayan ilk
  // segmentten itibaren kes.
  const parts = out.split(SEPARATOR_RE)
  if (parts.length > 1) {
    const kept: string[] = [parts[0]!]
    for (let i = 1; i < parts.length; i++) {
      const firstWord = parts[i]!.trim().split(/\s+/)[0] ?? ''
      if (NOISE_HEADS.includes(firstWord)) break
      kept.push(parts[i]!)
    }
    out = kept.join(' ')
  }

  out = out.replace(TRAILING_YEAR_RE, '')

  const trimmed = out.trim()
  return trimmed.length > 0 ? trimmed : folded
}
