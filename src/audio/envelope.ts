/**
 * Klip zarfı (envelope) matematiği.
 *
 * Buradaki tek fikir şu: 0,1 saniyelik bir klibi tık sesi olmadan çalmak için
 * zarfın omuzlarını klibin DIŞINA taşımak. Bunu, nominal pencereden önce
 * sessizlik altında "ön-yuvarlanma" (pre-roll) yaparak sağlıyoruz:
 *
 *   medya zamanı:  cs-PREROLL ········ cs ········· cs+len ········ +TAIL
 *   kazanç:        0 ───────────────╱‾‾ 1.0 (plato = tam `len`) ‾‾╲──────── 0
 *                      fade-in cs'TE biter     fade-out cs+len'DE başlar
 *
 * Böylece tam kazançtaki plato TAM OLARAK `len` saniyedir — arayüzün vaat
 * ettiği "0,1 saniye" budur. Fade süreleri klibi yemez, çünkü zaten pre-roll
 * bölgesinde harcanırlar.
 */

/** Girişte 5 ms — tık sesini engellemeye yeter, içeriği bozmaz. */
export const FADE_IN = 0.005

/** Çıkışta 12 ms — kulak ani kesilmeye girişten çok daha duyarlıdır. */
export const FADE_OUT = 0.012

/**
 * Pencereden önce sessizlik altında çalınan süre.
 *
 * ⚠️ Bu değer DOĞRUDAN algılanan gecikmedir. Ön-yuvarlanma sessiz çalındığı
 * için kullanıcı, düğmeye bastıktan sonra bu süre kadar ölü hava duyar.
 * Önceki 300 ms'lik değer, 0,5 saniyelik bir klipte sesin yarısını kaçırmış
 * gibi hissettiriyordu.
 *
 * 45 ms, saat hizalamasının tipik süresini (1-2 kare) karşılamaya yeter ve
 * pratik olarak duyulmaz. Hizalama bundan uzun sürerse motor pencereyi
 * kaçırdığını anlar ve klibi bulunduğu yerden başlatır (bkz. ClipPlayer).
 */
export const PREROLL = 0.045

/** Zarf bittikten sonra pause() öncesi güvenlik payı. */
export const TAIL = 0.1

/** Klip en erken burada başlayabilir — pre-roll için yer gerekiyor. */
export const MIN_CLIP_START = PREROLL + FADE_IN + 0.02 // 0,07 sn

/**
 * Havuza yeni giren şarkıların klip başlangıcı.
 *
 * ⚠️ {@link MIN_CLIP_START} ile karıştırma: o teknik ALT SINIR (0,07 sn),
 * bu ise küratör tercihi. Önizlemelerin ilk çeyrek saniyesi sık sık fade-in,
 * sayaç ya da tam sessizlik oluyor; 0,325 sn bunun ötesine geçer. Üç ayrı
 * dosyada elle yazılıydı, artık tek kaynak burası.
 */
export const DEFAULT_CLIP_START = 0.325

/** Merdivenin çıkabileceği en uzun klip. */
export const MAX_CLIP = 16

export interface ClipWindow {
  /** Elemanın seek edileceği medya zamanı. */
  seekTo: number
  /** Zarfın tam kazanca ulaştığı medya zamanı. */
  clipStart: number
  /** Tam kazançta geçirilecek süre. */
  length: number
  /** pause() çağrılana kadar geçecek toplam süre (t0'dan itibaren). */
  totalAfterStart: number
}

export function planClip(clipStart: number, length: number): ClipWindow {
  const cs = Math.max(clipStart, MIN_CLIP_START)
  return {
    seekTo: Math.max(0, cs - PREROLL),
    clipStart: cs,
    length,
    totalAfterStart: length + FADE_OUT + TAIL,
  }
}

/** Bir şarkının preview süresi bu merdiveni taşıyabiliyor mu? */
export function previewIsLongEnough(duration: number, clipStart: number, maxLen: number): boolean {
  return duration >= clipStart + maxLen + FADE_OUT + TAIL
}
