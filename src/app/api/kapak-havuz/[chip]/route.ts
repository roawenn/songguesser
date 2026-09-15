import { NextResponse } from 'next/server'
import { chipById, CHIPS, type ChipId } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import { grupla, type KapakSatiri } from '@/lib/kapakHavuz'
import { restHeaders, restTumSatirlar, supabaseReady } from '@/lib/supabase'

/**
 * Kapaktan Albüm oyununun havuzu — ALBÜM başına tek kayıt (bkz. `lib/kapakHavuz`).
 *
 * `api/havuz` deseni: kenar önbelleği (`havuz` etiketi — panelden şarkı eklenince
 * bu da tazeleniyor), `Range` sayfalama, seçki süzgeci.
 *
 * ⚠️ Yedek (disk) YOK: albüm verisi yalnızca veritabanında.
 */

const SUPABASE_TAZELE = 3600
const REVALIDATE_SECONDS = 60

export function generateStaticParams() {
  return CHIPS.map((c) => ({ chip: c.id }))
}

async function satirlar(chip: ChipId): Promise<KapakSatiri[]> {
  const source = chipById(chip).source
  const params = new URLSearchParams({
    select: 'id,artist,album,store_url,year,tier,category,norm_artist',
    enabled: 'eq.true',
    album: 'not.is.null',
    // Sayfalamanın tutarlı olması için sıra ŞART (bkz. `api/havuz`).
    order: 'id.asc',
  })
  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)
  else if (source.kind === 'eras') params.set('era', `in.(${source.eras.join(',')})`)

  return restTumSatirlar<KapakSatiri>(`songs?${params}`, {
    headers: restHeaders() as Record<string, string>,
    next: { revalidate: SUPABASE_TAZELE, tags: ['havuz'] },
  })
}

export async function GET(_req: Request, ctx: { params: Promise<{ chip: string }> }) {
  const { chip: raw } = await ctx.params
  const chip = (CHIPS.find((c) => c.id === raw)?.id ?? 'karisik') as ChipId

  let kapaklar: Kapak[] = []
  let kaynak: 'supabase' | 'yok' = 'supabase'
  if (supabaseReady) {
    try {
      kapaklar = grupla(await satirlar(chip))
    } catch {
      kaynak = 'yok'
    }
  } else {
    kaynak = 'yok'
  }

  return NextResponse.json(
    { chip, kaynak, kapaklar },
    {
      headers: {
        'Cache-Control': `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    },
  )
}
