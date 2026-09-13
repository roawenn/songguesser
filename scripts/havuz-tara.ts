/**
 * Bir kategorinin tohum sanatçılarını tarar ve bulunanları havuza ekler.
 *
 *   npx tsx scripts/havuz-tara.ts <kategori> [--yaz]
 *
 * `--yaz` olmadan yalnızca RAPOR verir, hiçbir şey yazmaz.
 *
 * ⚠️ Panelin "hepsini tara" akışının betik hâli. Aynı uç noktaları kullanır,
 * yani aynı elemelerden geçer: parti içi ve veritabanına karşı kopya ayıklama,
 * kademe önerisi, yıl düzeltmesi.
 *
 * ⚠️ Sanatçılar arasında bekleme ŞART. iTunes dakikada ~20 istek kabul ediyor
 * ve aşılınca 429 değil 403 dönüyor; paralel tarama kuyruğu komple düşürür.
 *
 * ⚠️ Kademeler ARACIN ÖNERİSİ. Sıra tabanlı bir sezgi, ölçüm değil; küratör
 * panelden değiştirebilir.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_IDS, type CategoryId } from '../src/data/categories'
import { seedsFor } from '../src/data/seeds'

const KOK = process.env.TAHMIN_KOK ?? 'http://localhost:3000'
/** iTunes sınırına takılmamak için sanatçılar arası bekleme. */
const ARA_MS = 3000
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Parca {
  trackId: number
  title: string
  artist: string
  onerilenKademe?: number
  year: number
}

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

/**
 * Oturum açar ve çerezi diske yazar.
 *
 * ⚠️ Çerez YENİDEN KULLANILIR. Giriş uç noktasında 15 dakikada 5 deneme
 * sınırı var (kaba kuvvete karşı); kategori başına yeniden giriş yapmak
 * üçüncü kategoride kendi sınırımıza takılıyordu.
 */
const CEREZ_DOSYA = join(process.cwd(), '.tahmin-oturum')

async function giris(parola: string): Promise<string> {
  if (existsSync(CEREZ_DOSYA)) {
    const eski = readFileSync(CEREZ_DOSYA, 'utf8').trim()
    if (/^[0-9a-f]{64}$/.test(eski)) {
      const k = await fetch(`${KOK}/api/yonetim`, { headers: { cookie: `tahmin_yonetim=${eski}` } })
      if (k.ok) return eski
    }
  }
  const r = await fetch(`${KOK}/api/yonetim/giris`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: parola }),
  })
  const cerez = (r.headers.get('set-cookie') ?? '').match(/tahmin_yonetim=([0-9a-f]{64})/)?.[1]
  if (!cerez) throw new Error(`giriş yapılamadı (${r.status})`)
  writeFileSync(CEREZ_DOSYA, cerez)
  return cerez
}

async function sayim(cat: CategoryId): Promise<number> {
  const r = await fetch(
    `${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/songs?select=id&category=eq.${cat}`,
    {
      headers: {
        apikey: env('SUPABASE_SECRET_KEY'),
        Authorization: `Bearer ${env('SUPABASE_SECRET_KEY')}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    },
  )
  return Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
}

async function main() {
  const cat = process.argv[2] as CategoryId
  const yaz = process.argv.includes('--yaz')
  if (!CATEGORY_IDS.includes(cat)) {
    console.error(`Kullanım: npx tsx scripts/havuz-tara.ts <${CATEGORY_IDS.join('|')}> [--yaz]`)
    process.exit(1)
  }

  const parola = process.env.TAHMIN_PAROLA
  if (!parola) throw new Error('TAHMIN_PAROLA ortam değişkeni gerekli')
  const cerez = await giris(parola)
  const bas = { cookie: `tahmin_yonetim=${cerez}` }

  const sanatcilar = seedsFor(cat)
  const once = await sayim(cat)
  console.log(`${cat}: ${sanatcilar.length} sanatçı taranacak · havuzda ${once} şarkı\n`)

  const bulunan = new Map<number, Parca>()
  for (const [i, sanatci] of sanatcilar.entries()) {
    const r = await fetch(`${KOK}/api/yonetim/oner?sanatci=${encodeURIComponent(sanatci)}`, {
      headers: bas,
    })
    const d = (await r.json()) as { results?: Parca[]; error?: string }
    if (!r.ok) {
      console.log(`  [${i + 1}/${sanatcilar.length}] ${sanatci}: HATA ${d.error ?? r.status}`)
      // 403 iTunes sınırıdır; devam etmek kuyruğun kalanını da yakar.
      if (r.status === 502) break
    } else {
      const res = d.results ?? []
      for (const t of res) bulunan.set(t.trackId, t)
      console.log(`  [${i + 1}/${sanatcilar.length}] ${sanatci}: ${res.length} parça`)
    }
    if (i < sanatcilar.length - 1) await bekle(ARA_MS)
  }

  const tracks = [...bulunan.values()].map((t) => ({
    track: t,
    tier: t.onerilenKademe ?? 3,
    year: t.year,
  }))
  console.log(`\nbenzersiz parça: ${tracks.length}`)

  if (!yaz) {
    console.log('(--yaz verilmedi, hiçbir şey yazılmadı)')
    return
  }

  const r = await fetch(`${KOK}/api/yonetim/ara`, {
    method: 'POST',
    headers: { ...bas, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat, tracks }),
  })
  const d = (await r.json()) as {
    eklenen?: number
    atlanan?: string[]
    zatenVar?: string[]
    basarisiz?: string[]
    error?: string
  }
  const sonra = await sayim(cat)

  if (d.error) console.log('HATA:', d.error.slice(0, 300))
  console.log(
    `eklenen ${d.eklenen ?? 0} · zaten havuzda ${d.zatenVar?.length ?? 0} · ` +
      `kopya atlandı ${d.atlanan?.length ?? 0} · yazılamayan ${d.basarisiz?.length ?? 0}`,
  )
  console.log(`${cat}: ${once} → ${sonra} (+${sonra - once})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
