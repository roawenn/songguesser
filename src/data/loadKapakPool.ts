import type { Kapak } from './kapak'
import type { ChipId } from './categories'

/**
 * `loadPool.ts`'in kapak karşılığı — aynı dersler geçerli.
 *
 * ⚠️ Önbellekte DİZİ değil SÖZ tutuluyor: aynı çip için üst üste binen iki
 * çağrı (havuzu erken ısıtan ile turu kuran) iki ayrı ağ isteği atıyordu.
 */
const cache = new Map<ChipId, Promise<Kapak[]>>()

export async function loadKapakChip(id: ChipId): Promise<Kapak[]> {
  const hit = cache.get(id)
  if (hit) return hit

  const istek = (async () => {
    const res = await fetch(`/api/kapak-havuz/${id}`)
    if (!res.ok) throw new Error(`Kapak havuzu yüklenemedi: ${id}`)

    const data = (await res.json()) as { kapaklar: Kapak[]; kaynak: string }

    // ⚠️ Supabase'e ulaşılamadıysa sonuç önbelleğe ALINMAZ (yedeği yok).
    if (data.kaynak !== 'supabase') cache.delete(id)

    return data.kapaklar
  })()

  cache.set(id, istek)
  istek.catch(() => cache.delete(id))
  return istek
}

/** Kabuk parçası inmeden havuzu indirmeye başlat (bkz. `loadPool.havuzuIsit`). */
export function kapakHavuzuIsit(id: ChipId): void {
  void loadKapakChip(id).catch(() => {
    // Gerçek hata, turu kuran çağrıda ele alınıyor.
  })
}
