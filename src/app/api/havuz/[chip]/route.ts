import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { chipById, CHIPS, CATEGORY_IDS, type ChipId } from '@/data/categories'
import type { Pool, Song } from '@/data/schema'
import {
  POOL_COLUMNS, restHeaders, restTumSatirlar, toSong, supabaseReady, type SongRow,
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

/**
 * Diskten okunan kategoriler — süreç ömrü boyunca bir kez.
 *
 * ⚠️ Eskiden yedek moddaki HER istek yedi JSON dosyasını yeniden okuyup
 * yeniden ayrıştırıyordu. Supabase kesintisi zaten kötü bir an; üstüne her
 * istekte disk I/O eklemenin anlamı yok.
 */
const diskOnbellek = new Map<string, Song[]>()

function fallbackFromDisk(chip: ChipId): Song[] {
  const readCat = (cat: string): Song[] => {
    const hit = diskOnbellek.get(cat)
    if (hit) return hit

    const file = join(process.cwd(), 'public/data/pool', `${cat}.json`)
    let out: Song[] = []
    try {
      /*
       * ⚠️ `JSON.parse` BURADA try/catch içinde olmalı. Çağıran yerdeki
       * korumanın dışındaydı: bozuk ya da yarım yazılmış bir havuz dosyası
       * `GET`'ten dışarı fırlıyor, 500'e dönüşüyor ve oyun "Şarkı listesi
       * yüklenemedi" ekranına düşüyordu — yedeğin tam olarak önlemesi
       * gereken şey.
       */
      if (existsSync(file)) {
        out = (JSON.parse(readFileSync(file, 'utf8')) as Pool).songs.filter((s) => s.off !== 1)
      }
    } catch {
      out = []
    }
    diskOnbellek.set(cat, out)
    return out
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
    select: POOL_COLUMNS,
    enabled: 'eq.true',
    // Sıralama sayfalamanın tutarlı olması için ŞART: sırasız bir sorguda
    // planlayıcı sayfalar arasında aynı satırı iki kez verebilir ya da atlayabilir.
    order: 'id.asc',
  })

  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)
  else if (source.kind === 'eras') params.set('era', `in.(${source.eras.join(',')})`)

  const rows = await restTumSatirlar<SongRow>(`songs?${params}`, {
    headers: restHeaders() as Record<string, string>,
    // Next'in veri önbelleği: etiketle geçersizleştirilebilir.
    next: { revalidate: REVALIDATE_SECONDS, tags: ['havuz'] },
  })
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
        /*
         * ⚠️ `max-age` ŞART. `s-maxage` yalnızca paylaşımlı önbellekleri
         * bağlar; onsuz tarayıcı için tazelik ömrü tanımsız kalıyor ve her
         * sayfa yüklemesi en az bir koşullu gidiş-dönüş ödüyordu.
         */
        'Cache-Control': `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600`,
      },
    },
  )
}
