import { UNLU_CHIPS, type UnluChipId } from '@/data/categories'
import { UNLU_HAVUZ_SURUM, type Unlu } from '@/data/unlu'
import { supabaseReady } from '@/lib/supabase'
import { sikistirilmisJson } from '@/lib/sikistir'
import { unluSatirlari } from '@/lib/unluHavuzSunucu'

/**
 * Ünlü havuzu — `api/havuz/[chip]`'in kardeşi.
 *
 * ⚠️ Etiket `unluhavuz`, `havuz` DEĞİL. Ortak etiket her şarkı düzenlemesinde
 * 15 binlik şarkı havuzunun yeniden çekilmesine yol açardı (ve tersi).
 *
 * ⚠️ Statik disk YEDEĞİ YOK. `public/data/pool/*` yalnızca şarkılar için var
 * ve `pool:snapshot` ünlü üretmiyor. Supabase düşerse bu uç nokta boş dönüyor
 * ve kabuk hata ekranı gösteriyor. Bilinçli bir boşluk: havuz henüz küçük ve
 * her anlık görüntü depoya kopya bir görsel seti demek olurdu. Havuz büyüyünce
 * `snapshot.ts`'e ünlü dalı eklenebilir.
 */

/** Tarayıcı ve CDN tazelik ömrü. */
const ISTEMCI_TAZE = 60

export function generateStaticParams() {
  return UNLU_CHIPS.map((c) => ({ chip: c.id }))
}

export async function GET(req: Request, ctx: { params: Promise<{ chip: string }> }) {
  const { chip: raw } = await ctx.params
  const chip = (UNLU_CHIPS.find((c) => c.id === raw)?.id ?? 'unlu-karisik') as UnluChipId

  return sikistirilmisJson(
    req,
    `unlu-havuz:${chip}`,
    async () => {
      let unluler: Unlu[] = []
      let kaynak: 'supabase' | 'yok' = 'supabase'

      if (supabaseReady) {
        try {
          unluler = await unluSatirlari(chip)
        } catch {
          kaynak = 'yok'
        }
      } else {
        kaynak = 'yok'
      }

      return { v: UNLU_HAVUZ_SURUM, chip, kaynak, unluler }
    },
    {
      'Cache-Control': `public, max-age=${ISTEMCI_TAZE}, s-maxage=${ISTEMCI_TAZE}, stale-while-revalidate=600`,
    },
  )
}
