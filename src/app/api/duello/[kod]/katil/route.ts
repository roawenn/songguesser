import { NextResponse } from 'next/server'
import { kodGecerli } from '@/game/duel'
import { duelloOku, katil, oyuncular } from '@/lib/duelStore'

/** İkinci oyuncu olarak lobiye girer. */
export async function POST(_req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
  if (!kodGecerli(kod)) return NextResponse.json({ error: 'Geçersiz kod.' }, { status: 400 })

  const duel = await duelloOku(kod)
  if (!duel) return NextResponse.json({ error: 'Lobi bulunamadı.' }, { status: 404 })
  if (new Date(duel.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu lobinin süresi dolmuş.' }, { status: 410 })
  }

  if ((await oyuncular(kod)).length >= 2) {
    return NextResponse.json({ error: 'Bu düello dolu.' }, { status: 409 })
  }

  const giren = await katil(kod)
  if (!giren) {
    // ⚠️ Yarış: iki kişi aynı anda girdiyse birincil anahtar birini reddeder.
    return NextResponse.json({ error: 'Bu düello dolu.' }, { status: 409 })
  }

  return NextResponse.json({ kod, gizli: giren.secret, slot: giren.slot })
}
