/**
 * Havuz sağlık kontrolü.
 *
 * İki soruyu yanıtlar:
 *   1. Her preview URL'i hâlâ yaşıyor mu? (Apple URL'leri zamanla dönebiliyor)
 *   2. Küratörlük dengeli mi? Kademe ve dönem dağılımı raporlanır.
 *
 * Not: Zorluk kademesinin (1-5) oyunda artık bir arayüzü yok — tasarım şarkıyı
 * seçkiden rastgele seçiyor. Bu rapor küratörlük içindir.
 *
 * Kullanım:
 *   npm run pool:verify              # tam kontrol (ağ)
 *   npm run pool:verify -- --hizli   # yalnızca kapsam raporu, ağ yok
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { checkPreview } from './lib/itunes'
import {
  CATEGORY_IDS, CHIPS, ERA_IDS, ERA_LABELS, TIER_LABELS,
  type CategoryId, type Difficulty,
} from '../src/data/categories'
import type { Pool, Song } from '../src/data/schema'

const OUT_DIR = 'public/data/pool'
const MIN_PLAYABLE = 5

const fast = process.argv.includes('--hizli')

function readPool(cat: CategoryId): Song[] {
  const file = join(OUT_DIR, `${cat}.json`)
  if (!existsSync(file)) return []
  return (JSON.parse(readFileSync(file, 'utf8')) as Pool).songs
}

const all: Song[] = []
for (const cat of CATEGORY_IDS) all.push(...readPool(cat))

if (all.length === 0) {
  console.error('Havuz boş. Önce: npm run pool:build')
  process.exit(1)
}

const chipLabel = (id: string) => CHIPS.find((c) => c.id === id)?.label ?? id

// ---------- 1. tür havuzları ----------
console.log('KÜRATÖRLÜK RAPORU\n')

let thin = 0
for (const cat of CATEGORY_IDS) {
  const songs = readPool(cat)
  if (songs.length === 0) continue

  const tiers = ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => ({
    d,
    n: songs.filter((s) => s.d === d).length,
  }))

  console.log(`${chipLabel(cat)} (${songs.length})`)
  for (const { d, n } of tiers) {
    const flag = n === 0 ? '  << BOŞ' : ''
    if (n === 0) thin++
    console.log(`   ${d} ${TIER_LABELS[d].padEnd(14)} ${String(n).padStart(3)}${flag}`)
  }

  const eras = ERA_IDS.map((e) => {
    const n = songs.filter((s) => s.e === e).length
    return n > 0 ? `${ERA_LABELS[e]}:${n}` : null
  }).filter(Boolean)
  console.log(`   dönemler: ${eras.join('  ')}\n`)
}

// ---------- 2. şerit çipleri ----------
console.log('ŞERİT ÇİPLERİ')
for (const chip of CHIPS) {
  let n: number
  switch (chip.source.kind) {
    case 'all':
      n = all.length
      break
    case 'genre':
      n = readPool(chip.source.genre).length
      break
    case 'eras': {
      const set = new Set<string>(chip.source.eras)
      n = all.filter((s) => set.has(s.e)).length
      break
    }
  }
  const flag = n < MIN_PLAYABLE ? '  << ZAYIF' : ''
  if (n < MIN_PLAYABLE) thin++
  console.log(`   ${chip.label.padEnd(16)} ${String(n).padStart(4)}${flag}`)
}

// ---------- 3. preview canlılığı ----------
if (fast) {
  console.log('\n(--hizli: preview doğrulaması atlandı)')
} else {
  console.log(`\nPREVIEW DOĞRULAMASI — ${all.length} URL\n`)
  const dead: Song[] = []
  const noCors: Song[] = []
  let done = 0

  for (const song of all) {
    const res = await checkPreview(song.p)
    done++
    if (!res.ok) {
      dead.push(song)
      console.log(`   ÖLÜ  ${res.status}  ${song.a} - ${song.t}`)
    } else if (!res.cors) {
      noCors.push(song)
      console.log(`   CORS YOK   ${song.a} - ${song.t}`)
    }
    if (done % 50 === 0) console.log(`   ... ${done}/${all.length}`)
  }

  console.log(
    `\n${all.length - dead.length - noCors.length}/${all.length} sağlam` +
      ` | ${dead.length} ölü | ${noCors.length} CORS yok`,
  )
  if (dead.length > 0 || noCors.length > 0) {
    console.log('Düzeltmek için: npm run pool:build -- <kategori>')
  }
}

console.log(
  thin > 0
    ? `\nUYARI: ${thin} zayıf/boş kombinasyon var — ilgili seçkiye şarkı ekle.`
    : '\nTüm seçkiler ve kademeler dolu.',
)
