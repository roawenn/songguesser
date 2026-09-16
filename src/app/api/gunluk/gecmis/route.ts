import { NextResponse } from 'next/server'
import { oturumKullanici } from '@/lib/kullaniciAuth'
import { skorGecmisi } from '@/lib/liderlikSunucu'

/**
 * Girişli kullanıcının günlük geçmişi — seri cihazlar arasında aynı olsun.
 *
 * Girişsizde `gecmis: null`: istemci yerel geçmişe düşer. Yerel geçmiş hesaba
 * AKTARILMAZ — doğrulanamaz.
 */
export async function GET() {
  const k = await oturumKullanici()
  if (!k) return NextResponse.json({ gecmis: null }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    return NextResponse.json({ gecmis: await skorGecmisi('gunluk', k.id) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Geçmiş okunamadı.' }, { status: 502 })
  }
}
