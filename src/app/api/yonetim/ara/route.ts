import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import {
  CATEGORY_IDS, eraForYear, type CategoryId, type Difficulty,
} from '@/data/categories'
import { cleanKey, buildKeys } from '@/text/keys'
import { isAuthed, adminConfigured } from '@/lib/adminAuth'
import { restUrl, restHeaders, restTumSatirlar } from '@/lib/supabase'
import {
  searchTracks, ITunesError, DEFAULT_CLIP_START, PREVIEW_DURATION, type FoundTrack,
} from '@/lib/itunesSearch'

/**
 * iTunes'da ara ve doğrudan Supabase'e ekle.
 *
 * Arama sonucu preview, kapak ve mağaza bağlantısını birlikte getirdiği için
 * eklenen şarkı anında oynanabilir — ayrı bir çözümleme adımı gerekmez.
 *
 * POST hem tek parça hem de bir DİZİ kabul eder. Toplu eklemede satır başına
 * ayrı varlık sorgusu atılmaz: tek `POST` + `resolution=merge-duplicates` ile
 * 40 şarkı tek istekte girer.
 */

export type { FoundTrack }

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

export async function GET(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    return NextResponse.json({ results: await searchTracks(q, 18) })
  } catch (e) {
    if (e instanceof ITunesError) {
      return NextResponse.json({ error: e.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Arama başarısız.' }, { status: 502 })
  }
}

interface Incoming {
  track: FoundTrack
  tier?: number
  year?: number
}

/** Panelden gelen ham parçayı veritabanı satırına çevirir. */
function toRow(cat: CategoryId, item: Incoming) {
  const t = item.track
  const tierNum = Number(item.tier)
  const tier: Difficulty = tierNum >= 1 && tierNum <= 5 ? (tierNum as Difficulty) : 3
  const yearNum = Number(item.year)
  const year =
    yearNum >= 1900 && yearNum <= 2100 ? yearNum : (t.year || new Date().getUTCFullYear())

  return {
    id: `itunes:${t.trackId}`,
    category: cat,
    title: t.title,
    artist: t.artist,
    artwork: t.artwork,
    preview: t.preview,
    store_url: t.storeUrl,
    clip_start: DEFAULT_CLIP_START,
    duration: PREVIEW_DURATION,
    year,
    era: eraForYear(year),
    tier,
    enabled: true,
    norm_title: cleanKey(t.title),
    norm_artist: cleanKey(t.artist),
    accept_keys: buildKeys({ title: t.title, artist: t.artist }),
  }
}

function valid(t: unknown): t is FoundTrack {
  const x = t as Partial<FoundTrack> | undefined
  return Boolean(x?.trackId && x.title && x.artist && x.preview && x.artwork && x.storeUrl)
}

export async function POST(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const cat = body.cat as CategoryId
  if (!CATEGORY_IDS.includes(cat)) {
    return NextResponse.json({ error: 'Bilinmeyen kategori.' }, { status: 400 })
  }

  // Tek parça (eski biçim) ya da dizi — ikisi de kabul.
  const incoming: Incoming[] = Array.isArray(body.tracks)
    ? (body.tracks as Incoming[])
    : [{ track: body.track as FoundTrack, tier: Number(body.tier), year: Number(body.year) }]

  const usable = incoming.filter((i) => valid(i?.track))
  if (usable.length === 0) {
    return NextResponse.json({ error: 'Eksik parça bilgisi.' }, { status: 400 })
  }

  // Aynı istekte iki kez geçen id, PostgREST'in upsert'ini bozar.
  const seen = new Set<string>()
  const rows = usable
    .map((i) => toRow(cat, i))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))

  /*
   * ⚠️ İKİ ayrı tekillik kuralı var ve ikisini de burada karşılamak gerekiyor:
   *
   *   1. `id` (primary key)                      — aynı iTunes parçası
   *   2. (category, norm_artist, norm_title)     — aynı şarkının başka basımı
   *
   * PostgREST upsert'i tek bir `on_conflict` hedefi alır. İkinci kurala takılan
   * satır batch'e girerse 23505 ile TÜM istek düşer, yani tek bir remaster
   * kopyası 39 şarkıyı birden kaybettirir. Bu yüzden norm çakışmaları
   * yüklemeden ÖNCE ayıklanıp "atlandı" olarak raporlanıyor; `id` çakışması ise
   * `merge-duplicates` ile güncellemeye dönüşüyor.
   */
  /*
   * ⚠️ SAYFALAMA ŞART. PostgREST 1000 satırda kesiyor; `pop` kategorisi 3000'i
   * aştığında tekrar kümesi eksik kalıyor, norm ön-elemesi çakışmayı kaçırıyor
   * ve tek bir kopya yukarıda anlatılan 23505 ile bütün partiyi düşürüyordu.
   */
  const known = await restTumSatirlar<{ id: string; norm_artist: string; norm_title: string }>(
    `songs?select=id,norm_artist,norm_title&category=eq.${cat}&order=id.asc`,
    { headers: restHeaders({ secret: true }) as Record<string, string>, cache: 'no-store' },
  ).catch(() => [])
  const normOwner = new Map(known.map((r) => [`${r.norm_artist}|${r.norm_title}`, r.id]))
  const knownIds = new Set(known.map((r) => r.id))

  const skipped: string[] = []
  const fresh = rows.filter((r) => {
    const owner = normOwner.get(`${r.norm_artist}|${r.norm_title}`)
    if (owner && owner !== r.id) {
      skipped.push(`${r.artist} — ${r.title}`)
      return false
    }
    return true
  })

  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, songs: [], eklenen: 0, guncellenen: 0, atlanan: skipped })
  }

  const res = await fetch(restUrl('songs?on_conflict=id'), {
    method: 'POST',
    headers: {
      ...restHeaders({ secret: true }),
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(fresh),
  })
  if (!res.ok) {
    return NextResponse.json(
      { error: `Supabase ${res.status}: ${await res.text()}` },
      { status: 502 },
    )
  }

  const saved = (await res.json()) as unknown[]
  const updated = fresh.filter((r) => knownIds.has(r.id)).length
  revalidateTag('havuz')
  return NextResponse.json({
    ok: true,
    songs: saved,
    eklenen: fresh.length - updated,
    guncellenen: updated,
    atlanan: skipped,
  })
}
