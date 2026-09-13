/**
 * Yanıt gövdesini GÜVENLE okur.
 *
 * ⚠️ `res.json()` her yerde `res.ok` kontrolünden ÖNCE çağrılıyordu. Sunucu
 * JSON dönmeyen bir hata verdiğinde — Vercel fonksiyon zaman aşımı, kenar
 * 502'si, Next'in HTML hata sayfası — `json()` fırlatıyor ve çağıran yerdeki
 * `if (!res.ok)` dalına hiç ulaşılamıyordu. Panelde bunun sonucu, hiçbir hata
 * mesajı olmadan sonsuza kadar süren bir "Yükleniyor…" ekranıydı.
 *
 * Burası her zaman bir nesne döndürür; JSON değilse gövdenin başını `error`
 * olarak taşır ki küratör en azından ne olduğunu görebilsin.
 */
export type Govde = Record<string, unknown> & { error?: string }

export async function govdeOku(res: Response): Promise<Govde> {
  const ham = await res.text().catch(() => '')
  if (!ham) return res.ok ? {} : { error: `Sunucu ${res.status} döndü.` }

  try {
    const j = JSON.parse(ham) as unknown
    return j && typeof j === 'object' ? (j as Govde) : { error: String(j) }
  } catch {
    // HTML hata sayfası: ilk satırı göstermek hiçbir şey göstermemekten iyi.
    const ozet = ham.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    return { error: `Sunucu ${res.status} döndü${ozet ? `: ${ozet}` : '.'}` }
  }
}
