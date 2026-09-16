/**
 * Günlük cihaz gizlisinin tarayıcı tarafındaki deposu.
 *
 * Sunucu gizliyi ilk "Başla"da üretir; oyuncu hangi turda kaldığını sayfa
 * yenilense de bu anahtarla bulur. Veritabanında yalnızca özeti durur.
 *
 * ⚠️ `duelloAnahtar.ts`'teki gerekçeyle modül düzeyinde YEDEK var: depolama
 * engelliyse (Safari Gizli Gezinti) oturum en azından bu sayfa ömrü boyunca
 * sürer. Tam yenilemede kaybolur ve yeni bir girişsiz oturum açılır — bu
 * kabul edilen bir boşluk.
 */

const ANAHTAR = 'tahmin:gunluk:cihaz'
let bellek: string | null = null

export function cihazYaz(gizli: string): void {
  bellek = gizli
  try {
    window.localStorage.setItem(ANAHTAR, gizli)
  } catch {
    // Kalıcı olamadı; bellekteki kopya bu sayfa ömrü boyunca yeterli.
  }
}

export function cihazOku(): string | null {
  try {
    const kalici = window.localStorage.getItem(ANAHTAR)
    if (kalici) return kalici
  } catch {
    // Site verisi engelli olabilir; yedeğe düş.
  }
  return bellek
}
