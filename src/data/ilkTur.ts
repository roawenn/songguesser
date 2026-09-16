import type { ChipId, Difficulty } from './categories'
import type { Song } from './schema'
import { loadBaslangic } from './loadPool'
import { isaret } from '@/lib/olcum'

/**
 * İlk turun şarkısı — oyun kabuğu daha çizilmeden seçilir ve SESİ İNMEYE BAŞLAR.
 *
 * ⚠️ Ölçüldü (4G + 4x yavaş CPU): başlangıç paketi 714. ms'de hazırdı ama ses
 * isteği ancak kabuk çizilip tur kurulduktan sonra, 1699. ms'de yola çıkıyordu;
 * "Çal" 2350. ms'de açılıyordu. Kabuğun çizimi (~550 ms) ile sesin indirilmesi
 * SIRALI bekleniyordu, oysa ikisi birbirinden bağımsız.
 *
 * Ses motoru iki şeritli: burada şarkı BOŞTAKİ şeride yükleniyor, tur kurulurken
 * `arm()` aynı URL'i tutan şeridi seçiyor (bkz. `seritSec`) ve indirme kaldığı
 * yerden sürüyor.
 *
 * ⚠️ Seçilen şarkı `useRound`'a bırakılıyor (`ilkTurAdayiAl`); orada `pickNext`
 * başka bir şarkı seçseydi bu indirme çöpe giderdi.
 */

let aday: { anahtar: string; song: Song } | null = null

export function ilkTuruHazirla(id: ChipId, kademe: Difficulty): void {
  const anahtar = `${id}:${kademe}`
  void loadBaslangic(id, kademe).then(async (paket) => {
    if (paket.length === 0) return
    const song = paket[Math.floor(Math.random() * paket.length)]!
    // ⚠️ SENKRON atanıyor: `useRound` aynı söze sonradan bağlanıyor ve onun
    // geri çağrısı bundan sonra çalışıyor, adayı orada bulması gerekiyor.
    aday = { anahtar, song }
    /*
     * ⚠️ Ses motoru TEMBEL içe aktarılıyor: sayfa paketine girseydi her ziyarette
     * hidrasyondan önce ayrıştırılırdı. Kabuk parçasıyla aynı parçaya çözülüyor,
     * yani bu noktada genellikle zaten inmiş durumda.
     */
    const { clipPlayer } = await import('@/audio/ClipPlayer')
    if (aday?.song !== song || !song.p) return
    isaret('ses-onden')
    clipPlayer.prefetch({ id: song.id, url: song.p, clipStart: song.cs, duration: song.du })
  })
}

/**
 * Önden seçilen şarkıyı TEK KEZ teslim eder; seçki/kademe tutmuyorsa `null`.
 */
export function ilkTurAdayiAl(id: ChipId, kademe: Difficulty): Song | null {
  if (!aday || aday.anahtar !== `${id}:${kademe}`) return null
  const song = aday.song
  aday = null
  return song
}
