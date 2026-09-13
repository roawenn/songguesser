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

/** PostgREST'in bir sayfada döndürdüğü en fazla satır (`db-max-rows`). */
const SAYFA = 1000

/**
 * Bir kategorinin BÜTÜN satırlarını çeker.
 *
 * ⚠️ `limit=5000` İŞE YARAMIYORDU. Bu projede PostgREST'in `db-max-rows`
 * ayarı 1000 ve sorgudaki `limit` onu YÜKSELTMİYOR, yalnızca düşürebiliyor.
 * Betik sessizce kategori başına ilk 1000 satırı yazıyordu; kategoriler
 * 1595-3284 şarkıya çıktığı için yedek havuzun yarısından azını temsil
 * edecekti — üstelik yalnızca Supabase çöktüğünde, yani fark edilmesi en zor
 * anda. Tek doğru yol `Range` başlığıyla sayfalamak.
 *
 * `order` sayfalama için ŞART: sırasız bir sorguda planlayıcı sayfalar
 * arasında aynı satırı iki kez verebilir ya da atlayabilir.
 */
async function tumSatirlar(url: string, key: string, cat: CategoryId): Promise<SongRow[]> {
  const out: SongRow[] = []
  for (let bas = 0; ; bas += SAYFA) {
    const params = new URLSearchParams({
      select: SONG_COLUMNS,
      category: `eq.${cat}`,
      order: 'id.asc',
    })
    const res = await fetch(`${url}/rest/v1/songs?${params}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${bas}-${bas + SAYFA - 1}`,
      },
    })
    if (!res.ok) throw new Error(`${cat}: Supabase ${res.status}`)
    const sayfa = (await res.json()) as SongRow[]
    out.push(...sayfa)
    if (sayfa.length < SAYFA) return out
  }
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY')
  mkdirSync(OUT, { recursive: true })

  const manifest: Array<{ cat: string; count: number }> = []

  for (const cat of CATEGORY_IDS as readonly CategoryId[]) {
    const rows = await tumSatirlar(url, key, cat)
    const pool: Pool = {
      v: POOL_VERSION,
      cat,
      builtAt: new Date().toISOString(),
      // Sayfalama `id.asc` istiyor; dosyadaki okunur sıra burada geri veriliyor.
      songs: rows.map(toSong).sort((x, z) => x.d - z.d || x.a.localeCompare(z.a, 'tr')),
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
