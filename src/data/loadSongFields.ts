import type { Song } from './schema'

/**
 * Şarkının oynanabilirlik alanları — önizleme, kapak, mağaza bağlantısı.
 *
 * ⚠️ Bunlar toplu havuzdan ÇIKARILDI: 5089 satırlık yanıtın %60'ını üç URL
 * alanı kaplıyordu ve hiçbiri havuzun tamamı için gerekli değil. Ölçüm:
 * 3,04 MB → 1,16 MB ham.
 *
 * ⚠️ Tur kurulurken araya ağ adımı girmemesi için `useRound` sıradaki şarkının
 * alanlarını önden çekiyor; burada tutulan önbellek de bunu kalıcı kılıyor.
 * Değerler hiç değişmediği için oturum boyunca güvenle saklanabilir.
 */

export interface CalinabilirAlanlar {
  p: string
  ar: string
  u: string
}

const onbellek = new Map<string, CalinabilirAlanlar>()
/** Uçuştaki istekler — aynı id için ikinci istek atılmasın. */
const ucusta = new Map<string, Promise<void>>()

async function getir(ids: string[]): Promise<void> {
  const res = await fetch(`/api/sarki?ids=${encodeURIComponent(ids.join(','))}`)
  if (!res.ok) return
  const d = (await res.json()) as { sarkilar?: Record<string, CalinabilirAlanlar> }
  for (const [id, alan] of Object.entries(d.sarkilar ?? {})) onbellek.set(id, alan)
}

/** Önbellekte varsa anında döner; yoksa çeker. Hata hâlinde `null`. */
export async function alanlariAl(id: string): Promise<CalinabilirAlanlar | null> {
  const hit = onbellek.get(id)
  if (hit) return hit

  let bekleyen = ucusta.get(id)
  if (!bekleyen) {
    bekleyen = getir([id]).finally(() => ucusta.delete(id))
    ucusta.set(id, bekleyen)
  }
  await bekleyen
  return onbellek.get(id) ?? null
}

/** Sıradaki şarkı için arka planda doldur — sonucu beklenmez. */
export function alanlariIsit(id: string): void {
  if (onbellek.has(id) || ucusta.has(id)) return
  void alanlariAl(id).catch(() => undefined)
}

/** Şarkıyı alanlarıyla birleştirir. Alanlar yoksa şarkı olduğu gibi döner. */
export function birlestir(s: Song, alan: CalinabilirAlanlar | null): Song {
  return alan ? { ...s, ...alan } : s
}
