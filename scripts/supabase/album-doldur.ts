/**
 * `songs.album` kolonunu Apple'dan doldurur — Kapaktan Albüm oyunu için.
 *
 *   npx tsx scripts/supabase/album-doldur.ts --kuru          # 200 şarkı, YAZMAZ
 *   npx tsx scripts/supabase/album-doldur.ts --kuru --adet 50
 *   npx tsx scripts/supabase/album-doldur.ts                  # hepsi, yazar
 *
 * Yeniden çalıştırılabilir: yalnızca `album is null` satırları sorar. Apple'ın
 * döndürmediği şarkılar `''` olarak işaretlenir (bkz. `schema.sql`), bir daha
 * sorulmaz.
 *
 * ⚠️ İSTEK SINIRI: iTunes dakikada ~20 istek kabul ediyor ve aşılınca 429 değil
 * **403** dönüyor (bkz. `src/lib/itunesSearch.ts`). Parti başına 150 kimlik,
 * partiler arası 4 sn (dakikada ≤ 15). 403'te üstel bekleme.
 *
 * ⚠️ `country=tr` ŞART: kimlikler Türkiye mağazasından geldi; başka mağazada
 * sorulan şarkıların bir kısmı hiç dönmüyor.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const PARTI = 150
const ARALIK_MS = 4000
const EN_COK_DENEME = 5

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

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface LookupSonucu {
  wrapperType?: string
  trackId?: number
  collectionName?: string
}

/** Bir partinin albüm adlarını ister; 403'te üstel bekleyip yeniden dener. */
async function sor(trackIdler: string[]): Promise<Map<string, string>> {
  const url =
    'https://itunes.apple.com/lookup?' +
    new URLSearchParams({ id: trackIdler.join(','), country: 'tr', entity: 'song' })

  for (let deneme = 1; ; deneme++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'tahmin.net/1.0 (song quiz)' } })
    if (res.ok) {
      const json = (await res.json()) as { results: LookupSonucu[] }
      const harita = new Map<string, string>()
      for (const r of json.results) {
        if (r.wrapperType === 'track' && r.trackId && r.collectionName) {
          harita.set(String(r.trackId), r.collectionName)
        }
      }
      return harita
    }
    if ((res.status === 403 || res.status === 429) && deneme < EN_COK_DENEME) {
      const ms = 15000 * 2 ** (deneme - 1)
      console.log(`  ${res.status} — istek sınırı; ${ms / 1000} sn bekleniyor (deneme ${deneme})`)
      await bekle(ms)
      continue
    }
    throw new Error(`iTunes ${res.status}`)
  }
}

async function main() {
  const kuru = process.argv.includes('--kuru')
  const adetArg = process.argv.indexOf('--adet')
  const adet = adetArg >= 0 ? Number(process.argv[adetArg + 1]) : kuru ? 200 : Infinity

  const client = new pg.Client({
    connectionString: env('SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const { rows } = await client.query<{ id: string; title: string; artist: string }>(
    `select id, title, artist from public.songs where album is null and id like 'itunes:%' order by id`,
  )
  const hedef = rows.slice(0, Number.isFinite(adet) ? adet : rows.length)
  console.log(`${rows.length} şarkının albümü boş; bu çalıştırmada ${hedef.length} sorulacak${kuru ? ' (KURU — yazılmayacak)' : ''}.`)

  let bulunan = 0
  let bulunamayan = 0
  const ornekler: string[] = []

  for (let i = 0; i < hedef.length; i += PARTI) {
    const parti = hedef.slice(i, i + PARTI)
    const harita = await sor(parti.map((r) => r.id.slice('itunes:'.length)))

    const degerler: string[] = []
    const params: string[] = []
    for (const r of parti) {
      const album = harita.get(r.id.slice('itunes:'.length)) ?? ''
      if (album) bulunan++
      else bulunamayan++
      if (ornekler.length < 12 && album) ornekler.push(`${r.artist} — ${r.title}  →  ${album}`)
      params.push(r.id, album)
      degerler.push(`($${params.length - 1}, $${params.length})`)
    }

    if (!kuru) {
      await client.query(
        `update public.songs as s set album = v.album
           from (values ${degerler.join(',')}) as v(id, album)
          where s.id = v.id`,
        params,
      )
    }

    console.log(`  ${Math.min(i + PARTI, hedef.length)}/${hedef.length} · bulunan ${bulunan} · bulunamayan ${bulunamayan}`)
    if (i + PARTI < hedef.length) await bekle(ARALIK_MS)
  }

  console.log('\nÖrnekler:')
  for (const o of ornekler) console.log('  ' + o)
  console.log(`\nToplam: bulunan ${bulunan}, bulunamayan ${bulunamayan} (${((bulunan / Math.max(1, hedef.length)) * 100).toFixed(1)}%).`)
  await client.end()
}

main().catch((err) => {
  console.error('\nHATA:', err.message)
  process.exit(1)
})
