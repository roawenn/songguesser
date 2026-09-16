import { NextResponse } from 'next/server'
import { gunEkle, istanbulGunu, sonrakiGunBaslangici } from '@/game/gun'
import {
  cihazOturumlari, cihazOzeti, gorunum, gunlukSetiGetir, gunlukSimdi, sonTeslimAni,
} from '@/lib/gunlukSunucu'
import { supabaseReady } from '@/lib/supabase'

/**
 * Günlük durum: bugünün tarihi, sunucu saati ve cihazın süren/bitmiş oturumu.
 *
 * ⚠️ SET KURMAZ. Sayfayı açan herkes günün setini kurdurmasın; kurulum ancak
 * biri "Başla"ya basınca (`/basla`).
 *
 * ⚠️ DÜNÜN YARIM OTURUMU ÖNCELİKLİ: 23:58'de başlayan oyuncu 00:01'de sayfayı
 * yenilerse son teslime kadar kaldığı yerden devam etmeli, önüne yeni gün
 * çıkmamalı.
 */
export async function GET(req: Request) {
  const simdi = gunlukSimdi()
  const gun = istanbulGunu(new Date(simdi))
  const temel = {
    gun,
    sunucuZamani: simdi,
    sonrakiGun: sonrakiGunBaslangici(new Date(simdi)).getTime(),
    acik: supabaseReady,
  }
  const basliklar = { 'Cache-Control': 'no-store' }

  const cihaz = cihazOzeti(req.headers.get('x-gunluk-cihaz'))
  if (!cihaz || !supabaseReady) return NextResponse.json({ ...temel, gorunum: null }, { headers: basliklar })

  try {
    const dun = gunEkle(gun, -1)
    const oturumlar = await cihazOturumlari([dun, gun], cihaz)
    const yarimDun = oturumlar.find((o) => o.gun === dun && o.bitti === null && simdi <= sonTeslimAni(dun))
    const oturum = yarimDun ?? oturumlar.find((o) => o.gun === gun) ?? null
    if (!oturum) return NextResponse.json({ ...temel, gorunum: null }, { headers: basliklar })

    const set = await gunlukSetiGetir(oturum.gun, { olustur: false })
    return NextResponse.json(
      { ...temel, gorunum: set ? gorunum(oturum, set) : null },
      { headers: basliklar },
    )
  } catch {
    return NextResponse.json({ ...temel, gorunum: null, hata: true }, { status: 502, headers: basliklar })
  }
}
