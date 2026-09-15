
/**
 * Düello — iki kişi, aynı 5 şarkı, kolaydan zora.
 *
 * Bu dosya SAF: ağ, React ve Supabase yok. Kod üretimi, puanlama ve kazanan
 * kararı burada durur ki testlenebilsin (`vitest` yalnızca `.ts` topluyor).
 */

/** Düellodaki şarkı sayısı — kademe 1'den 5'e, her kademeden bir tane. */
export const DUELLO_TUR = 5

/**
 * Lobi kodu alfabesi.
 *
 * ⚠️ `0/O`, `1/I/l` ve `U` YOK: kod telefonda okunup elle yazılabiliyor ve
 * karışan harfler doğrudan "lobi bulunamadı" demek. `U` de Türkçe'de kaba bir
 * kelimeye denk gelme ihtimali yüzünden elendi.
 */
const ALFABE = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const KOD_UZUNLUK = 6

/** Kodun biçim olarak geçerli olup olmadığı — veritabanına gitmeden önce. */
export function kodGecerli(kod: string): boolean {
  if (kod.length !== KOD_UZUNLUK) return false
  for (const ch of kod) if (!ALFABE.includes(ch)) return false
  return true
}

/**
 * Yeni lobi kodu.
 *
 * ⚠️ `Math.random` DEĞİL: kod tahmin edilebilirse bir yabancı başkasının
 * lobisine girip oyunu bozabilir. 6 karakter × 30 harf ≈ 729 milyon.
 */
export function kodUret(rastgele: (n: number) => Uint8Array): string {
  const bayt = rastgele(KOD_UZUNLUK)
  let out = ''
  for (let i = 0; i < KOD_UZUNLUK; i++) {
    // ⚠️ 256 % 30 ≠ 0, yani düz modülo ilk 16 harfi hafifçe kayırır. Kod
    // gizlilik değil çakışmama işi gördüğü için bu sapma kabul edilebilir;
    // yine de not düşülüyor ki "rastgele" sanılmasın.
    out += ALFABE[bayt[i]! % ALFABE.length]
  }
  return out
}

/** Düellonun hangi oyunu oynadığı. */
export type DuelloOyun = 'sarki' | 'unlu' | 'kapak'

/**
 * Bir oyuncunun tek turdaki sonucu.
 *
 * ⚠️ `maliyet` ve `ikincil` OYUNDAN BAĞIMSIZ ölçütler; ikisinde de AZ olan
 * iyidir. Şarkı: duyulan saniye ve dinleme sayısı. Ünlü: açılan şerit ve 0.
 *
 * Eski adları (`heardSeconds`, `listens`) korumak, ünlü turunda "duyulan
 * saniye" diye bir alana şerit sayısı yazmak olurdu — sessiz bir aşırı
 * yükleme ve ilk bakan kişiyi yanıltacak bir isim.
 */
export interface DuelloCevap {
  slot: 1 | 2
  songIndex: number
  won: boolean
  maliyet: number
  ikincil: number
}

export interface DuelloSkor {
  dogru: number
  /** Doğru bilinen turlarda toplam maliyet — az olan iyi. */
  maliyet: number
  ikincil: number
  /** Kaç turu hiç cevaplamadı (bıraktı ya da süresi doldu). */
  eksik: number
}

/**
 * Bir oyuncunun skoru.
 *
 * ⚠️ Cevaplanmamış şarkı KAYIP sayılır, yoksa oyunu ortasında bırakan kişi
 * "hiç yanlışım yok" diye üstün çıkardı. Sunucuya sahte bir kayıp yazmak
 * yerine eksikliği burada yorumluyoruz — yazma yolu ne kadar dar kalırsa
 * o kadar iyi.
 */
export function skorla(
  cevaplar: DuelloCevap[],
  slot: 1 | 2,
  turSayisi: number = DUELLO_TUR,
): DuelloSkor {
  const benim = cevaplar.filter((c) => c.slot === slot)
  const dogrular = benim.filter((c) => c.won)
  return {
    dogru: dogrular.length,
    maliyet: dogrular.reduce((n, c) => n + c.maliyet, 0),
    ikincil: benim.reduce((n, c) => n + c.ikincil, 0),
    eksik: turSayisi - benim.length,
  }
}

export type DuelloSonuc = 'sen' | 'rakip' | 'berabere'

/**
 * Kazananı belirler.
 *
 * Sıra: daha çok doğru → daha az maliyet → daha az ikincil.
 * "En çok bilen, eşitse en ucuza bilen" kuralı bu. Şarkıda maliyet duyulan
 * saniye, ünlüde açılan şerit — mantık ikisinde de aynı.
 */
export function kazanan(benim: DuelloSkor, rakip: DuelloSkor): DuelloSonuc {
  if (benim.dogru !== rakip.dogru) return benim.dogru > rakip.dogru ? 'sen' : 'rakip'
  if (benim.maliyet !== rakip.maliyet) return benim.maliyet < rakip.maliyet ? 'sen' : 'rakip'
  if (benim.ikincil !== rakip.ikincil) return benim.ikincil < rakip.ikincil ? 'sen' : 'rakip'
  return 'berabere'
}

/**
 * Rakip cevap vermiyorsa bu süre sonunda tek taraflı ilerlenir — yoksa oyunu
 * bırakan kişi diğerini sonsuza kadar ekranda tutar.
 */
export const BEKLEME_SINIRI_MS = 90_000


