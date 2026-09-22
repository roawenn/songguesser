import 'server-only'
import type { Gun } from '@/game/gun'
import type { LiderlikModu } from '@/game/liderlik'
import { restHeaders, restUrl } from '@/lib/supabase'

/** Liderlik RPC'leri — gizli anahtarla; e-posta ya da kullanıcı kimliği DÖNMEZ. */

async function rpc(ad: string, govde: unknown) {
  const res = await fetch(restUrl(`rpc/${ad}`), {
    method: 'POST',
    headers: restHeaders({ secret: true }),
    body: JSON.stringify(govde),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${ad} ${res.status}`)
  return res.json()
}

/*
 * ⚠️ `liderlikGetir` KALDIRILDI ve `liderlik()` RPC'si şemadan düşürüldü.
 * Herkese açık ilk-50 listesi, adlar Google profilinden geldiği için gerçek
 * ad soyad listesi demekti. Geriye yalnızca kişinin KENDİ sırası kalıyor.
 */

export interface BenimSiram {
  sira: number
  toplam: number
  gunSayisi: number
  oyuncu: number
}

export async function benimSiram(mod: LiderlikModu, bas: Gun, bit: Gun, kullaniciId: string): Promise<BenimSiram | null> {
  const [r] = (await rpc('liderlik_benim', { p_mod: mod, p_bas: bas, p_bit: bit, p_kullanici: kullaniciId })) as {
    sira: number
    toplam: number
    gun_sayisi: number
    oyuncu: number
  }[]
  return r ? { sira: Number(r.sira), toplam: Number(r.toplam), gunSayisi: Number(r.gun_sayisi), oyuncu: Number(r.oyuncu) } : null
}

/** Kullanıcının günlük geçmişi (seri için) — en fazla 400 gün. */
export async function skorGecmisi(mod: LiderlikModu, kullaniciId: string): Promise<{ gun: Gun; puan: number }[]> {
  const q = new URLSearchParams({
    mod: `eq.${mod}`,
    kullanici_id: `eq.${kullaniciId}`,
    select: 'donem,puan',
    order: 'donem.desc',
    limit: '400',
  })
  const res = await fetch(restUrl(`skor?${q}`), { headers: restHeaders({ secret: true }), cache: 'no-store' })
  if (!res.ok) throw new Error(`skor ${res.status}`)
  return ((await res.json()) as { donem: string; puan: number }[]).map((r) => ({ gun: r.donem, puan: r.puan }))
}
