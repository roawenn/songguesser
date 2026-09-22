import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, yoneticiOturumKapat } from '@/lib/adminAuth'
import { KULLANICI_COOKIE, ayniKoken, cerezAyari, oturumKapat } from '@/lib/kullaniciAuth'

/**
 * Çıkış: oturum veritabanından silinir — eski çerez kopyalansa bile işe yaramaz.
 *
 * ⚠️ YÖNETİCİ OTURUMU DA KAPANIR. Yetki oyuncu kimliğine bağlı olduğu için,
 * oyundan çıkıp panel yetkisinin ayakta kalması tutarsız olurdu.
 */
export async function POST(req: Request) {
  if (!ayniKoken(req)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  await oturumKapat()
  await yoneticiOturumKapat()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(KULLANICI_COOKIE, '', cerezAyari(0))
  res.cookies.set(ADMIN_COOKIE, '', cerezAyari(0))
  return res
}
