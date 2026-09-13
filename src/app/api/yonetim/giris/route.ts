import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, oturumAc, oturumKapat, adminConfigured } from '@/lib/adminAuth'
import { sinirAsildi, cokHizli } from '@/lib/hizSinir'

/**
 * Yönetim paneli girişi.
 *
 * ⚠️ HIZ SINIRI ŞART. Burada hiçbir sınır yoktu: saniyede yüzlerce deneme
 * gönderilebiliyordu ve ödül, secret key ile RLS'i baypas eden tam yazma
 * yetkisiydi (bütün şarkı havuzu + ziyaretçi mesajları). İnsan aklında
 * tutabileceği her şifre bu koşulda düşer.
 *
 * ⚠️ Ayrıca sabit bir taban gecikme var. Hız sınırı bir IP'yi yavaşlatır ama
 * dağıtık bir denemede sayaçlar ayrışır; taban gecikme, kaç IP olursa olsun
 * saniyedeki toplam deneme sayısını düşürür.
 */

const TABAN_GECIKME_MS = 250

const SINIR = {
  ad: 'giris',
  limit: 5,
  pencere: '15 minutes',
  // Veritabanı yokken zaten giriş yapılamaz; kapalı kalmak bedava.
  hataVarsaIzin: false,
} as const

export async function POST(req: Request) {
  const basla = Date.now()
  const bekle = async () => {
    const kalan = TABAN_GECIKME_MS - (Date.now() - basla)
    if (kalan > 0) await new Promise((r) => setTimeout(r, kalan))
  }

  if (await sinirAsildi(req, SINIR)) {
    await bekle()
    return cokHizli('Çok fazla deneme. 15 dakika sonra tekrar dene.')
  }

  if (!(await adminConfigured())) {
    await bekle()
    return NextResponse.json(
      { error: 'Panel yapılandırılmamış (npm run admin:parola).' },
      { status: 503 },
    )
  }

  let password = ''
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? '')
  } catch {
    await bekle()
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const oturum = await oturumAc(password)
  if (!oturum) {
    await bekle()
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 })
  }

  await bekle()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, oturum, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

/** Çıkış — oturum satırı SİLİNİR, yalnızca çerez temizlenmez. */
export async function DELETE() {
  await oturumKapat()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
