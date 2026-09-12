import type { Song } from '@/data/schema'
import type { CategoryId, EraId, Difficulty } from '@/data/categories'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Supabase yapılandırılmamışsa oyun statik yedeğe düşer. */
export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON)

/** Veritabanındaki satır biçimi (okunaklı kolon adları). */
export interface SongRow {
  id: string
  category: string
  title: string
  artist: string
  artwork: string
  preview: string
  store_url: string
  clip_start: number
  duration: number
  year: number
  era: string
  tier: number
  enabled: boolean
  norm_title: string
  norm_artist: string
  accept_keys: string[]
  /** Panelde "son eklenenler" sıralaması için. */
  created_at?: string
}

/** DB satırını oyunun kullandığı kompakt biçime çevirir. */
export function toSong(r: SongRow): Song {
  return {
    id: r.id,
    t: r.title,
    a: r.artist,
    ar: r.artwork,
    p: r.preview,
    cs: r.clip_start,
    du: r.duration,
    y: r.year,
    e: r.era as EraId,
    d: r.tier as Difficulty,
    c: r.category as CategoryId,
    u: r.store_url,
    nT: r.norm_title,
    nA: r.norm_artist,
    k: r.accept_keys ?? [],
    off: r.enabled ? 0 : 1,
  }
}

export const SONG_COLUMNS =
  'id,category,title,artist,artwork,preview,store_url,clip_start,duration,year,era,tier,enabled,norm_title,norm_artist,accept_keys'

/**
 * Sunucu tarafı istek başlığı.
 *
 * ⚠️ `secret` yalnızca sunucuda kullanılır — RLS'i baypas eder, tarayıcıya
 * ASLA gönderilmez. Okuma yolunda anon anahtar yeter; secret sadece yönetim
 * panelinin yazma işlemlerinde devreye girer.
 */
export function restHeaders(opts: { secret?: boolean } = {}): HeadersInit {
  const key = opts.secret
    ? (process.env.SUPABASE_SECRET_KEY ?? '')
    : SUPABASE_ANON
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export function restUrl(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`
}

/**
 * Yönetim panelinin okuduğu kolonlar.
 *
 * ⚠️ `SONG_COLUMNS`'tan ayrı: `created_at` yalnızca panelde ("son eklenenler")
 * işe yarıyor, oyun onu `toSong` içinde zaten atıyor. Oyunun okuma yolu
 * mümkün olduğunca dar kalsın.
 */
export const ADMIN_COLUMNS = `${SONG_COLUMNS},created_at`
