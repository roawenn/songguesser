import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import { chipById, unluChipById, type ChipId, type UnluChipId } from '@/data/categories'
import { restUrl, restHeaders } from '@/lib/supabase'
import { DUELLO_TUR, kodUret, type DuelloOyun } from '@/game/duel'
import { kapakTurleriSec } from '@/lib/kapakHavuzSunucu'

/**
 * Düello veri katmanı — yalnızca SUNUCUDA.
 *
 * Üç tablo da RLS altında ve hiçbir politikası yok; okuma da yazma da buradan,
 * secret key ile geçer. Tarayıcı `duels.song_ids`'i doğrudan okuyamaz.
 */

export interface DuelRow {
  code: string
  /** ⚠️ Hangi oyun — bu olmadan `/duello/<kod>` kabuğu seçemez. */
  oyun: DuelloOyun
  /** Şarkıda `ChipId`, ünlüde `UnluChipId`. */
  chip: ChipId | UnluChipId
  song_ids: string[]
  /** Yalnızca kapak düellosu: lobiyi kuranın Kolay mod tercihi. Diğerlerinde null. */
  kolay: boolean | null
  status: 'bekliyor' | 'oynaniyor' | 'bitti'
  /** Rövanş lobisinin kodu — henüz istenmediyse `null`. */
  tekrar_kod: string | null
  created_at: string
  started_at: string | null
  expires_at: string
}

export interface AnswerRow {
  slot: 1 | 2
  song_index: number
  won: boolean
  /** Oyundan bağımsız maliyet — az olan iyi. */
  maliyet: number
  ikincil: number
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
export async function turleriSec(
  oyun: DuelloOyun,
  chip: ChipId | UnluChipId,
): Promise<string[] | null> {
  /*
   * ⚠️ İki oyunun seçim uzayı farklı: şarkıda tür VE dönem, ünlüde yalnızca
   * kategori. Tek bir RPC'ye sıkıştırmak dinamik tablo adı demekti; o da
   * `distinct on (tier)` planını ve `stable` işaretini kaybettirirdi.
   */
  // Kapakta albüm kaydı veritabanında değil, şarkı satırlarından türetiliyor —
  // seçim de o yüzden SQL fonksiyonunda değil `grupla` üzerinden.
  if (oyun === 'kapak') return kapakTurleriSec(chip as ChipId)

  if (oyun === 'unlu') {
    const c = unluChipById(chip as UnluChipId)
    const r = await rest('rpc/duello_sec_unlu', {
      method: 'POST',
      body: JSON.stringify({ p_kategori: c.kategori }),
    })
    if (!r.ok) return null
    const satirlar = (await r.json()) as { id: string; tier: number }[]
    if (satirlar.length !== DUELLO_TUR) return null
    return [...satirlar].sort((a, b) => a.tier - b.tier).map((x) => x.id)
  }

  const source = chipById(chip as ChipId).source

  /*
   * ⚠️ Seçim TEK SORGUDA ve veritabanında yapılıyor (`duello_sec`).
   *
   * Eskiden beş ayrı sorgu atılıyor, her biri `limit=400` ile TAM satırı
   * (başlık, sanatçı, kapak, önizleme URL'i, accept_keys) çekiyordu: ~200
   * baytlık bir istek 2000 satır okutuyor, 5'i kullanılıyordu. Kimlik
   * doğrulaması olmayan bir uç nokta için bu, ücretsiz kademenin aylık
   * çıkışını birkaç bin istekte bitirebilecek bir yükselteçti.
   *
   * ⚠️ İkinci hatayı da kapatıyor: o `limit=400`'ün ORDER BY'ı yoktu, yani
   * planlayıcının fiziksel sırası geçerliydi ve düellolar hep aynı ~400 en
   * eski satırdan seçiliyordu. Artık `order by tier, random()`.
   */
  const res = await rest('rpc/duello_sec', {
    method: 'POST',
    body: JSON.stringify({
      p_kategori: source.kind === 'genre' ? source.genre : null,
      p_donemler: source.kind === 'eras' ? source.eras : null,
    }),
  })
  if (!res.ok) return null

  const rows = (await res.json()) as { id: string; tier: number }[]
  // Her kademeden bir tane gelmeli; biri boşsa bu seçki düelloya yetmiyor.
  if (rows.length !== DUELLO_TUR) return null

  return [...rows].sort((a, b) => a.tier - b.tier).map((r) => r.id)
}

/** Benzersiz bir kodla lobi kurar. */
export async function duelloKur(
  oyun: DuelloOyun,
  chip: ChipId | UnluChipId,
  songIds: string[],
  kolay: boolean | null = null,
): Promise<{ code: string; secret: string } | null> {
  // ⚠️ Çakışma ihtimali düşük ama sıfır değil; birkaç kez dene.
  for (let deneme = 0; deneme < 5; deneme++) {
    const code = kodUret((n) => randomBytes(n))
    const res = await rest('duels', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code, oyun, chip, song_ids: songIds, kolay }),
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

    /*
     * ⚠️ Süresi dolmuş satırları TOPLAYAN bir zamanlayıcı yok. `temizle()`
     * yazıldı ama onu çağıran hiçbir şey yoktu; lobiler, biten oturumlar ve
     * hız sınırı sayaçları sonsuza kadar birikiyordu. Supabase'de pg_cron
     * kurulana kadar seyrek ve fırsatçı olarak burada tetikleniyor: her 50
     * lobide bir, yanıtı beklenmeden.
     */
    if (randomBytes(1)[0]! < 5) {
      void rest('rpc/temizle', { method: 'POST', body: '{}' }).catch(() => {})
    }

    return { code, secret }
  }
  return null
}

/**
 * Rövanş kodunu yazar — ÖNCE YAZAN KAZANIR.
 *
 * ⚠️ Yarış gerçek: bitiş ekranında iki oyuncu da aynı anda "Tekrar oyna"ya
 * basabilir. `tekrar_kod=is.null` koşulu bunu veritabanında çözüyor; okuyup
 * sonra yazmak iki ayrı lobi kurar ve oyuncular farklı odalarda birbirini
 * beklerdi.
 *
 * Dönen değer GEÇERLİ olan koddur: yazma tutmadıysa rakibin kurduğu kod.
 */
export async function tekrarKodAyarla(code: string, yeniKod: string): Promise<string> {
  const res = await rest(
    `duels?code=eq.${encodeURIComponent(code)}&tekrar_kod=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ tekrar_kod: yeniKod }),
    },
  )
  if (res.ok) {
    const rows = (await res.json()) as DuelRow[]
    if (rows.length === 1) return yeniKod
  }
  // Yazma tutmadı: araya giren yazmanın kodunu oku.
  const mevcut = await duelloOku(code)
  return mevcut?.tekrar_kod ?? yeniKod
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
    `duel_answers?code=eq.${encodeURIComponent(code)}&select=slot,song_index,won,maliyet,ikincil&order=song_index.asc`,
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
  a: { songIndex: number; won: boolean; maliyet: number; ikincil: number },
): Promise<boolean> {
  const res = await rest('duel_answers', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      code,
      slot,
      song_index: a.songIndex,
      won: a.won,
      maliyet: a.maliyet,
      ikincil: a.ikincil,
      /*
       * ⚠️ Eski ses kolonları da yazılıyor: ikisi de NOT NULL ve varsayılanı
       * yok. Şemadan düşürmek yerine doldurmak seçildi — düşürmek, göç
       * sırasında yazılmış eski satırları okunamaz hâle getirirdi.
       */
      heard_seconds: a.maliyet,
      listens: a.ikincil,
    }),
  })
  return res.ok
}

/** Gizli anahtarı doğrular; sahte cevap yazmayı engeller. */
export async function slotDogrula(code: string, secret: string): Promise<1 | 2 | null> {
  const hepsi = await oyuncular(code)
  return hepsi.find((p) => p.secret === secret)?.slot ?? null
}
