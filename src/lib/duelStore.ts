import { randomBytes, randomUUID } from 'node:crypto'
import { chipById, type ChipId } from '@/data/categories'
import type { Song } from '@/data/schema'
import { SONG_COLUMNS, restUrl, restHeaders, toSong, type SongRow } from '@/lib/supabase'
import { DUELLO_SARKI, kodUret } from '@/game/duel'

/**
 * Düello veri katmanı — yalnızca SUNUCUDA.
 *
 * Üç tablo da RLS altında ve hiçbir politikası yok; okuma da yazma da buradan,
 * secret key ile geçer. Tarayıcı `duels.song_ids`'i doğrudan okuyamaz.
 */

export interface DuelRow {
  code: string
  chip: ChipId
  song_ids: string[]
  status: 'bekliyor' | 'oynaniyor' | 'bitti'
  created_at: string
  started_at: string | null
  expires_at: string
}

export interface AnswerRow {
  slot: 1 | 2
  song_index: number
  won: boolean
  heard_seconds: number
  listens: number
}

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

/**
 * Lobinin 5 şarkısını seçer: kademe 1'den 5'e, her kademeden bir tane.
 *
 * ⚠️ Şarkılar lobi KURULURKEN sabitlenir. Sonradan seçilseydi iki oyuncu
 * farklı parça görebilirdi.
 *
 * ⚠️ `filterByTier` KULLANILMAZ. O, ince kademelerde komşuları karıştırıyor —
 * oyunun tek turunda makul ama düelloda rampayı yok eder. Burada kademe tam
 * eşleşmeli; bir kademede hiç şarkı yoksa lobi kurulmaz ve kullanıcı açık bir
 * hata görür.
 */
export async function sarkilariSec(chip: ChipId): Promise<Song[] | null> {
  const source = chipById(chip).source
  const secilen: Song[] = []

  for (let tier = 1; tier <= DUELLO_SARKI; tier++) {
    const params = new URLSearchParams({
      select: SONG_COLUMNS,
      enabled: 'eq.true',
      tier: `eq.${tier}`,
      limit: '400',
    })
    if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)
    else if (source.kind === 'eras') params.set('era', `in.(${source.eras.join(',')})`)

    const res = await rest(`songs?${params}`)
    if (!res.ok) return null
    const rows = (await res.json()) as SongRow[]
    const aday = rows.filter((r) => !secilen.some((s) => s.id === r.id))
    if (aday.length === 0) return null

    secilen.push(toSong(aday[randomBytes(4).readUInt32BE(0) % aday.length]!))
  }

  return secilen
}

/** Benzersiz bir kodla lobi kurar. */
export async function duelloKur(
  chip: ChipId,
  songIds: string[],
): Promise<{ code: string; secret: string } | null> {
  // ⚠️ Çakışma ihtimali düşük ama sıfır değil; birkaç kez dene.
  for (let deneme = 0; deneme < 5; deneme++) {
    const code = kodUret((n) => randomBytes(n))
    const res = await rest('duels', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code, chip, song_ids: songIds }),
    })
    if (res.status === 409) continue // kod tutulmuş
    if (!res.ok) return null

    const secret = randomUUID()
    const p = await rest('duel_players', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code, slot: 1, secret }),
    })
    if (!p.ok) return null
    return { code, secret }
  }
  return null
}

export async function duelloOku(code: string): Promise<DuelRow | null> {
  const res = await rest(`duels?code=eq.${encodeURIComponent(code)}&limit=1`)
  if (!res.ok) return null
  const rows = (await res.json()) as DuelRow[]
  return rows[0] ?? null
}

export async function oyuncular(code: string): Promise<{ slot: 1 | 2; secret: string }[]> {
  const res = await rest(`duel_players?code=eq.${encodeURIComponent(code)}&select=slot,secret`)
  if (!res.ok) return []
  return (await res.json()) as { slot: 1 | 2; secret: string }[]
}

export async function cevaplar(code: string): Promise<AnswerRow[]> {
  const res = await rest(
    `duel_answers?code=eq.${encodeURIComponent(code)}&select=slot,song_index,won,heard_seconds,listens&order=song_index.asc`,
  )
  if (!res.ok) return []
  return (await res.json()) as AnswerRow[]
}

/** İkinci oyuncuyu ekler ve düelloyu başlatır. */
export async function katil(code: string): Promise<{ slot: 2; secret: string } | null> {
  const secret = randomUUID()
  const res = await rest('duel_players', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ code, slot: 2, secret }),
  })
  // ⚠️ 409 = ikinci slot dolu. Yarış hâlinde ikisi birden giremesin diye
  // kararı veritabanının birincil anahtarına bırakıyoruz, okuyup-yazmaya değil.
  if (!res.ok) return null

  await rest(`duels?code=eq.${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'oynaniyor', started_at: new Date().toISOString() }),
  })
  return { slot: 2, secret }
}

export async function cevapYaz(
  code: string,
  slot: 1 | 2,
  a: { songIndex: number; won: boolean; heardSeconds: number; listens: number },
): Promise<boolean> {
  const res = await rest('duel_answers', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      code,
      slot,
      song_index: a.songIndex,
      won: a.won,
      heard_seconds: a.heardSeconds,
      listens: a.listens,
    }),
  })
  return res.ok
}

/** Gizli anahtarı doğrular; sahte cevap yazmayı engeller. */
export async function slotDogrula(code: string, secret: string): Promise<1 | 2 | null> {
  const hepsi = await oyuncular(code)
  return hepsi.find((p) => p.secret === secret)?.slot ?? null
}
