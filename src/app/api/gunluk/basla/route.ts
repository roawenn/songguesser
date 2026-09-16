import { NextResponse, after } from 'next/server'
import { istanbulGunu } from '@/game/gun'
import {
  belkiTemizle, cihazOzeti, gorunum, gunlukSetiGetir, gunlukSimdi, hakemGetir, oturumAc, yeniCihazGizlisi,
} from '@/lib/gunlukSunucu'
import { cokHizli, ipOzeti, sinirAsildi } from '@/lib/hizSinir'
import { supabaseReady } from '@/lib/supabase'

/**
 * Bugünün oturumunu açar (varsa olanı döner).
 *
 * Cihaz gizlisi yoksa burada üretilir ve YALNIZCA BU YANITTA döner; istemci
 * `localStorage`'a yazar, sonraki her istekte `x-gunluk-cihaz` başlığında
 * gönderir. Veritabanında yalnızca özeti durur.
 *
 * ⚠️ Oturum açmak tur AÇMAZ. Hız saati ilk turun medyası istendiğinde
 * (`hamle: sonraki`) başlar — oyuncu "Başla"ya basıp sekmeyi bıraksa bile
 * puanı yanmaz.
 */
export async function POST(req: Request) {
  if (!supabaseReady) return NextResponse.json({ error: 'Günlük şu an açılamıyor.' }, { status: 503 })

  if (await sinirAsildi(req, { ad: 'gunluk-basla', limit: 30, pencere: '1 hour', hataVarsaIzin: true })) {
    return cokHizli()
  }

  const gelen = req.headers.get('x-gunluk-cihaz')
  let gizli = cihazOzeti(gelen) ? gelen! : null
  const yeni = gizli === null
  gizli ??= yeniCihazGizlisi()

  try {
    const gun = istanbulGunu(new Date(gunlukSimdi()))
    const set = await gunlukSetiGetir(gun, { olustur: true })
    if (!set) return NextResponse.json({ error: 'Günün soruları hazırlanamadı.' }, { status: 503 })

    const oturum = await oturumAc({
      gun,
      cihazOzet: cihazOzeti(gizli)!,
      kullaniciId: null,
      sirali: true,
      ipOzet: ipOzeti(req),
    })
    if (!oturum) return NextResponse.json({ error: 'Oturum açılamadı.' }, { status: 502 })

    belkiTemizle()
    /*
     * Hakem havuzlarını (15 bin şarkı, ünlüler, kapak gruplaması) yanıttan
     * SONRA ısıt: soğuk örnekte ilk tahmin aksi hâlde ~2 sn bekliyordu.
     * `after` lambdanın yanıttan sonra dondurulmasını engelliyor.
     */
    after(() => hakemGetir().then(() => undefined, () => undefined))
    return NextResponse.json(
      { cihaz: yeni ? gizli : undefined, gorunum: gorunum(oturum, set) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Günlük şu an açılamıyor.' }, { status: 502 })
  }
}
