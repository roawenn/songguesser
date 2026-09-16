import { NextResponse } from 'next/server'
import { adminConfigured, isAuthed } from '@/lib/adminAuth'
import { gunGecerli, istanbulGunu } from '@/game/gun'
import { gunlukSetiGetir, gunlukSimdi } from '@/lib/gunlukSunucu'
import { restHeaders, restUrl } from '@/lib/supabase'

/**
 * Yönetim: günün seti — CEVAPLAR DAHİL — ve oturum sayıları.
 *
 * ⚠️ Set burada KURULMAZ: yönetici bakmak için açtığında günün seti onun
 * isteğiyle kurulmasın; ilk oyuncuyla kurulur.
 */

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

async function say(filtre: string): Promise<number> {
  const res = await fetch(restUrl(`gunluk_oturum?${filtre}&select=id`), {
    method: 'HEAD',
    headers: { ...restHeaders({ secret: true, tip: null }), Prefer: 'count=exact' },
    cache: 'no-store',
  })
  const n = Number(res.headers.get('content-range')?.split('/')[1])
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const ham = new URL(req.url).searchParams.get('gun')
  const gun = gunGecerli(ham) ? ham : istanbulGunu(new Date(gunlukSimdi()))

  try {
    const [set, toplam, biten, supheli] = await Promise.all([
      gunlukSetiGetir(gun, { olustur: false }),
      say(`gun=eq.${gun}&sirali=eq.true`),
      say(`gun=eq.${gun}&sirali=eq.true&bitti=not.is.null&zaman_asimi=eq.false`),
      say(`gun=eq.${gun}&supheli=eq.true`),
    ])
    return NextResponse.json(
      { gun, set, oturum: { toplam, biten, supheli } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Okunamadı.' }, { status: 502 })
  }
}
