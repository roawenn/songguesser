import { NextResponse } from 'next/server'
import { DUELLO_TUR, kodGecerli } from '@/game/duel'
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
  if (!Number.isInteger(songIndex) || songIndex < 0 || songIndex >= DUELLO_TUR) {
    return NextResponse.json({ error: 'Geçersiz şarkı sırası.' }, { status: 400 })
  }

  /*
   * ⚠️ Alan adları jenerik ama SINIRLAR hâlâ gerçekçi olmalı: uydurma bir
   * maliyet skoru bozar. Şarkıda üst sınır klip süresi (60 sn'den uzun bir
   * önizleme yok), ünlüde şerit sayısı.
   *
   * Eski istemciler `heardSeconds`/`listens` gönderiyor; ikisi de kabul
   * ediliyor ki açık sekmeler kırılmasın.
   */
  const maliyet = Number(body.maliyet ?? body.heardSeconds)
  const ikincil = Number(body.ikincil ?? body.listens ?? 0)
  if (!Number.isFinite(maliyet) || maliyet < 0 || maliyet > 60) {
    return NextResponse.json({ error: 'Geçersiz süre.' }, { status: 400 })
  }
  if (!Number.isInteger(ikincil) || ikincil < 0 || ikincil > 999) {
    return NextResponse.json({ error: 'Geçersiz dinleme sayısı.' }, { status: 400 })
  }

  const ok = await cevapYaz(kod, slot, {
    songIndex,
    won: body.won === true,
    maliyet,
    ikincil,
  })
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Cevap yazılamadı.' }, { status: 502 })
}
