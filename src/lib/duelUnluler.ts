import 'server-only'
import type { Unlu } from '@/data/unlu'
import type { Difficulty, UnluCategoryId } from '@/data/categories'
import { restUrl, restHeaders } from '@/lib/supabase'

interface Satir {
  id: string
  category: UnluCategoryId
  name: string
  norm_name: string
  accept_keys: string[]
  tier: Difficulty
  image_ver: number
}

/**
 * Kimliklerine göre ünlüleri getirir — SIRAYI KORUYARAK.
 *
 * ⚠️ `duelSongs.ts`'in aynısı ve aynı sebeple: PostgREST `in.()` sonuçları
 * istediği sırada döndürüyor, düelloda sıra ise kademe rampasının kendisi
 * (1→5). Yeniden dizilmezse iki oyuncu farklı zorluk sırası görürdü.
 */
export async function loadUnlulerByIds(ids: string[]): Promise<Unlu[]> {
  if (ids.length === 0) return []
  const liste = ids.map((i) => `"${encodeURIComponent(i)}"`).join(',')
  const res = await fetch(
    restUrl(
      `unluler?select=id,category,name,norm_name,accept_keys,tier,image_ver&id=in.(${liste})`,
    ),
    { headers: restHeaders({ secret: true }), cache: 'no-store' },
  )
  if (!res.ok) return []

  const byId = new Map(
    ((await res.json()) as Satir[]).map((r) => [
      r.id,
      {
        id: r.id,
        ad: r.name,
        d: r.tier,
        c: r.category,
        v: r.image_ver,
        nT: r.norm_name,
        // ⚠️ Ünlüde ikinci ad yok — boş bırakılmalı, yoksa `judgeGuess`
        // "sanatçı doğru" rozetini yanlışlıkla gösterir.
        nA: '',
        k: r.accept_keys,
      } satisfies Unlu,
    ]),
  )
  return ids.map((i) => byId.get(i)).filter((u): u is Unlu => Boolean(u))
}
