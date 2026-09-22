import 'server-only'
import { restHeaders, restUrl } from '@/lib/supabase'

/**
 * Hesaba bağlı oyun istatistikleri — yalnızca sunucuda, gizli anahtarla.
 *
 * ⚠️ Tablo RLS altında ve politikasız: tarayıcı Supabase'e doğrudan hiç
 * bağlanmıyor, her okuma/yazma bu dosyadan geçiyor (`lib/kullaniciStore` ile
 * aynı desen).
 */

export const OYUNLAR = ['sarki', 'unlu', 'kapak'] as const
export type Oyun = (typeof OYUNLAR)[number]

export function oyunGecerli(s: unknown): s is Oyun {
  return typeof s === 'string' && (OYUNLAR as readonly string[]).includes(s)
}

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

/** Kullanıcının bütün oyunlardaki ham sayaçları; yoksa alan hiç olmaz. */
export async function istatistikOku(kullaniciId: string): Promise<Partial<Record<Oyun, unknown>>> {
  const res = await rest(`oyun_istatistik?kullanici_id=eq.${kullaniciId}&select=oyun,veri`)
  if (!res.ok) throw new Error(`oyun_istatistik ${res.status}`)
  const satirlar = (await res.json()) as { oyun: string; veri: unknown }[]
  const cikti: Partial<Record<Oyun, unknown>> = {}
  for (const s of satirlar) if (oyunGecerli(s.oyun)) cikti[s.oyun] = s.veri
  return cikti
}

/**
 * Sayaçları yazar (varsa üzerine).
 *
 * ⚠️ Gövde SÜZÜLMÜŞ gelmeli (`sanitize` / `unluSanitize`): burada gelen şey
 * doğrudan tarayıcının gönderdiği JSON ve kurcalanmış olabilir.
 */
export async function istatistikYaz(kullaniciId: string, oyun: Oyun, veri: unknown): Promise<boolean> {
  const res = await rest('oyun_istatistik?on_conflict=kullanici_id,oyun', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ kullanici_id: kullaniciId, oyun, veri, guncellendi: new Date().toISOString() }),
  })
  return res.ok
}
