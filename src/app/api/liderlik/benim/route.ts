import { NextResponse } from 'next/server'
import { istanbulGunu } from '@/game/gun'
import { donemAraligi, donemGecerli, istenenGun, modGecerli } from '@/game/liderlik'
import { gunlukSimdi } from '@/lib/gunlukSunucu'
import { oturumKullanici } from '@/lib/kullaniciAuth'
import { benimSiram } from '@/lib/liderlikSunucu'

/** Girişli kullanıcının sırası; görünmüyorsa (adsız, şüpheli, oynamamış) `siram: null`. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const mod = q.get('mod') ?? 'gunluk'
  const donem = q.get('donem') ?? 'gun'
  if (!modGecerli(mod) || !donemGecerli(donem)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const k = await oturumKullanici()
  if (!k) return NextResponse.json({ siram: null }, { headers: { 'Cache-Control': 'no-store' } })

  const gun = istenenGun(q.get('gun'), istanbulGunu(new Date(gunlukSimdi())))
  const { bas, bit } = donemAraligi(donem, gun)
  try {
    return NextResponse.json(
      { siram: await benimSiram(mod, bas, bit, k.id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Sıra okunamadı.' }, { status: 502 })
  }
}
