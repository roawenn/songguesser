import { Terlik } from 'terlik.js'
import { leetAc } from '@/text/kullaniciAdi'

/**
 * Terlik ile uygunsuzluk denetimi — kullanıcı adına özel.
 *
 * ⚠️ İSTEMCİYE GİRMEMELİ: sözlük onlarca KB. Yalnızca giriş rotası
 * (`api/giris/google/donus`) içe aktarıyor; `server-only` yazılmadı çünkü
 * testler de gerçek sözlükle çalışıyor.
 *
 * ⚠️ Artık ELLE GİRİLEN adı değil, GOOGLE PROFİLİNDEKİ adı deniyor ve sonucu
 * sert: uygunsuz bulunursa hesap hiç açılmıyor (bkz. `adBelirle`).
 *
 * Bir ad birkaç biçimiyle denetleniyor: ham hâli, alt çizgileri boşluk
 * yapılmış hâli ("pic_kurusu" → iki kelime), rakamları atılmış hâli
 * ("shit99") ve leet açılmış hâli. Türkçe ve İngilizce sözlük ayrı örnekler.
 */

let tr: Terlik | null = null
let en: Terlik | null = null

export function uygunsuzMu(ad: string): boolean {
  tr ??= new Terlik({ language: 'tr', mode: 'balanced' })
  en ??= new Terlik({ language: 'en', mode: 'strict' })
  const bicimler = [...new Set([ad, ad.replace(/_/g, ' '), ad.replace(/[0-9_]+/g, ' ').trim(), leetAc(ad)])]
  return bicimler.some((b) => b.length > 0 && (tr!.containsProfanity(b) || en!.containsProfanity(b)))
}
