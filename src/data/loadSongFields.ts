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

/**
 * ⚠️ ASLA REDDETMEZ. Ağ hatasında sözün reddi `alanlariAl`'a, oradan tur
 * kurulumuna sıçrıyordu: kurulum yarıda kesiliyor, `ARM` hiç gönderilmiyor ve
 * ekran sonsuza kadar "yükleniyor…" yazısında asılı kalıyordu (ölçüldü).
 * Sessiz dönüş, çağıranın "alan yok" dalını çalıştırmasını sağlıyor.
 */
async function getir(ids: string[]): Promise<void> {
  try {
    const res = await fetch(`/api/sarki?ids=${encodeURIComponent(ids.join(','))}`)
    if (!res.ok) return
    const d = (await res.json()) as { sarkilar?: Record<string, CalinabilirAlanlar> }
    for (const [id, alan] of Object.entries(d.sarkilar ?? {})) onbellek.set(id, alan)
  } catch {
    // Ağ hatası: önbellek boş kalır, çağıran başka şarkı dener.
  }
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
  try {
    await bekleyen
  } catch {
    // Paylaşılan söz reddedilmiş olabilir; "alan yok" ile aynı muamele.
  }
  return onbellek.get(id) ?? null
}

/**
 * Verilen kimlikleri arka planda doldurur — sonucu beklenmez.
 *
 * ⚠️ TEK istek atılır: tur kurulumunda iki aday ısıtılıyor (aynı kademe ve bir
 * üst kademe, bkz. `useRound`) ve ikisi için ayrı istek atmak, kazanılan
 * gidiş-dönüşün yarısını geri verirdi.
 *
 * ⚠️ Uçuştaki söz HER kimliğe ayrı ayrı bağlanmalı: yalnızca ilkine bağlansaydı
 * hemen ardından gelen `alanlariAl(ikinci)` çağrısı ikinci bir istek atardı.
 */
export function alanlariIsit(ids: string | string[]): void {
  const liste = (typeof ids === 'string' ? [ids] : ids).filter(
    (id) => !onbellek.has(id) && !ucusta.has(id),
  )
  if (liste.length === 0) return

  const soz = getir(liste).finally(() => {
    for (const id of liste) ucusta.delete(id)
  })
  soz.catch(() => undefined)
  for (const id of liste) ucusta.set(id, soz)
}

/**
 * Önbellekten SENKRON okur; ağa gitmez, yoksa `null`.
 *
 * ⚠️ Bunun senkron olması şart: "Sıradaki şarkı" dokunuşunun içinde, hiçbir
 * `await` olmadan indirmeyi başlatmak için kullanılıyor (iOS medya baytlarını
 * yalnızca gesture içinde çekiyor — bkz. `audio/context.ts`).
 */
export function alanlarOnbellekten(id: string): CalinabilirAlanlar | null {
  return onbellek.get(id) ?? null
}

/** Şarkıyı alanlarıyla birleştirir. Alanlar yoksa şarkı olduğu gibi döner. */
export function birlestir(s: Song, alan: CalinabilirAlanlar | null): Song {
  return alan ? { ...s, ...alan } : s
}
