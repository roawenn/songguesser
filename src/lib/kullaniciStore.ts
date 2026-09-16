import 'server-only'
import { restHeaders, restUrl } from '@/lib/supabase'

/**
 * Kullanıcı kayıtları — yalnızca sunucuda, gizli anahtarla.
 */

/** Ad değişikliği aralığı. İLK seçim bu sınıra tabi değil. */
export const AD_DEGISIM_GUN = 30

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

/**
 * `sub` ile bulur ya da oluşturur.
 *
 * ⚠️ Gövdede YALNIZCA `google_sub`, `email`, `son_giris`: `merge-duplicates`
 * gönderilen kolonları günceller; ad gönderilseydi her girişte ezilirdi.
 */
export async function googleIleBul(sub: string, email: string): Promise<GoogleKaydi> {
  const res = await rest('kullanicilar?on_conflict=google_sub&select=id,kullanici_adi,banli_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ google_sub: sub, email, son_giris: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`kullanicilar ${res.status}`)
  const [r] = (await res.json()) as { id: string; kullanici_adi: string | null; banli_at: string | null }[]
  if (!r) throw new Error('kullanıcı dönmedi')
  return { id: r.id, ad: r.kullanici_adi, banli: r.banli_at !== null }
}

export function adDegisebilirTarih(adDegisti: string | null): Date | null {
  if (!adDegisti) return null
  const t = new Date(Date.parse(adDegisti) + AD_DEGISIM_GUN * 86_400_000)
  return t.getTime() > Date.now() ? t : null
}

export type AdAyarSonucu = 'ok' | 'alinmis' | 'erken' | 'yasakli' | 'hata'

/**
 * Adı yazar.
 *
 * ⚠️ İLK AD `ad_degisti`'ye yazılmaz: yeni gelen oyuncu yazım hatası yaptıysa
 * 30 gün beklemesin. Var olan ad değişince tarih yazılır.
 *
 * ⚠️ 30 gün sınırı PATCH'in KOŞULUNDA: okuyup sonra yazmak iki eşzamanlı
 * istekle aşılabilirdi.
 */
export async function adAyarla(
  kullanici: { id: string; ad: string | null },
  ad: string,
  norm: string,
): Promise<AdAyarSonucu> {
  const yasak = await rest(`yasakli_adlar?norm=eq.${encodeURIComponent(norm)}&select=norm`)
  if (!yasak.ok) return 'hata'
  if (((await yasak.json()) as unknown[]).length > 0) return 'yasakli'

  const sinir = new Date(Date.now() - AD_DEGISIM_GUN * 86_400_000).toISOString()
  const q = new URLSearchParams({ id: `eq.${kullanici.id}` })
  if (kullanici.ad !== null) q.set('or', `(ad_degisti.is.null,ad_degisti.lt.${sinir})`)

  const res = await rest(`kullanicilar?${q}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal,count=exact' },
    body: JSON.stringify({
      kullanici_adi: ad,
      kullanici_adi_norm: norm,
      ...(kullanici.ad !== null ? { ad_degisti: new Date().toISOString() } : {}),
    }),
  })
  if (res.status === 409) return 'alinmis'
  if (!res.ok) return 'hata'
  const n = Number(res.headers.get('content-range')?.split('/')[1])
  return n === 1 ? 'ok' : 'erken'
}

/**
 * Hesabı siler. Oturumlar ve skorlar kademeli silinir; günlük oturumlar
 * kalır ama kullanıcıdan kopar (dağılım istatistiği bozulmasın).
 */
export async function kullaniciSil(id: string): Promise<boolean> {
  const res = await rest(`kullanicilar?id=eq.${id}`, { method: 'DELETE' })
  return res.ok
}
