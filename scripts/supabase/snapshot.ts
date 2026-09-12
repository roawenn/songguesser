/**
 * Supabase'deki havuzu statik yedeğe yazar.
 *
 *   npm run pool:snapshot
 *
 * Bu dosyalar (`public/data/pool/*.json`) Supabase'e ulaşılamadığında devreye
 * girer — veritabanı kesintisi oyunu durdurmasın diye. Panelde toplu değişiklik
 * yaptıktan sonra çalıştırıp commit et.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_IDS, type CategoryId } from '../../src/data/categories'
import { POOL_VERSION, type Pool } from '../../src/data/schema'
import { toSong, SONG_COLUMNS, type SongRow } from '../../src/lib/supabase'

const OUT = 'public/data/pool'

function env(name: string): string {
  const file = join(process.cwd(), '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && m[1] === name && !process.env[name]) process.env[name] = m[2]
    }
  }
  const v = process.env[name]
  if (!v) throw new Error(`${name} tanımlı değil (.env.local)`)
  return v
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY')
  mkdirSync(OUT, { recursive: true })

  const manifest: Array<{ cat: string; count: number }> = []

  for (const cat of CATEGORY_IDS as readonly CategoryId[]) {
    const params = new URLSearchParams({
      select: SONG_COLUMNS,
      category: `eq.${cat}`,
      order: 'tier.asc,artist.asc',
      limit: '5000',
    })
    const res = await fetch(`${url}/rest/v1/songs?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`${cat}: Supabase ${res.status}`)

    const rows = (await res.json()) as SongRow[]
    const pool: Pool = {
      v: POOL_VERSION,
      cat,
      builtAt: new Date().toISOString(),
      songs: rows.map(toSong),
    }
    writeFileSync(join(OUT, `${cat}.json`), JSON.stringify(pool), 'utf8')

    const on = pool.songs.filter((s) => s.off !== 1).length
    manifest.push({ cat, count: on })
    console.log(`  ${cat.padEnd(10)} ${on} açık / ${rows.length}`)
  }

  writeFileSync(
    join(OUT, 'manifest.json'),
    JSON.stringify({ v: POOL_VERSION, builtAt: new Date().toISOString(), categories: manifest }),
    'utf8',
  )
  console.log(`\nToplam ${manifest.reduce((n, m) => n + m.count, 0)} açık şarkı yedeklendi.`)
}

main().catch((err) => {
  console.error('\nHATA:', err.message)
  process.exit(1)
})
