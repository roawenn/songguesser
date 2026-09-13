import type { Unlu } from './unlu'
import type { UnluChipId } from './categories'

/**
 * `loadPool.ts`'in ünlü karşılığı — aynı dersler geçerli.
 *
 * ⚠️ Önbellekte DİZİ değil SÖZ tutuluyor. Dizi tutulduğunda, aynı çip için üst
 * üste binen iki çağrı (havuzu erken ısıtan çağrı ile turu kuran çağrı) iki
 * ayrı ağ isteği atıyordu.
 */
const cache = new Map<UnluChipId, Promise<Unlu[]>>()

export async function loadUnluChip(id: UnluChipId): Promise<Unlu[]> {
  const hit = cache.get(id)
  if (hit) return hit

  const istek = (async () => {
    const res = await fetch(`/api/unlu-havuz/${id}`)
    if (!res.ok) throw new Error(`Ünlü havuzu yüklenemedi: ${id}`)

    const data = (await res.json()) as { unluler: Unlu[]; kaynak: string }
    const unluler = data.unluler.filter((u) => u.off !== 1)

    /**
     * ⚠️ Supabase'e ulaşılamadıysa sonuç önbelleğe ALINMAZ. Şarkı tarafında
     * tek bir geçici hata, oyuncuyu sekmenin ömrü boyunca bayat bir havuza
     * sabitliyordu; burada yedek bile yok, yani boş havuza sabitlerdi.
     */
    if (data.kaynak !== 'supabase') cache.delete(id)

    return unluler
  })()

  cache.set(id, istek)
  // Başarısız istek önbellekte kalırsa çip bir daha hiç yüklenemez.
  istek.catch(() => cache.delete(id))
  return istek
}

/** Kabuk parçası inmeden havuzu indirmeye başlat (bkz. `loadPool.havuzuIsit`). */
export function unluHavuzuIsit(id: UnluChipId): void {
  void loadUnluChip(id).catch(() => {
    // Gerçek hata, turu kuran çağrıda ele alınıyor.
  })
}
