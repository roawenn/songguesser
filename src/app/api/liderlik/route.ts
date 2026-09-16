import { NextResponse } from 'next/server'
import { istanbulGunu } from '@/game/gun'
import { donemAraligi, donemGecerli, istenenGun, modGecerli } from '@/game/liderlik'
import { gunlukSimdi } from '@/lib/gunlukSunucu'
import { liderlikGetir } from '@/lib/liderlikSunucu'
import { supabaseReady } from '@/lib/supabase'

/**
 * Herkese açık sıralama: `?mod=gunluk&donem=gun|hafta&gun=YYYY-MM-DD`.
 *
 * Kısa kenar önbelleği: sıralama saniye saniye değişmek zorunda değil, bitiren
 * herkesin aynı anda istemesi veritabanına tek sorgu olarak yansısın. Kendi
 * sırası ayrı ve önbelleksiz (`/benim`).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const mod = q.get('mod') ?? 'gunluk'
  const donem = q.get('donem') ?? 'gun'
  if (!modGecerli(mod) || !donemGecerli(donem)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  if (!supabaseReady) return NextResponse.json({ satirlar: [] })

  const gun = istenenGun(q.get('gun'), istanbulGunu(new Date(gunlukSimdi())))
  const { bas, bit } = donemAraligi(donem, gun)
  try {
    const satirlar = await liderlikGetir(mod, bas, bit, 50)
    return NextResponse.json(
      { mod, donem, bas, bit, satirlar },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch {
    return NextResponse.json({ error: 'Sıralama okunamadı.' }, { status: 502 })
  }
}
