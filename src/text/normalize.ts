/**
 * Türkçe-güvenli metin normalizasyonu.
 *
 * ⚠️ Bu dosya, projede `.toLowerCase()` / `.toLocaleLowerCase()` çağırmasına
 * izin verilen TEK yerdir. Sebebi:
 *
 *   "İSTANBUL".toLowerCase()  →  "i̇stanbul"   (i + U+0307 birleşen nokta!)
 *   "ILGIN".toLowerCase()     →  "ilgin"      (doğrusu: "ılgın")
 *
 * Görünmez fazladan bir kod noktası, sonraki her karşılaştırmayı sessizce bozar.
 */

/** Küçültmeden ÖNCE uygulanan açık eşleme — runtime'ın ICU derlemesine güvenmemek için. */
const PRE_LOWER: Record<string, string> = {
  '\u0130': 'i', // İ  (noktalı büyük I)
  '\u0049': '\u0131', // I  → ı (noktasız küçük i)
  '\u00CE': 'i', // Î
  '\u00C2': 'a', // Â
  '\u00DB': 'u', // Û
}

/** Karşılaştırma anahtarı için diyakritik katlama. Gösterim için ASLA kullanılmaz. */
const FOLD: Record<string, string> = {
  '\u0131': 'i', // ı → i  (KASITLI: oyuncular sürekli "sarki" yazar)
  '\u015F': 's', // ş
  '\u011F': 'g', // ğ
  '\u00FC': 'u', // ü
  '\u00F6': 'o', // ö
  '\u00E7': 'c', // ç
  '\u00E2': 'a', // â
  '\u00EE': 'i', // î
  '\u00FB': 'u', // û
}

const APOSTROPHES = /[\u2019\u2018\u02BC\u00B4`\u0060]/g

/**
 * Türkçe-güvenli küçültme. `toLowerCase()` yerine HER ZAMAN bu kullanılır.
 */
export function turkishLower(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\u0130I\u00CE\u00C2\u00DB]/g, (c) => PRE_LOWER[c] ?? c)
    .toLocaleLowerCase('tr-TR')
}

/**
 * Diyakritikleri katlar. Önce açık Türkçe eşlemesi, sonra yabancı isimler
 * (José, Beyoncé) için genel NFD + birleşen-işaret temizliği.
 */
export function foldDiacritics(s: string): string {
  const explicit = s.replace(
    /[\u0131\u015F\u011F\u00FC\u00F6\u00E7\u00E2\u00EE\u00FB]/g,
    (c) => FOLD[c] ?? c,
  )
  return explicit.normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC')
}

/** Parantez ve köşeli ayraç içeriğini siler: "Şarkı (Remastered 2011)" → "Şarkı" */
export function stripParens(s: string): string {
  return s.replace(/[([{][^)\]}]*[)\]}]/g, ' ')
}

/**
 * Noktalama → boşluk, boşlukları sıkıştır, kırp. Rakamlar korunur.
 * Kesme işareti bu aşamada zaten silinmiş olur.
 */
export function collapse(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Küçültme + kesme temizliği + diyakritik katlama — AMA sıkıştırma YOK.
 *
 * Ayraçlar (-, –, /, |) yerinde kalır, çünkü gürültü temizliği (`stripNoise`)
 * onlara bakarak karar verir. Sıkıştırma her zaman en son gelir.
 */
export function prepare(s: string): string {
  const lowered = turkishLower(s)
  const noApostrophe = lowered.replace(APOSTROPHES, '').replace(/'/g, '')
  return foldDiacritics(noApostrophe)
}

/**
 * Gevşek karşılaştırma anahtarı.
 * "Kalbim Ege'de Kaldı" → "kalbim egede kaldi"
 */
export function normalizeLoose(s: string): string {
  return collapse(prepare(s))
}

