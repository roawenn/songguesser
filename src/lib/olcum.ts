/**
 * Yükleme yolunun aşama işaretleri.
 *
 * Her işaret bir `performance.mark` bırakır: DevTools → Performance kaydında
 * "Timings" şeridinde `nk:` önekiyle görünür. Geliştirmede ayrıca konsola
 * (Verbose düzeyi) sayfa açılışından bu yana geçen süre yazılır.
 *
 * ⚠️ `performance.now()` gezinme başlangıcından sayar; yani yazılan değer
 * doğrudan "sayfa açıldıktan kaç ms sonra" demek. İlk turun hazır olma süresi
 * `hazir` işaretinin ilk değeri.
 *
 * Üretimde de mark bırakılıyor (maliyeti yok denecek kadar az) — canlı sitede
 * ölçüm yapabilmenin tek yolu bu.
 */
export function isaret(ad: string): void {
  if (typeof performance === 'undefined' || typeof window === 'undefined') return
  try {
    performance.mark(`nk:${ad}`)
  } catch {
    // Eski tarayıcı: ölçüm isteğe bağlı, oyun etkilenmesin.
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[ölçüm] ${ad} +${Math.round(performance.now())} ms`)
  }
}
