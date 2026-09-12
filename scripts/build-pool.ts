/**
 * Küratörlü TSV listelerini oynanabilir havuz JSON'una çevirir.
 *
 * ⚠️ ARTIK KAYNAK DEĞİL — ARŞİV ARACI.
 *
 * Havuzun tek doğru kaynağı Supabase. Oyunun kesinti yedeği olan
 * `public/data/pool/*.json` dosyalarını YALNIZCA `npm run pool:snapshot`
 * yazar (Supabase → disk). Bu betik eskiden aynı dosyalara TSV'den yazıyordu,
 * yani panelden 20 şarkı ekledikten sonra alışkanlıkla çalıştırmak yedeği eski
 * hâline döndürüyor ve Supabase kesintisinde o şarkıları kaybettiriyordu.
 *
 * Bu yüzden çıktı `data/arsiv/pool/` altına alındı: TSV iş akışı çalışmaya
 * devam eder ama canlı yedeğe DOKUNAMAZ.
 *
 * Kullanım:
 *   npm run pool:build            # tüm kategoriler
 *   npm run pool:build -- rap     # tek kategori
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { searchSongs, checkPreview, type ITunesTrack } from './lib/itunes'
import { cleanKey, buildKeys } from '../src/text/keys'
import { damerau } from '../src/text/distance'
import { CATEGORY_IDS, eraForYear, type CategoryId } from '../src/data/categories'
import { POOL_VERSION, type Song, type Pool } from '../src/data/schema'

const CURATED_DIR = 'data/curated'
const OUT_DIR = 'data/arsiv/pool'

/** Pre-roll payı için klip en erken burada başlayabilir (bkz. src/audio/envelope.ts). */
import { DEFAULT_CLIP_START as MIN_CLIP_START } from '../src/audio/envelope'
const PREVIEW_DURATION = 29

interface CuratedRow {
  artist: string
  title: string
  difficulty: number | null
  year: number | null
  /** "#!" ile kapatılmış satır: çözümlenir ama oyuna girmez. */
  enabled: boolean
}

interface Report {
  review: string[]
  unresolved: string[]
}

function parseTsv(path: string): CuratedRow[] {
  const text = readFileSync(path, 'utf8')
  const rows: CuratedRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    // Yönetim panelinden kapatılan satırlar "#!" ile başlar. Bunlar yorum
    // DEĞİLDİR: çözümlenip havuza `off: 1` olarak yazılırlar, böylece panelden
    // geri açmak yeniden build gerektirmez.
    const disabled = line.startsWith('#!')
    if (!disabled && line.startsWith('#')) continue

    const body = disabled ? raw.replace(/^\s*#!\s?/, '') : raw
    const cells = body.split('\t').map((c) => c.trim())
    const [artist, title, difficulty, year] = cells
    if (!artist || !title) continue
    rows.push({
      artist,
      title,
      difficulty: difficulty ? Number(difficulty) : null,
      year: year ? Number(year) : null,
      enabled: !disabled,
    })
  }
  return rows
}

/** Kalitesiz kayıtları eler: karaoke, tribute, hızlandırılmış vb. */
const JUNK_RE =
  /\b(karaoke|tribute|made famous by|cover version|originally performed|enstr[uü]mantal|instrumental|h[ıi]zland[ıi]r[ıi]lm[ıi][sş]|slowed|sped up|nightcore|8d audio)\b/i

const COMPILATION_RE =
  /\b(best of|greatest hits|en iyi|se[cç]me|ar[sş]iv|nostalji|unutulmayan|alt[ıi]n seri|vol\.?\s*\d|hit seti)\b/i

function isJunk(track: ITunesTrack): boolean {
  const haystack = [track.trackName, track.collectionName, track.artistName]
    .filter(Boolean)
    .join(' ')
  if (JUNK_RE.test(haystack)) return true
  if (track.collectionArtistName === 'Various Artists') return true
  return false
}

/** 0..1 benzerlik — normalize edilmiş anahtarlar üzerinde. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const max = Math.max(a.length, b.length)
  const d = damerau(a, b, max)
  return Math.max(0, 1 - d / max)
}

function pickBest(row: CuratedRow, candidates: ITunesTrack[]): ITunesTrack | null {
  const wantTitle = cleanKey(row.title)
  const wantArtist = cleanKey(row.artist)

  const scored: Array<{ track: ITunesTrack; score: number }> = []
  for (const track of candidates) {
    if (!track.previewUrl || !track.artworkUrl100 || !track.trackViewUrl) continue
    if (isJunk(track)) continue

    const titleScore = similarity(wantTitle, cleanKey(track.trackName))
    const artistScore = similarity(wantArtist, cleanKey(track.artistName))
    if (titleScore < 0.7 || artistScore < 0.6) continue

    // Derlemeleri cezalandır ama tamamen eleme: bazı eski kayıtlar yalnızca
    // derlemede mevcut.
    const penalty = COMPILATION_RE.test(track.collectionName ?? '') ? 0.15 : 0
    scored.push({ track, score: titleScore * 2 + artistScore - penalty })
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  return scored[0]!.track
}

async function buildCategory(cat: CategoryId, report: Report): Promise<Pool | null> {
  const path = join(CURATED_DIR, `${cat}.tsv`)
  if (!existsSync(path)) {
    console.log(`-  ${cat}: küratör listesi yok, atlanıyor`)
    return null
  }

  const rows = parseTsv(path)
  console.log(`\n>> ${cat}: ${rows.length} satır`)

  const songs: Song[] = []
  const seenTrackIds = new Set<number>()
  const seenDedupeKeys = new Set<string>()

  for (const row of rows) {
    const label = `${row.artist} - ${row.title}`
    let candidates: ITunesTrack[]
    try {
      candidates = await searchSongs(`${row.artist} ${row.title}`)
    } catch (err) {
      console.warn(`  x ${label}: arama hatası ${(err as Error).message}`)
      report.unresolved.push(`${cat}\t${row.artist}\t${row.title}\tarama hatası`)
      continue
    }

    const track = pickBest(row, candidates)
    if (!track) {
      console.warn(`  x ${label}: eşleşme yok`)
      report.unresolved.push(`${cat}\t${row.artist}\t${row.title}\teşleşme yok`)
      continue
    }

    const dedupeKey = `${cleanKey(track.trackName)}|${cleanKey(track.artistName)}`
    if (seenTrackIds.has(track.trackId) || seenDedupeKeys.has(dedupeKey)) {
      console.warn(`  = ${label}: yinelenen kayıt, atlandı`)
      continue
    }

    const check = await checkPreview(track.previewUrl!)
    if (!check.ok) {
      console.warn(`  x ${label}: preview ${check.status}`)
      report.unresolved.push(`${cat}\t${row.artist}\t${row.title}\tpreview ${check.status}`)
      continue
    }
    if (!check.cors) {
      // CORS olmadan crossOrigin="anonymous" sessizce SESSİZLİK üretir.
      console.warn(`  x ${label}: CORS yok, Web Audio çalışmaz`)
      report.unresolved.push(`${cat}\t${row.artist}\t${row.title}\tCORS yok`)
      continue
    }

    // Yıl: küratörün değeri kazanır. iTunes genelde yeniden basım tarihi verir.
    const itunesYear = track.releaseDate ? new Date(track.releaseDate).getUTCFullYear() : null
    let year = row.year
    if (year == null) {
      year = itunesYear ?? new Date().getUTCFullYear()
      report.review.push(`${cat}\t${row.artist}\t${row.title}\tyıl boş, iTunes: ${year}`)
    } else if (itunesYear && Math.abs(itunesYear - year) > 2) {
      report.review.push(
        `${cat}\t${row.artist}\t${row.title}\tküratör ${year} / iTunes ${itunesYear}`,
      )
    }

    let difficulty = row.difficulty
    if (difficulty == null || difficulty < 1 || difficulty > 5) {
      difficulty = 3
      report.review.push(`${cat}\t${row.artist}\t${row.title}\tzorluk boş, 3 atandı`)
    }

    seenTrackIds.add(track.trackId)
    seenDedupeKeys.add(dedupeKey)

    songs.push({
      id: `itunes:${track.trackId}`,
      t: track.trackName,
      a: track.artistName,
      ar: track.artworkUrl100!,
      p: track.previewUrl!,
      cs: MIN_CLIP_START,
      du: PREVIEW_DURATION,
      y: year,
      e: eraForYear(year),
      d: difficulty as Song['d'],
      c: cat,
      u: track.trackViewUrl!,
      nT: cleanKey(track.trackName),
      nA: cleanKey(track.artistName),
      k: buildKeys({ title: track.trackName, artist: track.artistName }),
      off: row.enabled ? 0 : 1,
    })
    console.log(
      `  ${row.enabled ? '+' : 'o'} ${track.artistName} - ${track.trackName}` +
        ` (${year}, z${difficulty})${row.enabled ? '' : ' [kapalı]'}`,
    )
  }

  return { v: POOL_VERSION, cat, builtAt: new Date().toISOString(), songs }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const targets = (only.length > 0 ? only : CATEGORY_IDS) as readonly CategoryId[]

  mkdirSync(OUT_DIR, { recursive: true })
  const report: Report = { review: [], unresolved: [] }

  for (const cat of targets) {
    const pool = await buildCategory(cat, report)
    if (!pool) continue
    writeFileSync(join(OUT_DIR, `${cat}.json`), JSON.stringify(pool))

    // Zorluk dağılımı: boş kalan kategori x zorluk kombinasyonlarını erken yakala.
    const on = pool.songs.filter((s) => s.off !== 1)
    const offCount = pool.songs.length - on.length
    const dist = [1, 2, 3, 4, 5].map((d) => on.filter((s) => s.d === d).length)
    console.log(
      `   ${cat}: ${on.length} şarkı${offCount ? ` (+${offCount} kapalı)` : ''}` +
        ` | zorluk dağılımı ${dist.join('/')}`,
    )
  }

  // ⚠️ Manifest DAİMA diskteki tüm havuzlardan üretilir, yalnızca bu
  // çalıştırmadakilerden değil. Aksi hâlde tek bir kategoriyi yeniden kurmak
  // diğerlerini arayüzden silerdi.
  const manifest: Array<{ cat: string; count: number }> = []
  for (const cat of CATEGORY_IDS) {
    const file = join(OUT_DIR, `${cat}.json`)
    if (!existsSync(file)) continue
    const pool = JSON.parse(readFileSync(file, 'utf8')) as Pool
    manifest.push({ cat, count: pool.songs.filter((s) => s.off !== 1).length })
  }

  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ v: POOL_VERSION, builtAt: new Date().toISOString(), categories: manifest }),
  )
  console.log(
    `\nManifest: ${manifest.map((m) => `${m.cat}=${m.count}`).join(' ')} ` +
      `(toplam ${manifest.reduce((n, m) => n + m.count, 0)})`,
  )

  writeFileSync(
    join(CURATED_DIR, '_review.tsv'),
    '# kategori\tsanatçı\tşarkı\tnot\n' + report.review.join('\n') + '\n',
  )
  writeFileSync(
    join(CURATED_DIR, '_unresolved.tsv'),
    '# kategori\tsanatçı\tşarkı\tsebep\n' + report.unresolved.join('\n') + '\n',
  )

  console.log(
    `\nİnceleme gereken: ${report.review.length} -> data/curated/_review.tsv` +
      `\nÇözümlenemeyen: ${report.unresolved.length} -> data/curated/_unresolved.tsv`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
