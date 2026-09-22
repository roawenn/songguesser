import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import {
  UNLU_CATEGORY_IDS, type Difficulty, type UnluCategoryId,
} from '@/data/categories'
import { yonetimKoru } from '@/lib/yonetimKoru'
import { restUrl, restHeaders, restTumSatirlar } from '@/lib/supabase'
import { storageSil, storageYukle, UNLU_KOVA } from '@/lib/storage'
import { cleanKey, buildKeys } from '@/text/keys'

/**
 * Ünlü havuzu — yönetim paneli CRUD'u.
 *
 * `api/yonetim/route.ts`'in kardeşi; aynı koruma, aynı iyimser güncelleme
 * sözleşmesi, aynı hata dili. Ayrı dosya çünkü ünlü satırı `songs` biçimine
 * hiç benzemiyor ve 897 satırlık paneli daha da büyütmenin anlamı yok.
 */

export interface UnluRow {
  id: string
  category: UnluCategoryId
  name: string
  norm_name: string
  aliases: string[]
  accept_keys: string[]
  tier: Difficulty
  enabled: boolean
  image_ver: number
  note: string | null
  created_at?: string
}

const KOLONLAR =
  'id,category,name,norm_name,aliases,accept_keys,tier,enabled,image_ver,note,created_at'

/**
 * ⚠️ Etiket `havuz` DEĞİL, `unluhavuz`.
 *
 * Aynı etiketi paylaşsalardı her şarkı düzenlemesi ünlü önbelleğini de
 * düşürürdü (ve tersi) — 15 binlik şarkı havuzunun yeniden çekilmesi ucuz bir
 * iş değil.
 */
function yayinla() {
  revalidateTag('unluhavuz')
}

/** Görselin depodaki yolu — id'den türer, ayrı kolon yok. */
function gorselYolu(id: string): string {
  return `${id.slice('unlu:'.length)}.webp`
}

function gecerliKademe(v: unknown): v is Difficulty {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5
}

function takmalariAyikla(ham: unknown): string[] {
  const dizi = Array.isArray(ham)
    ? ham
    : String(ham ?? '')
        .split(',')
        .map((x) => x.trim())
  return [...new Set(dizi.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12)
}

// --- Okuma ---

export async function GET(req: Request) {
  const red = await yonetimKoru(req)
  if (red) return red

  try {
    // ⚠️ Sayfalama ŞART: PostgREST `db-max-rows` 1000 ve sorgudaki `limit`
    // onu yükseltmiyor.
    const rows = await restTumSatirlar<UnluRow>(
      `unluler?select=${KOLONLAR}&order=category.asc,tier.asc,name.asc`,
      { headers: restHeaders({ secret: true }), cache: 'no-store' },
    )
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 })
  }
}

// --- Ekleme ---

export async function POST(req: Request) {
  const red = await yonetimKoru(req)
  if (red) return red

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek (form bekleniyordu).' }, { status: 400 })
  }

  const ad = String(form.get('ad') ?? '').trim()
  const kategori = String(form.get('kategori') ?? '')
  const kademe = Number(form.get('kademe'))
  const not = String(form.get('not') ?? '').trim()
  const takmalar = takmalariAyikla(form.get('takmalar'))
  const gorsel = form.get('gorsel')

  if (ad.length < 2) return NextResponse.json({ error: 'Ad çok kısa.' }, { status: 400 })
  if (!UNLU_CATEGORY_IDS.includes(kategori as UnluCategoryId)) {
    return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 400 })
  }
  if (!gecerliKademe(kademe)) {
    return NextResponse.json({ error: 'Kademe 1-5 arası olmalı.' }, { status: 400 })
  }
  if (!(gorsel instanceof Blob) || gorsel.size === 0) {
    return NextResponse.json({ error: 'Görsel gelmedi.' }, { status: 400 })
  }
  if (gorsel.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Görsel çok büyük.' }, { status: 413 })
  }

  const norm = cleanKey(ad)
  if (!norm) {
    return NextResponse.json({ error: 'Ad yalnızca noktalama içeremez.' }, { status: 400 })
  }

  /*
   * ⚠️ SIRA: önce SATIR, sonra GÖRSEL.
   *
   * Görselin yolu id'den türediği ve id veritabanında üretildiği için ters
   * sıra mümkün değil. Yükleme başarısız olursa satır GERİ SİLİNİYOR: yetim
   * bir dosya oyunu bozmaz (kimse istemez), yetim bir satır bozar — oyun var
   * olmayan bir görseli ister ve tur `error` durumuna düşer.
   */
  const yaz = await fetch(restUrl('unluler'), {
    method: 'POST',
    headers: { ...restHeaders({ secret: true }), Prefer: 'return=representation' },
    cache: 'no-store',
    body: JSON.stringify({
      category: kategori,
      name: ad,
      norm_name: norm,
      aliases: takmalar,
      // ⚠️ `artist: ''` — ünlünün ikinci adı yok. `buildKeys` bu durumda
      // birleşik anahtar üretmiyor (bkz. `keys.ts`), yani boşluk dolgulu
      // anahtar çıkmıyor.
      accept_keys: buildKeys({ title: ad, artist: '', aliases: takmalar }),
      tier: kademe,
      note: not || null,
    }),
  })

  if (!yaz.ok) {
    const metin = await yaz.text()
    if (metin.includes('unluler_norm_uidx')) {
      return NextResponse.json({ error: 'Bu ünlü bu kategoride zaten var.' }, { status: 409 })
    }
    return NextResponse.json({ error: `Kaydedilemedi: ${metin.slice(0, 200)}` }, { status: 502 })
  }

  const satir = ((await yaz.json()) as UnluRow[])[0]
  if (!satir) {
    return NextResponse.json({ error: 'Satır yazıldı ama geri okunamadı.' }, { status: 502 })
  }

  const yuklendi = await storageYukle(
    UNLU_KOVA,
    gorselYolu(satir.id),
    await gorsel.arrayBuffer(),
    gorsel.type || 'image/webp',
  )

  if (!yuklendi) {
    await fetch(restUrl(`unluler?id=eq.${encodeURIComponent(satir.id)}`), {
      method: 'DELETE',
      headers: restHeaders({ secret: true }),
      cache: 'no-store',
    })
    return NextResponse.json(
      { error: 'Görsel yüklenemedi, kayıt geri alındı.' },
      { status: 502 },
    )
  }

  yayinla()
  return NextResponse.json({ row: satir })
}

// --- Düzenleme ---

export async function PATCH(req: Request) {
  const red = await yonetimKoru(req)
  if (red) return red

  const govde = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!govde) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const id = String(govde.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })

  // ⚠️ Beyaz liste: gövdeden gelen başka hiçbir alan yazılmaz.
  const yama: Record<string, unknown> = {}

  if ('kademe' in govde) {
    if (!gecerliKademe(govde.kademe)) {
      return NextResponse.json({ error: 'Kademe 1-5 arası olmalı.' }, { status: 400 })
    }
    yama.tier = govde.kademe
  }
  if ('acik' in govde) {
    if (typeof govde.acik !== 'boolean') {
      return NextResponse.json({ error: 'Geçersiz durum.' }, { status: 400 })
    }
    yama.enabled = govde.acik
  }
  if ('kategori' in govde) {
    if (!UNLU_CATEGORY_IDS.includes(govde.kategori as UnluCategoryId)) {
      return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 400 })
    }
    yama.category = govde.kategori
  }
  if ('ad' in govde || 'takmalar' in govde) {
    const ad = String(govde.ad ?? '').trim()
    if (ad.length < 2) return NextResponse.json({ error: 'Ad çok kısa.' }, { status: 400 })
    const norm = cleanKey(ad)
    if (!norm) {
      return NextResponse.json({ error: 'Ad yalnızca noktalama içeremez.' }, { status: 400 })
    }
    const takmalar = takmalariAyikla(govde.takmalar)
    // Ad değişince normalize ad ve kabul anahtarları da yeniden üretilmeli,
    // yoksa oyuncu yeni adı yazdığında tahmini reddedilir.
    yama.name = ad
    yama.norm_name = norm
    yama.aliases = takmalar
    yama.accept_keys = buildKeys({ title: ad, artist: '', aliases: takmalar })
  }

  if (Object.keys(yama).length === 0) {
    return NextResponse.json({ error: 'Değişiklik yok.' }, { status: 400 })
  }

  const res = await fetch(restUrl(`unluler?id=eq.${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { ...restHeaders({ secret: true }), Prefer: 'return=representation' },
    cache: 'no-store',
    body: JSON.stringify(yama),
  })

  if (!res.ok) {
    const metin = await res.text()
    if (metin.includes('unluler_norm_uidx')) {
      return NextResponse.json({ error: 'Bu ünlü bu kategoride zaten var.' }, { status: 409 })
    }
    return NextResponse.json({ error: `Kaydedilemedi: ${metin.slice(0, 200)}` }, { status: 502 })
  }

  yayinla()
  return NextResponse.json({ rows: (await res.json()) as UnluRow[] })
}

// --- Silme ---

export async function DELETE(req: Request) {
  const red = await yonetimKoru(req)
  if (red) return red

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })

  const res = await fetch(restUrl(`unluler?id=eq.${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: restHeaders({ secret: true }),
    cache: 'no-store',
  })
  if (!res.ok) {
    return NextResponse.json({ error: `Silinemedi: ${res.status}` }, { status: 502 })
  }

  // ⚠️ Dosya SATIRDAN SONRA siliniyor ve başarısızlığı yutuluyor: yetim dosya
  // zararsız, yetim satır oyunu bozar.
  await storageSil(UNLU_KOVA, gorselYolu(id))

  yayinla()
  return NextResponse.json({ ok: true })
}
