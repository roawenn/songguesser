import { NextResponse } from 'next/server'
import { DUELLO_SARKI, kodGecerli } from '@/game/duel'
import { cevapYaz, slotDogrula } from '@/lib/duelStore'

/** Bir şarkının sonucunu yazar. */
export async function POST(req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
  if (!kodGecerli(kod)) return NextResponse.json({ error: 'Geçersiz kod.' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // ⚠️ Slot GÖVDEDEN ALINMAZ, gizli anahtardan türetilir. Aksi hâlde herkes
  // rakibinin adına istediği sonucu yazabilirdi.
  const slot = await slotDogrula(kod, String(body.gizli ?? ''))
  if (!slot) return NextResponse.json({ error: 'Bu düelloda değilsin.' }, { status: 403 })

  const songIndex = Number(body.songIndex)
  if (!Number.isInteger(songIndex) || songIndex < 0 || songIndex >= DUELLO_SARKI) {
    return NextResponse.json({ error: 'Geçersiz şarkı sırası.' }, { status: 400 })
  }

  const heardSeconds = Number(body.heardSeconds)
  const listens = Number(body.listens)
  if (!Number.isFinite(heardSeconds) || heardSeconds < 0 || heardSeconds > 60) {
    return NextResponse.json({ error: 'Geçersiz süre.' }, { status: 400 })
  }
  if (!Number.isInteger(listens) || listens < 0 || listens > 999) {
    return NextResponse.json({ error: 'Geçersiz dinleme sayısı.' }, { status: 400 })
  }

  const ok = await cevapYaz(kod, slot, {
    songIndex,
    won: body.won === true,
    heardSeconds,
    listens,
  })
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Cevap yazılamadı.' }, { status: 502 })
}
