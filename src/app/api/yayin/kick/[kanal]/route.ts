import { cokHizli, sinirAsildi } from '@/lib/hizSinir'
import { kanalAdiTemizle } from '@/text/kanal'

/**
 * Kick kanal adından sohbet odası kimliğini (`chatroom.id`) bulur.
 *
 * ⚠️ Neden sunucuda: `kick.com` tarayıcıdan gelen başka kökenli isteklere CORS
 * izni vermiyor. Sunucudan istek atmak bunu aşıyor.
 *
 * ⚠️ BAŞARISIZ OLABİLİR ve bu beklenen bir durum: Kick, Cloudflare arkasında ve
 * veri merkezi adreslerini (Vercel dahil) sık sık engelliyor. Geliştirme
 * makinesinden 200 döndü; üretimde 403 gelirse `elle: true` döner ve kurulum
 * ekranı kimliği elle girme alanını açar. Kimlik kanal ömrü boyunca değişmiyor.
 *
 * ⚠️ Hız sınırı: herkese açık, dışarıya istek atan bir uç. Sınırsız kalsa
 * sitemiz Kick'e karşı bir istek çoğaltıcısı olarak kullanılabilirdi.
 *
 * ⚠️ TARAYICI TAKLİDİ YAPILMIYOR. İlk sürüm tam bir Chrome `User-Agent`'ı
 * gönderiyordu ve Kick'in güvenlik duvarı her isteğe 403 "Request blocked by
 * security policy" döndü: Node'un TLS imzası Chrome'unkiyle uyuşmayınca taklit
 * işareti sayılıyor. Aynı istek sade bir kimlikle 200 döndü (ölçüldü).
 */

const BASLIKLAR = {
  'User-Agent': 'tahmin.net yayinci modu (+https://tahmin.net/yayin)',
  Accept: 'application/json',
}

const elleGir = (error: string) => Response.json({ error, elle: true }, { status: 502 })

export async function GET(req: Request, ctx: { params: Promise<{ kanal: string }> }) {
  const { kanal: ham } = await ctx.params
  const kanal = kanalAdiTemizle(decodeURIComponent(ham), 'kick')
  if (!kanal) return Response.json({ error: 'Geçersiz kanal adı.' }, { status: 400 })

  if (await sinirAsildi(req, { ad: 'yayin-kick', limit: 30, pencere: '10 minutes', hataVarsaIzin: true })) {
    return cokHizli()
  }

  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${kanal}`, {
      headers: BASLIKLAR,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) {
      return Response.json({ error: 'Kick’te bu adla bir kanal yok.' }, { status: 404 })
    }
    if (!res.ok) return elleGir('Kick kanal bilgisini vermedi.')

    const d = (await res.json()) as { chatroom?: { id?: unknown } }
    const id = d.chatroom?.id
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      return elleGir('Kick yanıtında sohbet odası bulunamadı.')
    }
    return Response.json({ chatroomId: id })
  } catch {
    return elleGir('Kick’e ulaşılamadı.')
  }
}
