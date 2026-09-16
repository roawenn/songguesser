import { NextResponse } from 'next/server'
import { gunEkle, istanbulGunu, sonrakiGunBaslangici } from '@/game/gun'
import {
  cihazOturumlari, cihazOzeti, gorunum, gunlukSetiGetir, gunlukSimdi, kullaniciOturumlari, sonTeslimAni,
} from '@/lib/gunlukSunucu'
import { oturumKullanici } from '@/lib/kullaniciAuth'
import { supabaseReady } from '@/lib/supabase'

/**
 * Günlük durum: bugünün tarihi, sunucu saati ve cihazın süren/bitmiş oturumu.
 *
 * ⚠️ SET KURMAZ. Sayfayı açan herkes günün setini kurdurmasın; kurulum ancak
 * biri "Başla"ya basınca (`/basla`).
 *
 * GİRİŞLİYSE önce kullanıcının oturumu (başka cihazda başlamış olabilir),
 * yoksa bu cihazın girişsiz oturumu. Girişsiz oynanmış bir gün, sonradan giriş
 * yapılınca da o sonuçla görünür — "Başla" yeniden çıkmaz.
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
  if (!supabaseReady) return NextResponse.json({ ...temel, gorunum: null }, { headers: basliklar })

  try {
    const kullanici = await oturumKullanici()
    if (!cihaz && !kullanici) return NextResponse.json({ ...temel, gorunum: null }, { headers: basliklar })

    const dun = gunEkle(gun, -1)
    const sec = (liste: Awaited<ReturnType<typeof cihazOturumlari>>) =>
      liste.find((o) => o.gun === dun && o.bitti === null && simdi <= sonTeslimAni(dun)) ??
      liste.find((o) => o.gun === gun) ??
      null
    const oturum =
      (kullanici ? sec(await kullaniciOturumlari([dun, gun], kullanici.id)) : null) ??
      (cihaz ? sec(await cihazOturumlari([dun, gun], cihaz)) : null)
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
