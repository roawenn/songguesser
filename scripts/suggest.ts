/**
 * Küratör yardımcısı: sanatçı tohum listesinden Apple TR'de GERÇEKTEN MEVCUT
 * şarkıları çeker ve küratörün kesip yapıştıracağı bir aday TSV'si üretir.
 *
 * Neden gerekli: hafızadan şarkı adı yazmak güvenilmez. Bir şarkının adı doğru
 * olsa bile Apple Music Türkiye'de bulunmayabilir. Mevcut katalogdan seçmek
 * çözümleme oranını %100'e çıkarır.
 *
 * Kullanım:
 *   npx tsx scripts/suggest.ts rap
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { searchSongs, type ITunesTrack } from './lib/itunes'
import { cleanKey } from '../src/text/keys'
import type { CategoryId } from '../src/data/categories'
import { SEEDS } from '../src/data/seeds'


const cat = (process.argv[2] ?? 'rap') as CategoryId
const artists = SEEDS[cat]
if (!artists) {
  console.error(`Bu kategori için tohum sanatçı listesi yok: ${cat}`)
  process.exit(1)
}

/** Zaten küratörlenmiş satırları tekrar önermemek için mevcut listeyi oku. */
function existingKeys(): Set<string> {
  const path = join('data/curated', `${cat}.tsv`)
  const keys = new Set<string>()
  if (!existsSync(path)) return keys
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!raw.trim() || raw.startsWith('#')) continue
    const [artist, title] = raw.split('\t')
    if (artist && title) keys.add(`${cleanKey(artist)}|${cleanKey(title)}`)
  }
  return keys
}

const already = existingKeys()
const seen = new Set<string>()
const lines: string[] = []

for (const artist of artists) {
  let results: ITunesTrack[]
  try {
    results = await searchSongs(artist, 30)
  } catch (err) {
    console.warn(`  ! ${artist}: ${(err as Error).message}`)
    continue
  }

  const wantArtist = cleanKey(artist)
  let kept = 0

  for (const r of results) {
    if (!r.previewUrl || !r.trackViewUrl || !r.artworkUrl100) continue

    // Sanatçı gerçekten bu mu? ("UZI & Aksan" kabul, "Tefo & Seko" değil)
    const rArtist = cleanKey(r.artistName)
    if (!rArtist.includes(wantArtist)) continue

    const key = `${rArtist}|${cleanKey(r.trackName)}`
    if (seen.has(key) || already.has(`${wantArtist}|${cleanKey(r.trackName)}`)) continue
    seen.add(key)

    const year = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : ''
    // Zorluk boş bırakılır: küratör doldurur. Yıl iTunes'dan gelir ve
    // yeniden basım tarihi olabilir, bu yüzden ? ile işaretlenir.
    lines.push(`${r.artistName}\t${r.trackName}\t\t${year}`)
    kept++
  }
  console.log(`  ${artist}: ${kept} aday`)
}

const out = join('data/curated', `_oneriler.${cat}.tsv`)
writeFileSync(
  out,
  `# ${cat} — ADAY ŞARKILAR (Apple Music TR'de mevcut olduğu DOĞRULANDI)\n` +
    `#\n` +
    `# Beğendiğin satırları ${cat}.tsv dosyasına taşı ve iki alanı doldur:\n` +
    `#   zorluk (3. sütun): 1=Kolay ... 5=İmkansız\n` +
    `#   yıl (4. sütun): iTunes'un verdiği yıl YENİDEN BASIM olabilir, kontrol et\n` +
    `#\n` +
    `# sanatçı\tşarkı\tzorluk\tyıl(iTunes)\n` +
    lines.join('\n') +
    '\n',
  'utf8',
)

console.log(`\n${lines.length} aday -> ${out}`)
