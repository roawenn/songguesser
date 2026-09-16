import { NextResponse } from 'next/server'
import { KULLANICI_COOKIE, ayniKoken, cerezAyari, oturumKapat } from '@/lib/kullaniciAuth'

/** Çıkış: oturum veritabanından silinir — eski çerez kopyalansa bile işe yaramaz. */
export async function POST(req: Request) {
  if (!ayniKoken(req)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  await oturumKapat()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(KULLANICI_COOKIE, '', cerezAyari(0))
  return res
}
