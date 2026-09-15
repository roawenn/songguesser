import {
  UNLU_CHIPS, unluChipById, type UnluCategoryId, type UnluChipId, type Difficulty,
} from '@/data/categories'
import { UNLU_HAVUZ_SURUM, type Unlu } from '@/data/unlu'
import { restHeaders, restTumSatirlar, supabaseReady } from '@/lib/supabase'
import { sikistirilmisJson } from '@/lib/sikistir'

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

/**
 * ⚠️ Supabase'den havuzun yeniden OKUNMA aralığı — tazelikle ilgisi yok.
 * Panelden kaydedince `revalidateTag('unluhavuz')` çalışıyor ve yayın anında.
 */
const SUPABASE_TAZELE = 3600
/** Tarayıcı ve CDN tazelik ömrü. */
const ISTEMCI_TAZE = 60

interface UnluRow {
  id: string
  category: UnluCategoryId
  name: string
  norm_name: string
  accept_keys: string[]
  tier: Difficulty
  image_ver: number
}

const KOLONLAR = 'id,category,name,norm_name,accept_keys,tier,image_ver'

export function generateStaticParams() {
  return UNLU_CHIPS.map((c) => ({ chip: c.id }))
}

function toUnlu(r: UnluRow): Unlu {
  return {
    id: r.id,
    ad: r.name,
    d: r.tier,
    c: r.category,
    v: r.image_ver,
    nT: r.norm_name,
    // ⚠️ Ünlüde İKİNCİ AD YOK. Boş dize bırakılıyor ki `judgeGuess`'in
    // "sanatçı doğru" rozeti asla tetiklenmesin (bkz. `text/match.ts`).
    nA: '',
    k: r.accept_keys,
  }
}

async function supabasedenAl(chip: UnluChipId): Promise<Unlu[]> {
  const c = unluChipById(chip)
  const params = new URLSearchParams({
    select: KOLONLAR,
    enabled: 'eq.true',
    // ⚠️ Sıralama sayfalama için ŞART: sırasız sorguda planlayıcı sayfalar
    // arasında aynı satırı iki kez verebilir ya da atlayabilir.
    order: 'id.asc',
  })
  if (c.kategori) params.set('category', `eq.${c.kategori}`)

  const rows = await restTumSatirlar<UnluRow>(`unluler?${params}`, {
    headers: restHeaders(),
    next: { revalidate: SUPABASE_TAZELE, tags: ['unluhavuz'] },
  })
  return rows.map(toUnlu)
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
          unluler = await supabasedenAl(chip)
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
