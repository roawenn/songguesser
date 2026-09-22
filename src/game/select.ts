import { MIN_PLAYABLE, yilById, type Difficulty, type YilId } from '@/data/categories'

/**
 * Bu modülün havuzdan okuduğu TEK alanlar.
 *
 * ⚠️ `Song` yerine yapısal tip: ikinci oyun (ünlü tanıma) aynı seçim ve
 * süzme mantığını kullanıyor ama `Song` değil. Gövde hiç değişmedi — yalnızca
 * tip daraltıldı, `Song` bu şekli zaten sağlıyor.
 */
export interface Secilebilir {
  id: string
  /** Zorluk kademesi. */
  d: Difficulty
}

/**
 * Havuzu seçili zorluk kademesine göre süzer.
 *
 * Kademe tam eşleşmeyle başlar ("Kolay" = yalnızca kademe 1). Küratörlük o
 * kategoride henüz inceyse komşu kademeler kademeli olarak eklenir — oyuncuya
 * beş şarkının döngüye girdiği bir seçki vermektense biraz daha geniş ama
 * oynanabilir bir havuz vermek daha iyi.
 */
export function filterByTier<T extends Secilebilir>(
  pool: readonly T[],
  tier: Difficulty,
  min = MIN_PLAYABLE,
): T[] {
  let lo: number = tier
  let hi: number = tier
  let out = pool.filter((s) => s.d >= lo && s.d <= hi)

  /**
   * ⚠️ Her adımda TEK kademe genişletilir ve sonuç hemen yeniden hesaplanır.
   *
   * Burada fazladan bir `hi++` daha vardı ve koşulu BAYAT `out`u okuyordu —
   * yani genişletmenin etkisi ölçülmeden ikinci kez genişletiliyordu. Sonuç:
   * `[1,2]` penceresi hiç denenmeden `[1,3]`e atlanıyordu. "Kolay" seçen
   * oyuncuya, yeterli sayıda kolay+orta şarkı olmasına rağmen "Zor" şarkılar
   * karışıyordu. İnce seçkilerde (sanat 33, fantezi 34, halk 41) her turda
   * yaşanıyordu.
   */
  while (out.length < min && (lo > 1 || hi < 5)) {
    if (lo > 1) lo--
    else hi++
    out = pool.filter((s) => s.d >= lo && s.d <= hi)
  }

  return out
}

/**
 * Yıl boyutunun süzülebilir şekli — `Secilebilir` ile aynı gerekçeyle yapısal.
 * Hem `Song` hem albüm kaydı `y` taşıyor.
 */
export interface Yillanabilir {
  /** Orijinal çıkış yılı. */
  y: number
}

/**
 * Havuzu seçili yıl eşiğine göre süzer.
 *
 * ⚠️ `filterByTier`'DEN ÖNCE çağrılır. Sıra tersine dönerse kademe
 * genişletmesi yıl dilimini AŞAR: "Bu yıl + Sanat Müziği" gibi ince bir
 * hücrede `filterByTier` komşu kademeleri katarken 1970'lerden şarkı
 * getirebilir ve oyuncunun açık seçimi sessizce çiğnenirdi. Doğru sıra
 * `filterByTier(filterByYear(havuz, yil), kademe)`.
 *
 * ⚠️ Genişletme YOK — kasıtlı. Kademe boşsa komşusunu katmak makul
 * (etiketler yakın), ama yılda öyle değil: "Bu yıl" diyen oyuncuya 2003
 * vermek istediğinin tersi. İnce hücre kilitlemiyor, yalnızca tekrar
 * ediyor ve arayüz bunu söylüyor.
 */
export function filterByYear<T extends Yillanabilir>(
  pool: readonly T[],
  yil: YilId,
): T[] {
  const esik = yilById(yil).esik
  if (esik === null) return [...pool]

  if (esik === 'yeni') {
    // ⚠️ En yeni yıl havuzdan türetilir, sabit değil: takvim yılı geçtiğinde
    // seçenek kendiliğinden kayar (bkz. `YILLAR`).
    if (pool.length === 0) return []
    let enYeni = -Infinity
    for (const s of pool) if (s.y > enYeni) enYeni = s.y
    return pool.filter((s) => s.y === enYeni)
  }

  return pool.filter((s) => s.y >= esik)
}

/**
 * Kazanınca çıkılacak kademe: ÜSTTEKİ İLK DOLU kademe.
 *
 * ⚠️ Yalnızca `kademe + 1` demek yetmiyor. Kademe tam eşleştiğinde (bkz.
 * `filterByTier`'in `min: 0` kullanımı) bir üst kademe boş olabilir ve oyuncu
 * kazandığı anda "bu zorlukta kimse yok" ekranına düşerdi — galibiyetin ödülü
 * duvara çarpmak olurdu. Boş kademeler atlanıyor; yukarıda dolu kademe yoksa
 * oyuncu bulunduğu kademede kalıyor.
 */
export function sonrakiDoluKademe<T extends Secilebilir>(
  pool: readonly T[],
  tier: Difficulty,
): Difficulty {
  for (let t = tier + 1; t <= 5; t++) {
    if (pool.some((s) => s.d === t)) return t as Difficulty
  }
  return tier
}

export interface Pick<T extends Secilebilir = Secilebilir> {
  /** ⚠️ Alan adı `song` KALIYOR: çağrı yerleri değişmesin. */
  song: T
  /** Havuz tükendiği için tekrar sayacı sıfırlandı mı? */
  recycled: boolean
}

/**
 * Havuzdan, oturumda henüz çalınmamış bir şarkı seçer.
 * Havuz tükenirse sayaç sıfırlanır ve döngü yeniden başlar.
 */
export function pickNext<T extends Secilebilir>(
  pool: readonly T[],
  played: ReadonlySet<string>,
  rand: () => number = Math.random,
): Pick<T> | null {
  if (pool.length === 0) return null

  let available = pool.filter((s) => !played.has(s.id))
  let recycled = false
  if (available.length === 0) {
    available = [...pool]
    recycled = true
  }

  const song = available[Math.floor(rand() * available.length)]!
  return { song, recycled }
}
