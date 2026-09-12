import { TIERS, type Difficulty } from '@/data/categories'
import { decodeShare, encodeShare, type ShareResult } from './share'

/**
 * Meydan okuma kodu — "bunu kaç saniyede bilirsin?"
 *
 * Günlük mod olmadığı için viral döngüyü kuran tek şey bu: paylaşılan link
 * arkadaşa AYNI şarkıyı oynatır, sonunda iki sonuç yan yana görünür.
 *
 * Biçim, mevcut sonuç kodunun sonuna iki alan ekler:
 *
 *     chip_harfler_tenths_listens          ← paylaşım kodu (share.ts)
 *     chip_harfler_tenths_listens_kademe_sarkiRef   ← meydan okuma kodu
 *
 * ⚠️ `decodeShare` TAM dört parça bekliyor ve testleri var. Sözleşmesi
 * değiştirilmiyor: burada parçalar ayrılıp ilk dördü yeniden birleştirilerek
 * ona veriliyor, kalan ikisi burada doğrulanıyor.
 */

/**
 * ⚠️ ÖNCE TEHDİT MODELİ — bu bir güvenlik sınırı DEĞİLDİR.
 *
 * Havuzun tamamı zaten istemciye iniyor: `/api/havuz/<çip>` her şarkının adını
 * (`t`), sanatçısını (`a`) ve kabul anahtarlarını (`k`) JSON olarak veriyor.
 * DevTools'u açan biri cevabı her hâlükârda bulur — hangi kodlamayı seçersek
 * seçelim. Dolayısıyla burada "şifreleme" diye bir iddia yok.
 *
 * Gerçekten koruduğumuz şey şu, ve bu da yeterince değerli:
 *
 *   Linkin METNİ cevabı sızdırmasın — WhatsApp önizlemesi, OG kartı, adres
 *   çubuğu, kopyalanıp yapıştırılan dize. Hiçbirinde şarkı adı ya da tahmin
 *   edilebilir bir kimlik görünmesin.
 *
 * Bu, `share.ts`'teki "şarkı adı ASLA metne girmez" ilkesinin devamı.
 *
 * ⚠️ Bunun üstüne puan, ödül ya da liderlik tablosu İNŞA ETME. Öyle bir şey
 * gerekirse tek doğru yol sunucu tarafında doğrulamadır.
 *
 * Sunucuda `challenges` tablosu ve HMAC seçenekleri de değerlendirildi. İkisi
 * de yukarıdaki gerçeği değiştirmediği için ek makineyi hak etmiyor: tablo
 * herkese açık bir yazma yolu açardı, HMAC ise dönen bir sırra bağlı olduğu
 * için sır değişince dünyadaki bütün meydan okuma linklerini sessizce
 * öldürürdü. Sabit bir kaydırma hem kalıcı hem bedava.
 */
const SONG_OFFSET = 1_729_404_137

/**
 * ⚠️ Bit işleci YOK. JavaScript'te `^` ve `|` sayıyı int32'ye indirger;
 * havuzdaki en büyük iTunes kimliği 6.784.751.987, yani 2³¹'in çok üstünde ve
 * böyle bir dönüşüm onu sessizce bozardı. Toplama güvenli tamsayı sınırına
 * (2⁵³) kadar kayıpsız.
 */
export function encodeSongRef(songId: string): string | null {
  const m = /^itunes:(\d+)$/.exec(songId)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isSafeInteger(n) || n <= 0) return null
  return (n + SONG_OFFSET).toString(36)
}

export function decodeSongRef(ref: string): string | null {
  // `parseInt` baştaki geçerli kısmı alıp gerisini yutar; tam eşleşme şart.
  if (!/^[0-9a-z]{1,12}$/.test(ref)) return null
  const n = Number.parseInt(ref, 36)
  if (!Number.isSafeInteger(n)) return null
  const id = n - SONG_OFFSET
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return `itunes:${id}`
}

export interface Challenge {
  /** Meydan okuyanın sonucu — kutular, süre, dinleme sayısı. */
  result: ShareResult
  /**
   * Meydan okuyanın oynadığı kademe.
   *
   * ⚠️ YALNIZCA GÖSTERİM İÇİN. Alıcının kademesine UYGULANMAZ: `tier`
   * kalıcı bir ayar (`nakarat:ayarlar:v3`) ve bir arkadaşın linki oyuncunun
   * kendi ayarını kalıcı olarak değiştirmemeli. Şarkı zaten sabitlendiği için
   * turu kurmaya da gerekmiyor.
   */
  tier: Difficulty
  /** Sabitlenen şarkının kimliği. */
  songId: string
}

export function encodeChallenge(c: Challenge): string | null {
  const ref = encodeSongRef(c.songId)
  if (!ref) return null
  return `${encodeShare(c.result)}_${c.tier}_${ref}`
}

export function decodeChallenge(kod: string): Challenge | null {
  const parts = kod.split('_')
  if (parts.length !== 6) return null

  // İlk dördü paylaşım kodunun kendisi; doğrulamayı ona bırak.
  const result = decodeShare(parts.slice(0, 4).join('_'))
  if (!result) return null

  const tier = Number(parts[4])
  if (!TIERS.some((t) => t.id === tier)) return null

  const songId = decodeSongRef(parts[5]!)
  if (!songId) return null

  return { result, tier: tier as Difficulty, songId }
}

/** Karşılaştırma sonucu — sonuç kartındaki iki satırın hangisinin kazandığı. */
export type Outcome = 'sen' | 'arkadas' | 'berabere'

/**
 * Kazananı belirleyen ölçü DUYULAN SÜRE, deneme sayısı değil.
 *
 * İki yanlış tahminden sonra yarım saniyeyle bilmek hâlâ yarım saniyelik bir
 * iştir; oyunun kendi övgü metinleri de (`ResultPanel`) aynı ölçüyü kullanıyor.
 * Eşitlikte daha az dinleyen kazanır.
 */
export function compareResults(mine: ShareResult, theirs: ShareResult): Outcome {
  if (mine.won !== theirs.won) return mine.won ? 'sen' : 'arkadas'
  if (!mine.won) return 'berabere'

  if (mine.heardSeconds !== theirs.heardSeconds) {
    return mine.heardSeconds < theirs.heardSeconds ? 'sen' : 'arkadas'
  }
  if (mine.listens !== theirs.listens) {
    return mine.listens < theirs.listens ? 'sen' : 'arkadas'
  }
  return 'berabere'
}
