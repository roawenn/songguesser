import { NextResponse } from 'next/server'
import { CHIPS, type ChipId } from '@/data/categories'
import { duelloKur, sarkilariSec } from '@/lib/duelStore'
import { supabaseReady } from '@/lib/supabase'
import { sinirAsildi, cokHizli } from '@/lib/hizSinir'

/**
 * Yeni düello lobisi kurar.
 *
 * ⚠️ Herkese açık yazma yolu. Kötüye kullanımı sınırlayan üç şey var:
 * lobi 2 saatte kendini geçersizleştiriyor (`expires_at`), gövde hiçbir
 * serbest metin taşımıyor (yalnızca seçki kimliği), ve satır minik.
 */
export async function POST(req: Request) {
  /*
   * ⚠️ Kimlik doğrulaması olmayan bir yazma yolu. Sınırsızken tek bir makine
   * hem `duels` tablosunu şişirebiliyor hem de aşağıdaki şarkı seçimini
   * tekrar tekrar çalıştırabiliyordu.
   */
  if (await sinirAsildi(req, { ad: 'duello-kur', limit: 10, pencere: '10 minutes', hataVarsaIzin: true })) {
    return cokHizli('Çok fazla lobi kurdun. Biraz bekle.')
  }

  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Düello şu an kapalı.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const chip = body.chip as ChipId
  if (!CHIPS.some((c) => c.id === chip)) {
    return NextResponse.json({ error: 'Bilinmeyen seçki.' }, { status: 400 })
  }

  const songIds = await sarkilariSec(chip)
  if (!songIds) {
    // Kademelerden biri boş — bu seçki düelloya yetmiyor.
    return NextResponse.json(
      { error: 'Bu seçkide her zorluktan şarkı yok; başka bir seçki dene.' },
      { status: 409 },
    )
  }

  const kurulan = await duelloKur(chip, songIds)
  if (!kurulan) {
    return NextResponse.json({ error: 'Lobi kurulamadı, tekrar dene.' }, { status: 502 })
  }

  return NextResponse.json({ kod: kurulan.code, gizli: kurulan.secret, slot: 1 })
}
