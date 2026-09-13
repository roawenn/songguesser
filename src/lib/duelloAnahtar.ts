/**
 * Düello gizli anahtarının tarayıcı tarafındaki deposu.
 *
 * ⚠️ Modül düzeyinde bir YEDEK şart. Lobiyi kuran kişinin anahtarı
 * `localStorage`'a yazılamazsa (Safari Gizli Gezinti, iOS Kilitleme Modu,
 * "tüm çerezleri engelle") düello sayfası onu yabancı sanıp **kendi lobisine
 * 2. oyuncu olarak katılıyordu**: lobi doluyordu, davet edilen arkadaş 409
 * alıyordu ve kuran kişi hiç cevap vermeyecek bir hayalet rakiple oynayıp her
 * şarkıda 90 saniye bekliyordu.
 *
 * ⚠️ Bu yedek yalnızca istemci tarafı gezinmede yaşar; tam sayfa yüklemesi onu
 * siler. Bu yüzden `GameShell` düello sayfasına `router.push` ile geçiyor,
 * `window.location.href` ile değil.
 */

const bellek = new Map<string, string>()

const anahtarAdi = (kod: string) => `tahmin:duello:${kod}`

export function anahtarYaz(kod: string, gizli: string): void {
  bellek.set(kod, gizli)
  try {
    window.localStorage.setItem(anahtarAdi(kod), gizli)
  } catch {
    // Kalıcı olamadı; bellekteki kopya bu gezinme boyunca yeterli.
  }
}

export function anahtarOku(kod: string): string | null {
  try {
    const kalici = window.localStorage.getItem(anahtarAdi(kod))
    if (kalici) return kalici
  } catch {
    // Site verisi engelli olabilir; yedeğe düş.
  }
  return bellek.get(kod) ?? null
}
