/**
 * OAuth ara çerezinin biçimi — SAF, testli.
 *
 * Google'a giderken `state`, PKCE `verifier`, dönüş yolu ve "bu akış ne için"
 * bilgisi tek bir çerezde taşınıyor (sunucuda state tablosu yok).
 *
 * ⚠️ TÜR EN BAŞTA, DÖNÜŞ YOLU EN SONDA. Eski biçim `state.verifier.donus` idi
 * ve `donus` noktalı bir yolsa (`/g.unluk`) `split('.')` onu sessizce kırpıyordu
 * — var olan bir kusur. Yol artık kalan parçaların tamamı olarak toplanıyor.
 *
 * ⚠️ TÜR BİR YETKİ TAŞIMAZ. `'y'` yalnızca "dönüşte yönetici oturumu da açmayı
 * dene" niyetidir; yetkinin kendisi dönüşte `YONETICI_EPOSTALAR` listesinden
 * yeniden doğrulanır. Çerez `httpOnly` ve `__Host-` önekli olduğu için zaten
 * tarayıcıdan yazılamaz, ama yazılabilseydi bile bir şey kazandırmazdı.
 */

/** `o` = oyuncu girişi, `y` = yönetici yükseltmesi. */
export type OturumTuru = 'o' | 'y'

export function oauthCerezYaz(tur: OturumTuru, state: string, verifier: string, donus: string): string {
  return `${tur}.${state}.${verifier}.${encodeURIComponent(donus)}`
}

export interface OauthCerez {
  tur: OturumTuru
  state: string
  verifier: string
  /** Hâlâ kodlanmış — çözme ve `donusYolu` denetimi çağırana ait. */
  donusHam: string
}

export function oauthCerezCoz(ham: string): OauthCerez {
  const [tur = '', state = '', verifier = '', ...kalan] = ham.split('.')
  return {
    // Tanınmayan tür oyuncu sayılır: yükseltme asla varsayılan olmamalı.
    tur: tur === 'y' ? 'y' : 'o',
    state,
    verifier,
    donusHam: kalan.join('.'),
  }
}
