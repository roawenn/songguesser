import 'server-only'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { chipById, CATEGORY_IDS, type ChipId, type Difficulty } from '@/data/categories'
import type { Pool, Song } from '@/data/schema'
import { BASLANGIC_ADET, seckiParametreleri } from '@/lib/havuzDilim'
import {
  POOL_COLUMNS, restHeaders, restTumSatirlar, restUrl, toSong, supabaseReady, type SongRow,
} from '@/lib/supabase'

/**
 * Şarkı havuzunun sunucu tarafı: seçki satırları (tam havuz ve kademe
 * dilimleri bunlardan türer) ve başlangıç paketi.
 *
 * İki koruma var:
 *
 * 1. **Kenar önbelleği.** Supabase okuması Next'in veri önbelleğinde `havuz`
 *    etiketiyle tutulur; panelden kaydedince etiket geçersizleşir.
 *
 * 2. **Statik yedek.** Supabase'e ulaşılamazsa son üretilen
 *    `public/data/pool/*.json` devreye girer — veritabanı kesintisi oyunu
 *    durdurmaz.
 */

/**
 * Supabase'den havuzun yeniden OKUNMA aralığı.
 *
 * ⚠️ Bu, tazelikle ilgili DEĞİL. Panelden kaydedince `revalidateTag('havuz')`
 * çalışıyor ve yayın anında oluyor; zamanlayıcı yalnızca "hiç kimse bir şey
 * değiştirmediyse yine de tazele" demek.
 *
 * 60 saniyeydi. Havuz 15358 satıra çıkınca bunun bedeli ölçüldü: trafik olan
 * bir sitede dakikada bir tam okuma, günde ~1440 kez ~4 MB = 5+ GB — Supabase
 * ücretsiz planın AYLIK 5 GB kotası bir günde biterdi.
 */
const SUPABASE_TAZELE = 3600

/** Bellekteki satırların taze sayıldığı süre — `lib/sikistir` ile aynı. */
const TTL_MS = 60_000
/** Bu süreye kadar bayat satırlar verilir, tazeleme arkada sürer. */
const BAYAT_MS = 10 * 60_000

export interface HavuzSonucu {
  songs: Song[]
  kaynak: 'supabase' | 'yedek'
}

/**
 * Diskten okunan kategoriler — süreç ömrü boyunca bir kez.
 *
 * ⚠️ Eskiden yedek moddaki HER istek yedi JSON dosyasını yeniden okuyup
 * yeniden ayrıştırıyordu. Supabase kesintisi zaten kötü bir an; üstüne her
 * istekte disk I/O eklemenin anlamı yok.
 */
const diskOnbellek = new Map<string, Song[]>()

function fallbackFromDisk(chip: ChipId): Song[] {
  const readCat = (cat: string): Song[] => {
    const hit = diskOnbellek.get(cat)
    if (hit) return hit

    const file = join(process.cwd(), 'public/data/pool', `${cat}.json`)
    let out: Song[] = []
    try {
      /*
       * ⚠️ `JSON.parse` BURADA try/catch içinde olmalı: bozuk ya da yarım
       * yazılmış bir havuz dosyası `GET`'ten dışarı fırlıyor, 500'e dönüşüyor
       * ve oyun "Şarkı listesi yüklenemedi" ekranına düşüyordu — yedeğin tam
       * olarak önlemesi gereken şey.
       */
      if (existsSync(file)) {
        out = (JSON.parse(readFileSync(file, 'utf8')) as Pool).songs.filter((s) => s.off !== 1)
      }
    } catch {
      out = []
    }
    diskOnbellek.set(cat, out)
    return out
  }

  const source = chipById(chip).source
  if (source.kind === 'genre') return readCat(source.genre)

  const all = CATEGORY_IDS.flatMap(readCat)
  if (source.kind === 'all') return all
  const eras = new Set<string>(source.eras)
  return all.filter((s) => eras.has(s.e))
}

async function fromSupabase(chip: ChipId): Promise<Song[]> {
  const source = chipById(chip).source
  const params = new URLSearchParams({
    select: POOL_COLUMNS,
    enabled: 'eq.true',
    // Sıralama sayfalamanın tutarlı olması için ŞART: sırasız bir sorguda
    // planlayıcı sayfalar arasında aynı satırı iki kez verebilir ya da atlayabilir.
    order: 'id.asc',
  })

  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)
  else if (source.kind === 'eras') params.set('era', `in.(${source.eras.join(',')})`)

  const rows = await restTumSatirlar<SongRow>(`songs?${params}`, {
    headers: restHeaders() as Record<string, string>,
    // Next'in veri önbelleği: etiketle geçersizleştirilebilir.
    next: { revalidate: SUPABASE_TAZELE, tags: ['havuz'] },
  })
  return rows.map(toSong)
}

async function uret(chip: ChipId): Promise<HavuzSonucu> {
  let songs: Song[] = []
  let kaynak: HavuzSonucu['kaynak'] = 'supabase'

  if (supabaseReady) {
    try {
      songs = await fromSupabase(chip)
    } catch {
      kaynak = 'yedek'
    }
  } else {
    kaynak = 'yedek'
  }

  // Supabase boş döndüyse de yedeğe düş: yeni kurulumda tablo boş olabilir.
  if (songs.length === 0) {
    songs = fallbackFromDisk(chip)
    if (songs.length > 0) kaynak = 'yedek'
  }

  return { songs, kaynak }
}

const bellek = new Map<ChipId, { zaman: number; deger: HavuzSonucu }>()
const ucusta = new Map<ChipId, Promise<HavuzSonucu>>()

function tazele(chip: ChipId): Promise<HavuzSonucu> {
  const suren = ucusta.get(chip)
  if (suren) return suren
  const soz = uret(chip)
    .then((deger) => {
      bellek.set(chip, { zaman: Date.now(), deger })
      return deger
    })
    .finally(() => ucusta.delete(chip))
  ucusta.set(chip, soz)
  return soz
}

/**
 * Seçkinin bütün açık şarkıları.
 *
 * ⚠️ Tam havuz ve beş kademe dilimi AYNI satırlardan türüyor ve bu önbellek
 * bunun için var. Her yanıt anahtarı (`havuz:karisik:3` …) kendi soğuk
 * üretimini ayrı ayrı yapsaydı, soğuk bir sunucu örneğinde bir seçki altı kez
 * 16 sayfalık Supabase okuması yapardı. Uçuştaki okuma da paylaşılıyor.
 *
 * Bayat satırlar verilip tazeleme arkada sürüyor (`lib/sikistir` ile aynı fikir).
 */
export async function havuzSatirlari(chip: ChipId): Promise<HavuzSonucu> {
  const kayit = bellek.get(chip)
  if (kayit) {
    const yas = Date.now() - kayit.zaman
    if (yas < TTL_MS) return kayit.deger
    if (yas < BAYAT_MS) {
      tazele(chip).catch(() => undefined)
      return kayit.deger
    }
  }
  return tazele(chip)
}

/**
 * Başlangıç paketi: kademeden rastgele şarkılar, OYNANABİLİRLİK ALANLARI DAHİL.
 *
 * ⚠️ Tam havuz OKUNMAZ. Tek bir RPC (`baslangic_sec`, `order by random()
 * limit n`) — soğuk sunucu örneğinde bile 16 sayfalık okumayı beklemeden ilk
 * tur kurulabilsin diye var. Hata ya da yapılandırma eksikliğinde boş dizi:
 * istemci o zaman kademe dilimini bekler.
 */
export async function baslangicSec(chip: ChipId, kademe: Difficulty): Promise<Song[]> {
  if (!supabaseReady) return []
  try {
    const res = await fetch(restUrl('rpc/baslangic_sec'), {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify({ ...seckiParametreleri(chip), p_kademe: kademe, p_adet: BASLANGIC_ADET }),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const satirlar = (await res.json()) as SongRow[]
    return satirlar.map(toSong).filter((s) => s.off !== 1 && s.p)
  } catch {
    return []
  }
}
