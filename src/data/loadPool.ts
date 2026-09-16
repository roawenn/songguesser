import type { Song } from './schema'
import type { ChipId, Difficulty } from './categories'
import { alanlariYaz } from './loadSongFields'
import { isaret } from '@/lib/olcum'

/** Uçuştaki ya da tamamlanmış istek — çifte istek olmasın diye SÖZ saklanıyor. */
const cache = new Map<string, Promise<Song[]>>()

/**
 * Bir şerit çipinin şarkılarını yükler.
 *
 * `kademe` verilirse yalnızca o kademenin DİLİMİ iner (bkz. `api/havuz`):
 * Karışık'ta 543 KB yerine 40-190 KB. Verilmezse tam havuz — sanatçı modu ve
 * yayıncı modu bunu kullanıyor.
 *
 * Kaynak `/api/havuz/<çip>`: sunucu Supabase'den okur, kenarda önbelleğe alır
 * ve veritabanına ulaşamazsa statik yedeğe düşer. İstemci burada yalnızca
 * oturum içi bir bellek önbelleği tutar — aynı seçkiye dönüldüğünde ağa
 * tekrar gidilmez.
 *
 * ⚠️ Önbellekte DİZİ değil SÖZ tutuluyor. Dizi tutulduğunda, aynı çip için üst
 * üste binen iki çağrı (havuzu erken ısıtan çağrı ile turu kuran çağrı) iki
 * ayrı ağ isteği atıyordu.
 */
export async function loadChip(id: ChipId, kademe?: Difficulty): Promise<Song[]> {
  const anahtar = `${id}:${kademe ?? 'tam'}`
  const hit = cache.get(anahtar)
  if (hit) return hit

  const istek = (async () => {
    isaret(`havuz-istek:${anahtar}`)
    const res = await fetch(kademe ? `/api/havuz/${id}?kademe=${kademe}` : `/api/havuz/${id}`)
    if (!res.ok) throw new Error(`Havuz yüklenemedi: ${anahtar}`)

    const data = (await res.json()) as { songs: Song[]; kaynak: string }
    isaret(`havuz-geldi:${anahtar}`)
    // Kapatılmış şarkılar sunucuda zaten süzülüyor; yine de güvenceye al.
    const songs = data.songs.filter((s) => s.off !== 1)

    /**
     * ⚠️ YEDEK yanıt kalıcı olarak önbelleğe ALINMAZ.
     *
     * Supabase'e tek bir geçici erişim hatası, oyuncuyu diskteki eski anlık
     * görüntüye (bu yazılırken 5089 şarkının yalnızca 321'i) sekmenin ömrü
     * boyunca sabitliyordu — üstelik hiçbir belirti vermeden. Yedek yanıt
     * kullanılır ama saklanmaz; bir sonraki çağrı canlı havuzu yeniden dener.
     */
    if (data.kaynak !== 'supabase') cache.delete(anahtar)

    return songs
  })()

  cache.set(anahtar, istek)
  // Başarısız istek önbellekte kalırsa çip bir daha hiç yüklenemez.
  istek.catch(() => cache.delete(anahtar))
  return istek
}

/**
 * Başlangıç paketinin yeniden kullanılabileceği süre — sunucudaki
 * `s-maxage` ile aynı.
 *
 * ⚠️ Kısa ömürlü önbellek şart: paketi ısıtan çağrı (`havuzuIsit`) ile turu
 * kuran çağrı üst üste biniyor, StrictMode efektleri de iki kez çalışıyor.
 * Uzun tutulsaydı seçkiye her dönüşte AYNI şarkılar gelirdi.
 */
const PAKET_OMRU_MS = 30_000
const paketler = new Map<string, { zaman: number; soz: Promise<Song[]> }>()

/**
 * Başlangıç paketi: kademeden birkaç rastgele şarkı, önizlemeleriyle birlikte.
 *
 * İlk tur bununla, havuz dilimini ve `/api/sarki`'yi beklemeden kurulur.
 *
 * ⚠️ ASLA REDDETMEZ: paket bir hızlandırma, zorunluluk değil. Hata ya da boş
 * yanıtta `[]` döner ve oyun dilimi bekleyen eski yola düşer.
 */
export function loadBaslangic(id: ChipId, kademe: Difficulty): Promise<Song[]> {
  const anahtar = `${id}:${kademe}`
  const kayit = paketler.get(anahtar)
  if (kayit && Date.now() - kayit.zaman < PAKET_OMRU_MS) return kayit.soz

  const soz = (async () => {
    try {
      isaret(`baslangic-istek:${anahtar}`)
      const res = await fetch(`/api/baslangic/${id}?kademe=${kademe}`)
      if (!res.ok) return []
      const data = (await res.json()) as { songs?: Song[] }
      const songs = (data.songs ?? []).filter((s) => s.off !== 1 && s.p)
      isaret(`baslangic-geldi:${anahtar}`)
      alanlariYaz(songs)
      return songs
    } catch {
      return []
    }
  })()

  paketler.set(anahtar, { zaman: Date.now(), soz })
  // Boş paket saklanmasın: bir sonraki açılış yeniden denesin.
  void soz.then((songs) => {
    if (songs.length === 0 && paketler.get(anahtar)?.soz === soz) paketler.delete(anahtar)
  })
  return soz
}

/**
 * Havuzu, oyun kabuğu daha yüklenmeden indirmeye başlat.
 *
 * `kademe` verilirse dilim ve başlangıç paketi PARALEL başlar; verilmezse
 * (sanatçı modu) tam havuz.
 *
 * ⚠️ `GameShell` `ssr: false` ile tembel yükleniyor, yani havuz isteği o parça
 * inip çalışmadan ÖNCE başlayamıyordu: HTML → ana paket → kabuk parçası →
 * mount → havuz. Bu çağrı zinciri kısaltıyor. Sabit bir `<link rel="preload">`
 * yerine burada durmasının nedeni seçkinin `localStorage`'da yaşaması —
 * varsayılan dışında bir seçki kullanan oyuncuya yanlış havuzu indirtmez.
 */
export function havuzuIsit(id: ChipId, kademe?: Difficulty): void {
  void loadChip(id, kademe).catch(() => {
    // Gerçek hata, turu kuran çağrıda ele alınıyor.
  })
  if (kademe) void loadBaslangic(id, kademe)
}
