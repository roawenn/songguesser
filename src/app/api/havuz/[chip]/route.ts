import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { chipById, CHIPS, CATEGORY_IDS, type ChipId } from '@/data/categories'
import type { Pool, Song } from '@/data/schema'
import {
  SONG_COLUMNS, restUrl, restHeaders, toSong, supabaseReady, type SongRow,
} from '@/lib/supabase'

/**
 * Oyunun şarkı havuzu — Supabase'den canlı okunur.
 *
 * İki koruma var:
 *
 * 1. **Kenar önbelleği.** Yanıt Next'in veri önbelleğinde `havuz` etiketiyle
 *    tutulur. Oyuncular veritabanına değil CDN'e vurur; Supabase'in ücretsiz
 *    plandaki 5 GB/ay bant genişliği böylece tükenmez. Panelden kaydedince
 *    etiket geçersizleştiği için yayın yine anında olur.
 *
 * 2. **Statik yedek.** Supabase'e ulaşılamazsa son üretilen
 *    `public/data/pool/*.json` devreye girer — veritabanı kesintisi oyunu
 *    durdurmaz.
 */

const REVALIDATE_SECONDS = 60

export function generateStaticParams() {
  return CHIPS.map((c) => ({ chip: c.id }))
}

function fallbackFromDisk(chip: ChipId): Song[] {
  const readCat = (cat: string): Song[] => {
    const file = join(process.cwd(), 'public/data/pool', `${cat}.json`)
    if (!existsSync(file)) return []
    return (JSON.parse(readFileSync(file, 'utf8')) as Pool).songs.filter(
      (s) => s.off !== 1,
    )
  }

  const source = chipById(chip).source
  if (source.kind === 'genre') return readCat(source.genre)

  const all = CATEGORY_IDS.flatMap(readCat)
  if (source.kind === 'all') return all
  const eras = new Set<string>(source.eras)
  return all.filter((s) => eras.has(s.e))
}

async function fromSupabase(chip: ChipId): Promise<Song[]> {
  const source = chipById(chip).source
  const params = new URLSearchParams({
    select: SONG_COLUMNS,
    enabled: 'eq.true',
    limit: '5000',
  })

  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)
  else if (source.kind === 'eras') params.set('era', `in.(${source.eras.join(',')})`)

  const res = await fetch(restUrl(`songs?${params}`), {
    headers: restHeaders(),
    // Next'in veri önbelleği: etiketle geçersizleştirilebilir.
    next: { revalidate: REVALIDATE_SECONDS, tags: ['havuz'] },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)

  const rows = (await res.json()) as SongRow[]
  return rows.map(toSong)
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ chip: string }> },
) {
  const { chip: raw } = await ctx.params
  const chip = (CHIPS.find((c) => c.id === raw)?.id ?? 'karisik') as ChipId

  let songs: Song[] = []
  let kaynak: 'supabase' | 'yedek' = 'supabase'

  if (supabaseReady) {
    try {
      songs = await fromSupabase(chip)
    } catch {
      kaynak = 'yedek'
    }
  } else {
    kaynak = 'yedek'
  }

  // Supabase boş döndüyse de yedeğe düş: yeni kurulumda tablo boş olabilir.
  if (songs.length === 0) {
    songs = fallbackFromDisk(chip)
    if (songs.length > 0) kaynak = 'yedek'
  }

  return NextResponse.json(
    { chip, kaynak, songs },
    {
      headers: {
        // Tarayıcı ve CDN de bir süre tutsun.
        'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    },
  )
}
