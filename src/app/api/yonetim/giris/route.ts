import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, tokenFor, adminConfigured } from '@/lib/adminAuth'

/** Yönetim paneli girişi: şifre doğruysa httpOnly çerez bırakır. */
export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: 'Panel yapılandırılmamış (ADMIN_PASSWORD / SUPABASE_SECRET_KEY).' },
      { status: 503 },
    )
  }

  let password = ''
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? '')
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const token = tokenFor(password)
  if (!token) {
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

/** Çıkış. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
