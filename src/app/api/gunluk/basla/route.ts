import { NextResponse, after } from 'next/server'
import { gunGecerli, istanbulGunu } from '@/game/gun'
import { arsivSiniri } from '@/game/gunlukArsiv'
import {
  belkiTemizle, cihazOzeti, gorunum, gunlukSetiGetir, gunlukSimdi, hakemGetir, oturumAc, yeniCihazGizlisi,
} from '@/lib/gunlukSunucu'
import { cokHizli, ipOzeti, sinirAsildi } from '@/lib/hizSinir'
import { oturumKullanici } from '@/lib/kullaniciAuth'
import { supabaseReady } from '@/lib/supabase'

/**
 * Bugünün oturumunu açar (varsa olanı döner).
 *
 * Cihaz gizlisi yoksa burada üretilir ve YALNIZCA BU YANITTA döner; istemci
 * `localStorage`'a yazar, sonraki her istekte `x-gunluk-cihaz` başlığında
 * gönderir. Veritabanında yalnızca özeti durur.
 *
 * ⚠️ KULLANICI BURADA, YALNIZCA BURADA bağlanır: oturum girişliyken açılırsa
 * sıralamaya girer. Oyunun ortasında giriş yapmak mevcut oturumu değiştirmez.
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

  /*
   * ARŞİV: gövdede `gun` varsa geçmiş bir günün SIRALAMASIZ oturumu. Gün son
   * teslimi geçmiş olmalı ve seti o gün kurulmuş olmalı (arşiv seti KURMAZ).
   */
  const govde = (await req.json().catch(() => ({}))) as { gun?: unknown }
  const simdi = gunlukSimdi()
  const arsiv = govde.gun !== undefined
  if (arsiv && (!gunGecerli(govde.gun) || govde.gun > arsivSiniri(simdi))) {
    return NextResponse.json({ error: 'Bu gün arşivde yok.' }, { status: 404 })
  }

  try {
    const gun = arsiv ? (govde.gun as string) : istanbulGunu(new Date(simdi))
    const set = await gunlukSetiGetir(gun, { olustur: !arsiv })
    if (!set) {
      return NextResponse.json({ error: arsiv ? 'Bu gün arşivde yok.' : 'Günün soruları hazırlanamadı.' }, { status: arsiv ? 404 : 503 })
    }

    const kullanici = await oturumKullanici()
    const oturum = await oturumAc({
      gun,
      cihazOzet: cihazOzeti(gizli)!,
      kullaniciId: kullanici?.id ?? null,
      sirali: !arsiv,
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
