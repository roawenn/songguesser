/**
 * Tohumlu rastgele sayı üreteci.
 *
 * Günlük setin seçimi aynı tohumla her çalıştırmada AYNI sonucu vermeli:
 * iki lambda aynı saniyede seti kurmaya kalkarsa ikisi de aynı öğeleri seçer,
 * ve testler deterministik olur. `pickNext` / `judgeGuess` zaten `rand`'ı
 * dışarıdan alıyor; bu üreteç oraya takılıyor.
 *
 * xmur3 dizeyi 32 bitlik tohuma çevirir, mulberry32 o tohumdan dizi üretir.
 * Kriptografik DEĞİL — tohum gizli tuz içerdiği için tahmin edilemezlik
 * oradan geliyor, üreteçten değil.
 */

function xmur3(dize: string): () => number {
  let h = 1779033703 ^ dize.length
  for (let i = 0; i < dize.length; i++) {
    h = Math.imul(h ^ dize.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

function mulberry32(tohum: number): () => number {
  let a = tohum
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `[0, 1)` aralığında, tohuma bağlı sabit bir dizi üretir. */
export function tohumluRastgele(tohum: string): () => number {
  return mulberry32(xmur3(tohum)())
}
