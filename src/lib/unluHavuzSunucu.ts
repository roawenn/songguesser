import 'server-only'
import { unluChipById, type Difficulty, type UnluCategoryId, type UnluChipId } from '@/data/categories'
import type { Unlu } from '@/data/unlu'
import { restHeaders, restTumSatirlar } from '@/lib/supabase'

/**
 * Ünlü havuzunun sunucu tarafı — `api/unlu-havuz` ve Günlük hakemi okuyor.
 *
 * ⚠️ Rota dosyasından TAŞINDI: Next rota dosyalarından `GET` gibi tanıdığı
 * adlar dışında dışa aktarıma izin vermiyor, Günlük ise aynı okumaya muhtaç.
 */

/**
 * ⚠️ Supabase'den havuzun yeniden OKUNMA aralığı — tazelikle ilgisi yok.
 * Panelden kaydedince `revalidateTag('unluhavuz')` çalışıyor ve yayın anında.
 */
const SUPABASE_TAZELE = 3600

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

export async function unluSatirlari(chip: UnluChipId): Promise<Unlu[]> {
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
