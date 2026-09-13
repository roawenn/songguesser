import type { Song } from './schema'
import type { ChipId } from './categories'

/** Uçuştaki ya da tamamlanmış istek — çifte istek olmasın diye SÖZ saklanıyor. */
const cache = new Map<ChipId, Promise<Song[]>>()

/**
 * Bir şerit çipinin şarkılarını yükler.
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
export async function loadChip(id: ChipId): Promise<Song[]> {
  const hit = cache.get(id)
  if (hit) return hit

  const istek = (async () => {
    const res = await fetch(`/api/havuz/${id}`)
    if (!res.ok) throw new Error(`Havuz yüklenemedi: ${id}`)

    const data = (await res.json()) as { songs: Song[]; kaynak: string }
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
    if (data.kaynak !== 'supabase') cache.delete(id)

    return songs
  })()

  cache.set(id, istek)
  // Başarısız istek önbellekte kalırsa çip bir daha hiç yüklenemez.
  istek.catch(() => cache.delete(id))
  return istek
}

/**
 * Havuzu, oyun kabuğu daha yüklenmeden indirmeye başlat.
 *
 * ⚠️ `GameShell` `ssr: false` ile tembel yükleniyor, yani havuz isteği o parça
 * inip çalışmadan ÖNCE başlayamıyordu: HTML → ana paket → kabuk parçası →
 * mount → havuz. Bu çağrı zinciri kısaltıyor. Sabit bir `<link rel="preload">`
 * yerine burada durmasının nedeni seçkinin `localStorage`'da yaşaması —
 * varsayılan dışında bir seçki kullanan oyuncuya yanlış havuzu indirtmez.
 */
export function havuzuIsit(id: ChipId): void {
  void loadChip(id).catch(() => {
    // Gerçek hata, turu kuran çağrıda ele alınıyor.
  })
}
