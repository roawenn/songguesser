import 'server-only'
import { NextResponse } from 'next/server'
import { yoneticiDurumu } from '@/lib/adminAuth'
import { ayniKoken } from '@/lib/kullaniciAuth'

/**
 * Yönetim rotalarının TEK koruması.
 *
 * ⚠️ Bu yardımcı, dokuz rota dosyasına BİREBİR KOPYALANMIŞ `guard()`
 * fonksiyonlarının yerine geçiyor. Kopyalanma gerekçesi "rota dosyaları `GET`
 * dışında dışa aktarım kabul etmiyor"du; oysa engel dışa AKTARMAKTA, içe
 * almakta değil. Dokuz kopya, bir gün birinin unutulması ya da farklı
 * güncellenmesi demekti — korumanın tek satırda durması güvenliğin kendisi.
 *
 * ⚠️ YETKİSİZE 404. Eskiden 401 "Giriş gerekli." dönüyordu; bu, panelin ve uç
 * noktanın VAR OLDUĞUNU doğruluyordu. Artık yalnızca kimliği doğrulanmış
 * yönetici 401 görüyor (ki o da "yeniden doğrula" demek için).
 */

/** Yetkisiz: uç noktanın varlığını bile doğrulamayan, gövdesiz 404. */
export function yok(): Response {
  return new NextResponse(null, { status: 404 })
}

/** GET ve HEAD dışındaki her şey yazma sayılır. */
function yazmaMi(req: Request): boolean {
  const m = req.method.toUpperCase()
  return m !== 'GET' && m !== 'HEAD'
}

export async function yonetimKoru(req: Request): Promise<Response | null> {
  const durum = await yoneticiDurumu()

  if (durum === 'yok') return yok()

  if (durum === 'dogrula') {
    /*
     * Bu yanıt YALNIZCA e-postası yönetici listesinde olan, girişli birine
     * gidiyor — yani sızdırdığı bilgi kişinin zaten bildiği şey. `kod` alanını
     * panel okuyup doğrulama ekranına düşüyor.
     */
    return NextResponse.json(
      { error: 'Yönetici doğrulaması gerekli.', kod: 'dogrula' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  /*
   * ⚠️ CSRF: yazma yollarında `Origin` denetimi ŞART. Yönetim rotalarında
   * bugüne kadar HİÇ yoktu; tek savunma `SameSite=Lax` çereziydi ve o, üst
   * seviye gezinmelerle gelen POST'ları engellemiyor.
   *
   * ⚠️ Yazma olup olmadığı METOTTAN türetiliyor, çağıranın vereceği bir
   * bayraktan değil: bayrağı yeni bir rotada yazmayı unutmak sessizce korumasız
   * bir uç nokta bırakırdı.
   */
  if (yazmaMi(req) && !ayniKoken(req)) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  }

  return null
}
