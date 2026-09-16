import { NextResponse } from 'next/server'
import { AD_HATA_METNI, adDenetle } from '@/text/kullaniciAdi'
import { cokHizli, sinirAsildi } from '@/lib/hizSinir'
import { ayniKoken, oturumKullanici } from '@/lib/kullaniciAuth'
import { AD_DEGISIM_GUN, adAyarla } from '@/lib/kullaniciStore'
import { uygunsuzMu } from '@/lib/uygunsuz'

/**
 * Kullanıcı adını belirler ya da değiştirir.
 *
 * ⚠️ Hız sınırı hata durumunda KAPALI (`hataVarsaIzin: false`): ad denemesi
 * uygunsuzluk filtresine karşı deneme yanılma aracı olmasın.
 */
export async function POST(req: Request) {
  if (!ayniKoken(req)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  const k = await oturumKullanici({ taze: true })
  if (!k) return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  if (await sinirAsildi(req, { ad: 'hesap-ad', limit: 15, pencere: '1 hour', hataVarsaIzin: false })) return cokHizli()

  const govde = (await req.json().catch(() => ({}))) as { ad?: unknown }
  if (typeof govde.ad !== 'string' || govde.ad.length > 80) {
    return NextResponse.json({ error: AD_HATA_METNI.uzunluk }, { status: 400 })
  }

  const denetim = adDenetle(govde.ad, uygunsuzMu)
  if (!denetim.ok) return NextResponse.json({ error: AD_HATA_METNI[denetim.hata], hata: denetim.hata }, { status: 400 })
  if (denetim.ad === k.ad) return NextResponse.json({ ok: true, ad: k.ad })

  switch (await adAyarla(k, denetim.ad, denetim.norm)) {
    case 'ok':
      return NextResponse.json({ ok: true, ad: denetim.ad })
    case 'alinmis':
      return NextResponse.json({ error: 'Bu ad alınmış.' }, { status: 409 })
    case 'yasakli':
      return NextResponse.json({ error: AD_HATA_METNI.rezerve }, { status: 400 })
    case 'erken':
      return NextResponse.json({ error: `Kullanıcı adı ${AD_DEGISIM_GUN} günde bir değiştirilebilir.` }, { status: 429 })
    default:
      return NextResponse.json({ error: 'Ad kaydedilemedi.' }, { status: 502 })
  }
}
