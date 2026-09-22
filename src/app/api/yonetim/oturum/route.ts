import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, yoneticiOturumKapat } from '@/lib/adminAuth'
import { cerezAyari } from '@/lib/kullaniciAuth'
import { yonetimKoru } from '@/lib/yonetimKoru'

/**
 * Yönetici oturumunu kapatır.
 *
 * ⚠️ Dosya adı `giris` DEĞİL: artık bir "giriş" yok. Yetki Google hesabından
 * geliyor (bkz. `lib/adminAuth`), bu uç nokta yalnızca panel yetkisini bırakmak
 * için var. Eski `POST /api/yonetim/giris` (parola) tamamen kaldırıldı.
 *
 * ⚠️ OYUNCU OTURUMUNA DOKUNMAZ. Panelden çıkan kişi oyunda girişli kalır;
 * tersi de doğru (bkz. `api/cikis` — oyundan çıkış yönetici oturumunu da kapatır).
 */
export async function DELETE(req: Request) {
  // DELETE bir yazma: `yonetimKoru` burada `Origin` denetimini de uyguluyor.
  const engel = await yonetimKoru(req)
  if (engel) return engel

  await yoneticiOturumKapat()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', cerezAyari(0))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
