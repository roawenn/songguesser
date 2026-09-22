import {
  YILLAR,
  chipById,
  yilById,
  type ChipId,
  type Difficulty,
  type YilId,
} from '@/data/categories'

/**
 * Kademe dilimi ve başlangıç paketinin SAF parçaları — sunucu modülünden ayrı,
 * çünkü `server-only` testte içe aktarılamıyor (bkz. `kapakHavuz` ayrımı).
 */

/** Başlangıç paketinde gelen şarkı sayısı. */
export const BASLANGIC_ADET = 24

/**
 * `?kademe=` değerini okur. Geçersizse `null` — rota o zaman TAM havuzu döner.
 *
 * ⚠️ Sıkı: `"3abc"`, `"3.5"`, `"03"` kabul edilmez. Her farklı yazım ayrı bir
 * CDN önbellek anahtarı demek; gevşek ayrıştırma aynı dilimi birden çok kez
 * ürettirir.
 */
export function kademeOku(ham: string | null): Difficulty | null {
  return ham !== null && /^[1-5]$/.test(ham) ? (Number(ham) as Difficulty) : null
}

/**
 * `?yil=` değerini okur. Geçersizse `null` — rota o zaman yıl süzmez.
 *
 * ⚠️ `kademeOku` ile aynı sıkılıkta ve aynı gerekçeyle: her farklı yazım ayrı
 * bir CDN önbellek anahtarı.
 */
export function yilOku(ham: string | null): YilId | null {
  return ham !== null && YILLAR.some((y) => y.id === ham) ? (ham as YilId) : null
}

/**
 * Seçkinin veritabanı süzgeci — `baslangic_sec` RPC'sinin parametreleri.
 *
 * ⚠️ `havuzSunucu`'daki `source.kind` eşlemesiyle AYNI olmalı: başlangıç
 * paketindeki şarkılar dilimin alt kümesi değilse, dilim gelince tur kurulumu
 * adayı tanımaz ve boşuna yeni şarkı seçer. Yıl eklenince bu kural İKİ KAT
 * önemli hâle geldi: varsayılan "Bu yıl" ile tam havuzdan gelen 24 şarkının
 * ortalama yarısı bile o yıldan olmazdı, yani paket tamamen boşa giderdi.
 *
 * `enYeniYil` yalnızca `yil === 'yeni'` için gerekir; bilinmiyorsa (`null`)
 * yıl süzgeci uygulanmaz — paket geniş gelir, istemci `filterByYear` ile
 * kendi diliminde zaten daraltır.
 */
export function seckiParametreleri(
  chip: ChipId,
  yil: YilId,
  enYeniYil: number | null,
): {
  p_kategori: string | null
  p_min_yil: number | null
  p_tek_yil: number | null
} {
  const source = chipById(chip).source
  const esik = yilById(yil).esik
  return {
    p_kategori: source.kind === 'genre' ? source.genre : null,
    p_min_yil: typeof esik === 'number' ? esik : null,
    p_tek_yil: esik === 'yeni' ? enYeniYil : null,
  }
}
