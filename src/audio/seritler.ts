/**
 * Şerit kararları — saf, testli. Ses motoru bunları çağırıyor (bkz. `deck.ts`,
 * `ClipPlayer.ts`); burada DOM yok, böylece node ortamında test edilebiliyorlar.
 */

export interface SeritDurumu {
  /** Şeritte yüklü olan kaynak; hiç yüklenmediyse null. */
  kaynak: string | null
  hataVar: boolean
  duraklamis: boolean
}

export interface YuklemeDurumu {
  kaynak: string | null
  url: string
  hataVar: boolean
  /** `HTMLMediaElement.readyState` */
  readyState: number
  /** `el.buffered.length` */
  bufferliAralik: number
  crossOrigin: string | null
}

/**
 * Şeride `src` yazıp `load()` çağırmak gerekiyor mu?
 *
 * ⚠️ `load()` mevcut arabelleği SİLER. Aynı şarkı önyüklenmişken (prefetch) bunu
 * yapmak, önyüklemeyi tamamen boşa çıkarıyordu: ses ikinci kez indiriliyordu.
 *
 * ⚠️ Yine de zorunlu kalan durumlar var; `false` dönmek şunlarda YANLIŞ olurdu:
 *   - farklı URL,
 *   - `el.error` dolu (medya elemanı kalıcı hata durumunda; yalnızca `load()` temizler),
 *   - `readyState === 0` (önceki yükleme yarıda kesilmiş; arabellek zaten yok),
 *   - `buffered` boş (iOS arka planda medya arabelleğini boşaltabiliyor),
 *   - `crossOrigin` beklenenden farklı (TUZAK 3 — CORS'suz istek SESSİZLİK üretir).
 */
export function yenidenYuklenmeli(d: YuklemeDurumu): boolean {
  if (d.kaynak !== d.url) return true
  if (d.hataVar) return true
  if (d.readyState < 1) return true
  if (d.bufferliAralik === 0) return true
  if (d.crossOrigin !== 'anonymous') return true
  return false
}

/**
 * Hangi şerit etkin olmalı?
 *
 * ⚠️ Eskiden `swapLanes()` vardı: körlemesine takas. Çağıran, boştaki şeridin
 * doğru şarkıyı tutup tutmadığını bilmiyordu — kazanınca kademe yükseldiği için
 * orada YANLIŞ aday duruyordu ve takas hazır arabelleği çöpe atıyordu. Üstelik
 * ikinci bir tıklama takası geri alıyordu.
 *
 * Artık karar veriye dayanıyor: URL'i zaten tutan ve çalmayan şerit varsa o,
 * yoksa boştaki şerit.
 */
export function seritSec(aktif: number, seritler: readonly SeritDurumu[], url: string): number {
  const bos = aktif === 0 ? 1 : 0
  const esles = seritler.findIndex((s) => s.kaynak === url && !s.hataVar && s.duraklamis)
  return esles >= 0 ? esles : bos
}
