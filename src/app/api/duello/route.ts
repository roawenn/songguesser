import { NextResponse } from 'next/server'
import { CHIPS, type ChipId } from '@/data/categories'
import { duelloKur, sarkilariSec } from '@/lib/duelStore'
import { supabaseReady } from '@/lib/supabase'

/**
 * Yeni düello lobisi kurar.
 *
 * ⚠️ Herkese açık yazma yolu. Kötüye kullanımı sınırlayan üç şey var:
 * lobi 2 saatte kendini geçersizleştiriyor (`expires_at`), gövde hiçbir
 * serbest metin taşımıyor (yalnızca seçki kimliği), ve satır minik.
 */
export async function POST(req: Request) {
  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Düello şu an kapalı.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const chip = body.chip as ChipId
  if (!CHIPS.some((c) => c.id === chip)) {
    return NextResponse.json({ error: 'Bilinmeyen seçki.' }, { status: 400 })
  }

  const songs = await sarkilariSec(chip)
  if (!songs) {
    // Kademelerden biri boş — bu seçki düelloya yetmiyor.
    return NextResponse.json(
      { error: 'Bu seçkide her zorluktan şarkı yok; başka bir seçki dene.' },
      { status: 409 },
    )
  }

  const kurulan = await duelloKur(chip, songs.map((s) => s.id))
  if (!kurulan) {
    return NextResponse.json({ error: 'Lobi kurulamadı, tekrar dene.' }, { status: 502 })
  }

  return NextResponse.json({ kod: kurulan.code, gizli: kurulan.secret, slot: 1 })
}
