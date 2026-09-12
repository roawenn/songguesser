/**
 * Klip merdiveni.
 *
 * Tasarım (theme/Nakarat.dc.html) bunu sabitler: beş kademe, beş hak.
 * Her kademe aynı noktadan başlar — kademeler İÇ İÇEDİR, yoksa oyuncu bilgi
 * biriktiremez ve "kademeli açılım" fikri çöker.
 */
export const STEPS: readonly number[] = [0.5, 1, 2, 5, 10]

/** Merdivenin en uzun kademesi — preview süresi doğrulaması için. */
export const MAX_STEP = STEPS[STEPS.length - 1]!

/** Toplam hak sayısı. */
export const ATTEMPTS = STEPS.length

/** Türkçe ondalık ayırıcı virgüldür: 0.5 → "0,5" */
export function tr(n: number | string): string {
  return String(n).replace('.', ',')
}
