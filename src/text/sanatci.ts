/**
 * Sanatçı modunun kısa adı: `/sanatci/sezen-aksu`, `/?sanatci=sezen-aksu`.
 *
 * ⚠️ Kaynak GÖRÜNTÜ ADI (`a`) DEĞİL, normalize ad (`nA` / `norm_artist`).
 * O zaten Türkçe küçültme ve diyakritik katlamadan geçmiş durumda
 * (`cleanKey`); burada yeniden küçültme yapılmıyor — `toLowerCase()` bu
 * dosyanın dışında yasak ve Türkçe İ/ı'yı bozuyor. Aynı sanatçının farklı
 * yazımları ("Mfö", "MFÖ") böylece tek kısa ada düşüyor.
 *
 * ⚠️ Latin dışı harfler (Kiril, Arap) atılır. Kısa adı boş kalan sanatçı
 * sanatçı moduna alınmaz (bkz. `lib/sanatcilar.ts`).
 */
export function sanatciSlug(normAd: string): string {
  return normAd.trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** URL'den gelen kısa ad güvenle kullanılabilir mi? */
export function slugGecerli(s: string): boolean {
  return s.length > 0 && s.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
}
