import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Yönetim paneli girişi.
 *
 * Tek yöneticisi olan bir panel için Supabase Auth kurmak gereksiz ağırlık;
 * ortam değişkenindeki bir şifre yeterli. Önemli olan şu: **secret key asla
 * tarayıcıya gitmez.** Panel yazma işlemlerini sunucu rotaları üzerinden yapar,
 * onlar da bu çerezle korunur. Tarayıcıdan doğrudan yazma zaten RLS ile kapalı.
 */

export const ADMIN_COOKIE = 'tahmin_yonetim'

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return createHash('sha256').update(`${pw}:tahmin.net`).digest('hex')
}

/** Şifre doğruysa çerez değerini döndürür. */
export function tokenFor(password: string): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null

  // Zamanlama saldırısına kapalı karşılaştırma.
  const a = Buffer.from(createHash('sha256').update(password).digest())
  const b = Buffer.from(createHash('sha256').update(pw).digest())
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return expectedToken()
}

export async function isAuthed(): Promise<boolean> {
  const want = expectedToken()
  if (!want) return false
  const got = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!got || got.length !== want.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

/** Şifre hiç tanımlanmamışsa panel tamamen kapalıdır. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.SUPABASE_SECRET_KEY)
}
