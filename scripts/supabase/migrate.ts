/**
 * Şemayı kurar ve mevcut havuz JSON'larını Supabase'e taşır.
 *
 *   npx tsx scripts/supabase/migrate.ts
 *
 * Tekrar tekrar çalıştırılabilir: şema `if not exists`, veri `upsert`.
 * Küratör TSV'leri ve havuz JSON'ları yerinde kalır — JSON artık Supabase
 * erişilemezse devreye giren yedek olarak da iş görüyor.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { CATEGORY_IDS, type CategoryId } from '../../src/data/categories'
import type { Pool as SongPool, Song } from '../../src/data/schema'

const here = dirname(fileURLToPath(import.meta.url))

function env(name: string): string {
  // .env.local'ı elle oku: tsx Next'in ortam yüklemesini çalıştırmaz.
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

function readPool(cat: CategoryId): Song[] {
  const file = join(process.cwd(), 'public/data/pool', `${cat}.json`)
  if (!existsSync(file)) return []
  return (JSON.parse(readFileSync(file, 'utf8')) as SongPool).songs
}

async function main() {
  const connectionString = env('SUPABASE_DB_URL')
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  console.log('Bağlanılıyor…')
  await client.connect()

  console.log('Şema kuruluyor…')
  await client.query(readFileSync(join(here, 'schema.sql'), 'utf8'))

  const all: Song[] = []
  for (const cat of CATEGORY_IDS) all.push(...readPool(cat))
  console.log(`${all.length} şarkı taşınıyor…`)

  // Tek seferde toplu upsert: 321 satır için tek sorgu yeter.
  const cols = [
    'id', 'category', 'title', 'artist', 'artwork', 'preview', 'store_url',
    'clip_start', 'duration', 'year', 'era', 'tier', 'enabled',
    'norm_title', 'norm_artist', 'accept_keys',
  ]
  const values: unknown[] = []
  const rows: string[] = []

  all.forEach((s, i) => {
    const base = i * cols.length
    rows.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(',')})`)
    values.push(
      s.id, s.c, s.t, s.a, s.ar, s.p, s.u,
      s.cs, s.du, s.y, s.e, s.d, s.off !== 1,
      s.nT, s.nA, s.k,
    )
  })

  const sql = `
    insert into public.songs (${cols.join(',')})
    values ${rows.join(',')}
    on conflict (id) do update set
      category = excluded.category,
      title = excluded.title,
      artist = excluded.artist,
      artwork = excluded.artwork,
      preview = excluded.preview,
      store_url = excluded.store_url,
      clip_start = excluded.clip_start,
      duration = excluded.duration,
      year = excluded.year,
      era = excluded.era,
      tier = excluded.tier,
      enabled = excluded.enabled,
      norm_title = excluded.norm_title,
      norm_artist = excluded.norm_artist,
      accept_keys = excluded.accept_keys
  `
  await client.query(sql, values)

  const { rows: stat } = await client.query<{ category: string; n: string }>(
    `select category, count(*)::text as n
       from public.songs where enabled group by category order by category`,
  )
  console.log('\nSupabase havuzu:')
  for (const r of stat) console.log(`  ${r.category.padEnd(10)} ${r.n}`)
  const { rows: total } = await client.query<{ n: string }>(
    'select count(*)::text as n from public.songs',
  )
  console.log(`  toplam ${total[0]!.n}`)

  await client.end()
  console.log('\nTamam.')
}

main().catch((err) => {
  console.error('\nHATA:', err.message)
  process.exit(1)
})
