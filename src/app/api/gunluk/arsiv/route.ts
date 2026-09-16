import { NextResponse } from 'next/server'
import { arsivSiniri } from '@/game/gunlukArsiv'
import { arsivGunleri, gunlukSimdi } from '@/lib/gunlukSunucu'
import { supabaseReady } from '@/lib/supabase'

/**
 * Arşivde oynanabilecek günler — yalnızca son teslimi geçmiş ve seti kurulmuş.
 *
 * ⚠️ Set kurulmamış bir geçmiş gün (o gün kimse oynamadı) listede YOK ve
 * sonradan KURULMAZ: bugünün havuzuyla "geçmiş gün" üretmek sahte bir arşiv olurdu.
 */
export async function GET() {
  if (!supabaseReady) return NextResponse.json({ gunler: [] })
  try {
    const gunler = await arsivGunleri(arsivSiniri(gunlukSimdi()))
    return NextResponse.json(
      { gunler },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ error: 'Arşiv okunamadı.' }, { status: 502 })
  }
}
