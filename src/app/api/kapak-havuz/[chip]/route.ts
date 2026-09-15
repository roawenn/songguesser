import { CHIPS, type ChipId } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import { grupla } from '@/lib/kapakHavuz'
import { kapakSatirlari } from '@/lib/kapakHavuzSunucu'
import { supabaseReady } from '@/lib/supabase'
import { sikistirilmisJson } from '@/lib/sikistir'

/**
 * Kapaktan Albüm oyununun havuzu — ALBÜM başına tek kayıt (bkz. `lib/kapakHavuz`).
 *
 * `api/havuz` deseni: kenar önbelleği (`havuz` etiketi — panelden şarkı eklenince
 * bu da tazeleniyor), `Range` sayfalama, seçki süzgeci. Satır okuma düelloyla
 * paylaşıldığı için `lib/kapakHavuzSunucu.ts`'te.
 *
 * ⚠️ Yedek (disk) YOK: albüm verisi yalnızca veritabanında.
 */

const REVALIDATE_SECONDS = 60

export function generateStaticParams() {
  return CHIPS.map((c) => ({ chip: c.id }))
}

export async function GET(req: Request, ctx: { params: Promise<{ chip: string }> }) {
  const { chip: raw } = await ctx.params
  const chip = (CHIPS.find((c) => c.id === raw)?.id ?? 'karisik') as ChipId

  return sikistirilmisJson(
    req,
    `kapak-havuz:${chip}`,
    async () => {
      let kapaklar: Kapak[] = []
      let kaynak: 'supabase' | 'yok' = 'supabase'
      if (supabaseReady) {
        try {
          kapaklar = grupla(await kapakSatirlari(chip))
        } catch {
          kaynak = 'yok'
        }
      } else {
        kaynak = 'yok'
      }

      return { chip, kaynak, kapaklar }
    },
    {
      'Cache-Control': `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
    },
  )
}
