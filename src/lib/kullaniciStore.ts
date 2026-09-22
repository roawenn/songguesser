import 'server-only'
import { restHeaders, restUrl } from '@/lib/supabase'

/**
 * Kullanıcı kayıtları — yalnızca sunucuda, gizli anahtarla.
 */

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

export interface GoogleKaydi {
  id: string
  ad: string | null
  banli: boolean
}

/** Google'dan gelip denetimden geçmiş ad. */
export interface YazilacakAd {
  ad: string
  norm: string
}

/** Yönetimin sıfırladığı bir ad mı? Hata hâlinde "değil" sayılır (giriş engellenmesin). */
async function yasakliMi(norm: string): Promise<boolean> {
  const res = await rest(`yasakli_adlar?norm=eq.${encodeURIComponent(norm)}&select=norm`)
  if (!res.ok) return false
  return ((await res.json()) as unknown[]).length > 0
}

/**
 * `sub` ile bulur ya da oluşturur; adı Google profilinden yazar.
 *
 * ⚠️ AD HER GİRİŞTE TAZELENİR. Eskiden gövdede ad YOKTU, çünkü oyuncu onu elle
 * seçiyordu ve `merge-duplicates` her girişte seçimi ezerdi. Artık ad Google'ın
 * adı; kişi Google'da adını düzeltince burası da düzelmeli.
 *
 * ⚠️ Yönetimin sıfırladığı ad (`yasakli_adlar`) GERİ GELMEZ: o durumda ad
 * yazılmaz, kayıt adsız kalır. Adsız hesap oynayabilir, yalnızca sıralamada
 * görünmez (bkz. `liderlik_benim`).
 *
 * ⚠️ 409 geri düşüşü bilinçli: `kullanici_adi_norm` üzerindeki BENZERSİZLİK
 * kısıtı kaldırıldı (aynı adlı iki kişi olabilir, kimse kimsenin adını
 * görmüyor), ama şeması güncellenmemiş bir veritabanında yazma çakışırsa giriş
 * çökmesin — ad olmadan tekrar denenir.
 */
export async function googleIleBul(sub: string, email: string, yeniAd: YazilacakAd | null): Promise<GoogleKaydi> {
  const adYazilir = yeniAd && !(await yasakliMi(yeniAd.norm)) ? yeniAd : null

  const yaz = async (ad: YazilacakAd | null) =>
    rest('kullanicilar?on_conflict=google_sub&select=id,kullanici_adi,banli_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        google_sub: sub,
        email,
        son_giris: new Date().toISOString(),
        ...(ad ? { kullanici_adi: ad.ad, kullanici_adi_norm: ad.norm } : {}),
      }),
    })

  let res = await yaz(adYazilir)
  if (res.status === 409 && adYazilir) res = await yaz(null)
  if (!res.ok) throw new Error(`kullanicilar ${res.status}`)

  const [r] = (await res.json()) as { id: string; kullanici_adi: string | null; banli_at: string | null }[]
  if (!r) throw new Error('kullanıcı dönmedi')
  return { id: r.id, ad: r.kullanici_adi, banli: r.banli_at !== null }
}

/**
 * Hesabı siler. Oturumlar ve skorlar kademeli silinir; günlük oturumlar
 * kalır ama kullanıcıdan kopar (dağılım istatistiği bozulmasın).
 */
export async function kullaniciSil(id: string): Promise<boolean> {
  const res = await rest(`kullanicilar?id=eq.${id}`, { method: 'DELETE' })
  return res.ok
}
