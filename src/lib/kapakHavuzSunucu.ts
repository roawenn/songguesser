import 'server-only'
import { randomInt } from 'node:crypto'
import { chipById, type ChipId } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import { DUELLO_TUR } from '@/game/duel'
import { grupla, type KapakSatiri } from '@/lib/kapakHavuz'
import { restHeaders, restTumSatirlar, restUrl } from '@/lib/supabase'

/**
 * Kapaktan Albüm havuzunun sunucu tarafı: seçki satırları, düello seçimi ve
 * kimlikle yükleme.
 *
 * ⚠️ Albüm kaydı TÜRETİLMİŞ bir kayıt: veritabanında albüm tablosu yok, her
 * albüm şarkı satırlarından `grupla` ile kuruluyor. Düello da bu yüzden aynı
 * `grupla`'dan geçiyor — başka bir yol, tek oyunculu oyundakinden farklı kademe,
 * yıl ya da kabul anahtarı üretebilirdi.
 */

const SUPABASE_TAZELE = 3600
const SUTUNLAR = 'id,artist,album,store_url,year,tier,category,norm_artist'

/** Bir seçkinin albümlü şarkı satırları — kenar önbellekli (`havuz` etiketi). */
export async function kapakSatirlari(chip: ChipId): Promise<KapakSatiri[]> {
  const source = chipById(chip).source
  const params = new URLSearchParams({
    select: SUTUNLAR,
    enabled: 'eq.true',
    album: 'not.is.null',
    // Sayfalamanın tutarlı olması için sıra ŞART (bkz. `api/havuz`).
    order: 'id.asc',
  })
  // Yıl süzgeci istemcide (bkz. `havuzSunucu`'daki aynı gerekçe).
  if (source.kind === 'genre') params.set('category', `eq.${source.genre}`)

  return restTumSatirlar<KapakSatiri>(`songs?${params}`, {
    headers: restHeaders() as Record<string, string>,
    next: { revalidate: SUPABASE_TAZELE, tags: ['havuz'] },
  })
}

/**
 * Düellonun beş albümü: kademe 1'den 5'e, her kademeden rastgele bir tane.
 *
 * ⚠️ Kademe TAM eşleşmeli (`filterByTier` değil) — şarkı ve ünlü düellosuyla
 * aynı kural; bir kademe boşsa lobi kurulmaz.
 */
export async function kapakTurleriSec(chip: ChipId): Promise<string[] | null> {
  const havuz = grupla(await kapakSatirlari(chip))
  const secilen: string[] = []
  for (let kademe = 1; kademe <= DUELLO_TUR; kademe++) {
    const adaylar = havuz.filter((k) => k.d === kademe)
    if (adaylar.length === 0) return null
    secilen.push(adaylar[randomInt(adaylar.length)]!.id)
  }
  return secilen
}

/**
 * Kimliklerine göre albümleri getirir — SIRAYI KORUYARAK (sıra kademe rampası).
 *
 * ⚠️ Albümün TÜM şarkıları okunur, yalnızca biri değil: kademe albümdeki en
 * kolay şarkıdan, yıl en erkeninden geliyor. Tek şarkıdan kurulsaydı düellodaki
 * albüm tek oyunculu oyundakinden farklı bir kademe ve yılla görünebilirdi.
 */
export async function loadKapaklarByIds(ids: string[]): Promise<Kapak[]> {
  const albumler = ids
    .map((i) => /^kapak:(\d+)$/.exec(i)?.[1])
    .filter((a): a is string => Boolean(a))
  if (albumler.length === 0) return []

  // Mağaza adresi: `…/album/<ad>/<albüm kimliği>?i=<şarkı>`; sorgu dizesi olmayanlar da var.
  const kosullar = albumler.flatMap((a) => [`store_url.like."*/album/*/${a}?*"`, `store_url.like."*/album/*/${a}"`])
  const params = new URLSearchParams({
    select: SUTUNLAR,
    enabled: 'eq.true',
    album: 'not.is.null',
    or: `(${kosullar.join(',')})`,
    order: 'id.asc',
  })

  const res = await fetch(restUrl(`songs?${params}`), {
    headers: restHeaders() as Record<string, string>,
    cache: 'no-store',
  })
  if (!res.ok) return []

  const byId = new Map(grupla((await res.json()) as KapakSatiri[]).map((k) => [k.id, k]))
  return ids.map((i) => byId.get(i)).filter((k): k is Kapak => Boolean(k))
}
