import { ATTEMPTS } from './ladder'

/**
 * Düello — iki kişi, aynı 5 şarkı, kolaydan zora.
 *
 * Bu dosya SAF: ağ, React ve Supabase yok. Kod üretimi, puanlama ve kazanan
 * kararı burada durur ki testlenebilsin (`vitest` yalnızca `.ts` topluyor).
 */

/** Düellodaki şarkı sayısı — kademe 1'den 5'e, her kademeden bir tane. */
export const DUELLO_SARKI = 5

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

/** Bir oyuncunun tek şarkıdaki sonucu. */
export interface DuelloCevap {
  slot: 1 | 2
  songIndex: number
  won: boolean
  heardSeconds: number
  listens: number
}

export interface DuelloSkor {
  dogru: number
  /** Doğru bilinen şarkılarda duyulan toplam saniye — az olan iyi. */
  sure: number
  listens: number
  /** Kaç şarkıyı hiç cevaplamadı (bıraktı ya da süresi doldu). */
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
export function skorla(cevaplar: DuelloCevap[], slot: 1 | 2): DuelloSkor {
  const benim = cevaplar.filter((c) => c.slot === slot)
  const dogrular = benim.filter((c) => c.won)
  return {
    dogru: dogrular.length,
    sure: dogrular.reduce((n, c) => n + c.heardSeconds, 0),
    listens: benim.reduce((n, c) => n + c.listens, 0),
    eksik: DUELLO_SARKI - benim.length,
  }
}

export type DuelloSonuc = 'sen' | 'rakip' | 'berabere'

/**
 * Kazananı belirler.
 *
 * Sıra: daha çok doğru → daha az duyulan saniye → daha az dinleme.
 * "En çok bilen, eşitse en kısa sürede bilen" kuralı bu.
 */
export function kazanan(benim: DuelloSkor, rakip: DuelloSkor): DuelloSonuc {
  if (benim.dogru !== rakip.dogru) return benim.dogru > rakip.dogru ? 'sen' : 'rakip'
  if (benim.sure !== rakip.sure) return benim.sure < rakip.sure ? 'sen' : 'rakip'
  if (benim.listens !== rakip.listens) return benim.listens < rakip.listens ? 'sen' : 'rakip'
  return 'berabere'
}

/**
 * Sıradaki şarkıya geçilebilir mi?
 *
 * İki oyuncu da cevapladıysa geçilir. Rakip cevap vermiyorsa
 * {@link BEKLEME_SINIRI} sonrasında tek taraflı ilerlenir — yoksa oyunu
 * bırakan kişi diğerini sonsuza kadar ekranda tutar.
 */
export const BEKLEME_SINIRI_MS = 90_000

export function ilerleyebilir(
  cevaplar: DuelloCevap[],
  songIndex: number,
  benimSlot: 1 | 2,
  bekleyenSure: number,
): boolean {
  const bu = cevaplar.filter((c) => c.songIndex === songIndex)
  const ben = bu.some((c) => c.slot === benimSlot)
  if (!ben) return false
  const rakip = bu.some((c) => c.slot !== benimSlot)
  return rakip || bekleyenSure >= BEKLEME_SINIRI_MS
}

/** Merdivenin en uzun kademesi kadar duyan biri aslında "hiç bilememiş" gibidir. */
export const EN_UZUN_ADIM = ATTEMPTS - 1
