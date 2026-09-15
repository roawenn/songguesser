/**
 * Yanlış tahminde kısa sarsıntı (`.nk-sars`, globals.css).
 *
 * ⚠️ Sınıf kaldırılıp hemen geri eklenirse animasyon YENİDEN BAŞLAMAZ —
 * tarayıcı iki değişikliği tek stil hesabında birleştiriyor. Araya zorlanmış
 * bir yeniden akış (`offsetWidth`) koymak gerekiyor.
 */
export function sars(el: HTMLElement | null, reduce: boolean): void {
  if (!el || reduce) return
  el.classList.remove('nk-sars')
  void el.offsetWidth
  el.classList.add('nk-sars')
}
