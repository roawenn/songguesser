/**
 * Sınırlı Damerau-Levenshtein mesafesi.
 *
 * Damerau (düz Levenshtein değil), çünkü yer değiştirme (transposition) mobil
 * yazımının 1 numaralı hatasıdır ve düz Levenshtein onu 2 düzenleme sayar:
 *   "gülpembe" → "gülpemeb"  gerçekte 1 hata, Levenshtein'a göre 2.
 *
 * `max` aşıldığı anda erken çıkar — tüm havuza karşı sorgu attığımız için önemli.
 */
export function damerau(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const w = b.length + 1
  let prev2 = new Array<number>(w)
  let prev = new Array<number>(w)
  let curr = new Array<number>(w)

  for (let j = 0; j < w; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let rowMin = curr[0]!
    for (let j = 1; j < w; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
      // yer değiştirme
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2]! + 1)
      }
      curr[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    const tmp = prev2
    prev2 = prev
    prev = curr
    curr = tmp
  }
  return prev[b.length]!
}

/**
 * Anahtar uzunluğuna göre izin verilen maksimum mesafe.
 *
 * ⚠️ `L <= 4` için SIFIR tolerans taşıyıcı bir karardır. Türkçe'de birbirinden
 * tek düzenleme uzaklıkta gerçek şarkı adlarının yoğunluğu olağandışı:
 * Sus / Sen, Gel / Gül, Dön / Don, Aşk / Ask, Yak / Yok, Git / Git.
 * Orada tek harflik esneklik oyunu "bozuk" hissettirir.
 */
export function maxDistanceFor(length: number, strict = false): number {
  if (strict) return length <= 6 ? 0 : 1
  if (length <= 4) return 0
  if (length <= 8) return 1
  if (length <= 14) return 2
  return 3
}
