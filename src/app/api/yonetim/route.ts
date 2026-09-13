import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import {
  CATEGORY_IDS, eraForYear, type CategoryId, type Difficulty,
} from '@/data/categories'
import { isAuthed, adminConfigured } from '@/lib/adminAuth'
import { ADMIN_COLUMNS, restUrl, restHeaders, type SongRow, restTumSatirlar } from '@/lib/supabase'

/**
 * Yönetim paneli veri uç noktası — Supabase üzerinde CRUD.
 *
 * Her istek yönetici çerezini ister. Yazma işlemleri secret key ile yapılır
 * (RLS'i baypas eder) ve **yalnızca sunucuda** çalışır; tarayıcıya hiçbir
 * zaman gitmez. Kayıttan sonra `havuz` etiketi geçersizleştiği için değişiklik
 * oyunda anında görünür.
 *
 * PATCH ve DELETE hem tek `id` hem de `ids` dizisi kabul eder: "seçili 12
 * şarkıyı kademe 4 yap" tek istekte olur.
 */

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

function publish() {
  // Oyunun okuduğu önbelleği tazele: yayın anında olsun.
  revalidateTag('havuz')
}

/** Tek id ya da id dizisi → PostgREST filtresi. */
function idFilter(ids: string[]): string {
  if (ids.length === 1) return `id=eq.${encodeURIComponent(ids[0]!)}`
  // ⚠️ Virgül ve parantez `in.()` sözdiziminin parçası; id'ler tırnak içine
  // alınmazsa "itunes:123" gibi değerler bile ayrıştırıcıyı şaşırtabilir.
  return `id=in.(${ids.map((i) => `"${encodeURIComponent(i)}"`).join(',')})`
}

function readIds(source: Record<string, unknown> | URLSearchParams): string[] {
  const raw =
    source instanceof URLSearchParams
      ? (source.get('ids') ?? source.get('id') ?? '').split(',')
      : Array.isArray(source.ids)
        ? (source.ids as unknown[])
        : [source.id]
  return [...new Set(raw.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

export async function GET(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const cat = new URL(req.url).searchParams.get('kategori')
  /**
   * ⚠️ Sayfalama ŞART, `limit` yükseltmek YETMEZ.
   *
   * PostgREST bu projede 1000 satırda kesiyor (`db-max-rows`) ve sorgudaki
   * `limit` bunu değiştirmiyor. Havuz 5089 satırken panel yalnızca ilk 1000'i
   * görüyordu: kalan satırlar düzenlenemiyor, silinemiyor, `existing` tekrar
   * kümesine girmediği için `AddPanel` onları "yeni" diye öneriyor ve ekleme
   * `songs_norm_uidx`'e çarpıyordu.
   */
  const params = new URLSearchParams({
    select: ADMIN_COLUMNS,
    order: 'tier.asc,artist.asc,title.asc,id.asc',
  })
  if (cat && CATEGORY_IDS.includes(cat as CategoryId)) {
    params.set('category', `eq.${cat}`)
  }

  try {
    const rows = await restTumSatirlar<SongRow>(`songs?${params}`, {
      headers: restHeaders({ secret: true }) as Record<string, string>,
      cache: 'no-store',
    })
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 })
  }
}

/** Şarkı(ları) günceller: zorluk, yıl, kategori, açık/kapalı. */
export async function PATCH(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const ids = readIds(body)
  if (ids.length === 0) return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })

  /*
   * Yalnızca beklenen alanlar, beklenen aralıkta.
   *
   * ⚠️ `Number.isInteger` ŞART. Yoktu ve `{"tier": 3.7}` doğrulamayı geçip
   * `int` sütuna gidiyordu: Postgres reddediyor, küratör ham Supabase hata
   * metniyle bir 502 görüyor ve iyimser arayüz `3.7`yi zaten göstermiş oluyordu.
   */
  const patch: Record<string, unknown> = {}
  const tier = Number(body.tier)
  if (Number.isInteger(tier) && tier >= 1 && tier <= 5) patch.tier = tier as Difficulty
  const year = Number(body.year)
  if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
    patch.year = year
    // ⚠️ Dönem yıldan TÜRETİLİR; ikisi elle ayrı ayrı verilirse tutarsızlaşır.
    patch.era = eraForYear(year)
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.category === 'string' && CATEGORY_IDS.includes(body.category as CategoryId)) {
    patch.category = body.category
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
  }

  const res = await fetch(restUrl(`songs?${idFilter(ids)}`), {
    method: 'PATCH',
    headers: { ...restHeaders({ secret: true }), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text()
    // Kategori taşımada norm tekillik indeksine takılmak beklenen bir durum.
    const friendly = text.includes('songs_norm_uidx')
      ? 'Bu şarkı hedef kategoride zaten var.'
      : `Supabase ${res.status}: ${text}`
    return NextResponse.json({ error: friendly }, { status: 502 })
  }

  publish()
  return NextResponse.json({ ok: true, rows: await res.json() })
}

export async function DELETE(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const ids = readIds(new URL(req.url).searchParams)
  if (ids.length === 0) return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })

  const res = await fetch(restUrl(`songs?${idFilter(ids)}`), {
    method: 'DELETE',
    headers: restHeaders({ secret: true }),
  })
  if (!res.ok) {
    return NextResponse.json(
      { error: `Supabase ${res.status}: ${await res.text()}` },
      { status: 502 },
    )
  }

  publish()
  return NextResponse.json({ ok: true, silinen: ids.length })
}
