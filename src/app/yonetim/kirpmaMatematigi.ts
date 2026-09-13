/**
 * Ünlü görselinin çerçeveye oturtulması — saf matematik.
 *
 * ⚠️ Bileşenden AYRI bir `.ts` dosyası, tercih değil zorunluluk: `vitest`
 * yalnızca `src/**\/*.test.ts` topluyor ve `environment: 'node'` — `.tsx` de
 * canvas da yok. Matematik burada durmazsa hiç test edilemez.
 *
 * Model: çerçeve SABİT (3:5). Küratör fotoğrafı içinde kaydırır, yakınlaştırır
 * ve 90°'lik adımlarla döndürür. Şerit sınırları hiç oynamaz — beş eşit beşte
 * bir. Bu bilinçli: küratörün ayarlayacağı tek şey fotoğrafın kendisi olsun,
 * her görsel için dört ayırıcı sürüklemek ekleme hızını öldürürdü.
 */

export interface Konum {
  /** Çerçeve merkezine göre kaydırma (çerçeve pikseli). */
  x: number
  y: number
  /** 1 = görsel çerçeveyi tam dolduruyor. */
  olcek: number
  /** Yalnızca 0 / 90 / 180 / 270. */
  aci: 0 | 90 | 180 | 270
}

export const BASLANGIC: Konum = { x: 0, y: 0, olcek: 1, aci: 0 }

/** 90° ve 270°'de görselin genişliği ile yüksekliği yer değiştirir. */
export function donukBoyut(g: number, y: number, aci: Konum['aci']): [number, number] {
  return aci === 90 || aci === 270 ? [y, g] : [g, y]
}

/**
 * Görseli çerçeveyi TAM DOLDURACAK en küçük çarpan (`object-fit: cover`).
 *
 * Bunun altına inilirse kenarlarda boşluk kalır; boş bir şerit, oyuncuya ipucu
 * yerine arka plan gösterir.
 */
export function doldurOlcegi(
  imgG: number,
  imgY: number,
  kareG: number,
  kareY: number,
  aci: Konum['aci'] = 0,
): number {
  const [g, y] = donukBoyut(imgG, imgY, aci)
  if (g <= 0 || y <= 0) return 1
  return Math.max(kareG / g, kareY / y)
}

/**
 * Konumu geçerli aralığa çeker: görsel çerçeveyi her zaman tam kaplasın.
 *
 * ⚠️ Ölçek önce kelepçelenir, sonra kaydırma — tersi sırada, küçültülmüş bir
 * görselde kaydırma sınırı negatif çıkıp fotoğrafı çerçeveden dışarı atıyordu.
 */
export function kelepcele(
  k: Konum,
  imgG: number,
  imgY: number,
  kareG: number,
  kareY: number,
): Konum {
  const [g, y] = donukBoyut(imgG, imgY, k.aci)
  const enAz = doldurOlcegi(imgG, imgY, kareG, kareY, k.aci)
  const olcek = Math.max(enAz, k.olcek)

  // Görselin çerçevede kapladığı gerçek boyut.
  const gercekG = g * olcek
  const gercekY = y * olcek

  // Merkezden en fazla ne kadar kaydırılabilir (yarım taşma).
  const sinirX = Math.max(0, (gercekG - kareG) / 2)
  const sinirY = Math.max(0, (gercekY - kareY) / 2)

  return {
    x: Math.min(sinirX, Math.max(-sinirX, k.x)),
    y: Math.min(sinirY, Math.max(-sinirY, k.y)),
    olcek,
    aci: k.aci,
  }
}

/**
 * Canvas'a çizim adımları.
 *
 * Sıra ÖNEMLİ: merkeze taşı → kaydır → döndür → ölçekle → görseli kendi
 * merkezinden çiz. Başka bir sırada döndürme kaydırmayı da döndürür ve
 * fotoğraf sürüklendiği yönün tersine gider.
 */
export interface CizimAdimi {
  /** Çerçeve merkezine taşıma. */
  merkezX: number
  merkezY: number
  /** Kullanıcının kaydırması. */
  kaydirX: number
  kaydirY: number
  /** Radyan. */
  donus: number
  olcek: number
  /** Görselin kendi merkezinden çizilmesi için sol üst köşe. */
  cizX: number
  cizY: number
}

export function cizimAdimi(
  k: Konum,
  imgG: number,
  imgY: number,
  kareG: number,
  kareY: number,
  /** Çıktı çerçeveden büyükse (900x1500 dışa aktarım) oran. */
  carpan = 1,
): CizimAdimi {
  const kel = kelepcele(k, imgG, imgY, kareG, kareY)
  return {
    merkezX: (kareG / 2) * carpan,
    merkezY: (kareY / 2) * carpan,
    kaydirX: kel.x * carpan,
    kaydirY: kel.y * carpan,
    donus: (kel.aci * Math.PI) / 180,
    olcek: kel.olcek * carpan,
    cizX: -imgG / 2,
    cizY: -imgY / 2,
  }
}

/**
 * `serit` numaralı şeridin (1 tabanlı) çerçeve içindeki dikey aralığı, yüzde.
 *
 * Oyun tarafı da aynı hesaba dayanıyor: açık şerit sayısı `n` iken görünen
 * bölge üstten `n * 20%`. Önizlemenin oyunla birebir aynı olması için tek
 * kaynak burası.
 */
export function seritAraligi(serit: number, toplam: number): { ust: number; alt: number } {
  const pay = 100 / toplam
  return { ust: (serit - 1) * pay, alt: 100 - serit * pay }
}

/** Açık şerit sayısına göre `clip-path: inset(...)` değeri. */
export function acikKirpma(acilan: number, toplam: number): string {
  const kapali = Math.max(0, toplam - acilan)
  return `inset(0 0 ${(kapali * 100) / toplam}% 0)`
}
