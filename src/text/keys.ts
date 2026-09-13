import { prepare, collapse, stripParens } from './normalize'
import { stripNoise } from './noise'

/**
 * Bir metnin gürültüden arındırılmış, sıkıştırılmış karşılaştırma biçimi.
 * Sıra önemli: hazırla → parantez sil → gürültü sil → sıkıştır.
 */
export function cleanKey(s: string): string {
  return collapse(stripNoise(prepare(stripParens(s))))
}

/** Parantezleri koruyan biçim — bazı başlıklarda parantez gerçekten adın parçası. */
export function fullKey(s: string): string {
  return collapse(prepare(s))
}

export interface KeyInput {
  title: string
  artist: string
  aliases?: string[]
}

/**
 * Bir şarkının kabul edilecek tüm yazımları.
 *
 * ⚠️ Sanatçı adı TEK BAŞINA asla kabul anahtarı değildir — yoksa "Ceza" yazan
 * herkes Ceza'nın her şarkısını bilmiş sayılırdı.
 * Başlık tek başına kabul edilir; telefon klavyesinde her turda sanatçı+başlık
 * yazdırmak eziyettir.
 */
export function buildKeys({ title, artist, aliases = [] }: KeyInput): string[] {
  const tFull = fullKey(title)
  const tBase = collapse(prepare(stripParens(title)))
  const tClean = cleanKey(title)
  const aClean = cleanKey(artist)

  const keys = [tFull, tBase, tClean]

  /*
   * ⚠️ `tClean` BOŞ olabilir: noktalama dışında harf içermeyen başlıklar
   * ("[.]", "?") normalize edilince hiçbir şey bırakmıyor. Koşulsuz birleştirme
   * `" replikas"` ve `"replikas "` gibi boşluk dolgulu anahtarlar üretiyordu —
   * `k.length > 0` süzgecini geçiyorlar ama oyuncunun yazdığı metin daima
   * kırpılmış geldiği için hiçbiriyle TAM eşleşemiyor. Sonuç: şarkı yalnızca
   * bulanık eşleşmenin insafına kalıyor, başlığı ise hiç yazılamıyor.
   */
  if (aClean && tClean) {
    keys.push(`${tClean} ${aClean}`, `${aClean} ${tClean}`)
  }

  for (const alias of aliases) {
    const k = cleanKey(alias)
    if (k) keys.push(k)
  }

  return [...new Set(keys.filter((k) => k.length > 0))]
}
