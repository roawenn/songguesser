import { chipById, type ChipId, type Difficulty } from '@/data/categories'

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
 * Seçkinin veritabanı süzgeci — `baslangic_sec` RPC'sinin parametreleri.
 *
 * ⚠️ `api/havuz`'daki `source.kind` eşlemesiyle AYNI olmalı: başlangıç
 * paketindeki şarkılar dilimin alt kümesi değilse, dilim gelince tur kurulumu
 * adayı tanımaz ve boşuna yeni şarkı seçer.
 */
export function seckiParametreleri(chip: ChipId): {
  p_kategori: string | null
  p_donemler: string[] | null
} {
  const source = chipById(chip).source
  return {
    p_kategori: source.kind === 'genre' ? source.genre : null,
    p_donemler: source.kind === 'eras' ? [...source.eras] : null,
  }
}
