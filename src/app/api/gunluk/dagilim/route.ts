import { NextResponse } from 'next/server'
import { gunGecerli } from '@/game/gun'
import { dagilimOku } from '@/lib/gunlukSunucu'
import { supabaseReady } from '@/lib/supabase'

/**
 * Günün puan dağılımı. Herkese açık; yalnızca (puan, adet) çiftleri.
 *
 * Kısa kenar önbelleği: bitiren herkes aynı anda grafiği istiyor, dağılımın
 * 30 sn bayat olması kimseyi rahatsız etmez.
 */
export async function GET(req: Request) {
  const gun = new URL(req.url).searchParams.get('gun')
  if (!gunGecerli(gun)) return NextResponse.json({ error: 'Geçersiz gün.' }, { status: 400 })
  if (!supabaseReady) return NextResponse.json({ gun, dagilim: [] })

  try {
    const dagilim = await dagilimOku(gun)
    return NextResponse.json(
      { gun, dagilim },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch {
    return NextResponse.json({ error: 'Dağılım okunamadı.' }, { status: 502 })
  }
}
