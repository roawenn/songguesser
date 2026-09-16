import { NextResponse } from 'next/server'
import { yonlendirmeAdresi } from '@/lib/googleKimlik'
import { sinirAsildi, cokHizli } from '@/lib/hizSinir'
import { KULLANICI_COOKIE, ayniKoken, cerezAyari, oturumKullanici } from '@/lib/kullaniciAuth'
import { adDegisebilirTarih, kullaniciSil } from '@/lib/kullaniciStore'

/**
 * Hesap durumu ve hesap silme.
 *
 * `girisAcik`: bu ortamda Google girişi yapılandırılmış mı (önizlemede ve
 * anahtar yokken false — düğme gizlenir).
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const girisAcik = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && yonlendirmeAdresi(origin, process.env),
  )
  const k = await oturumKullanici({ taze: true })
  const tarih = k ? adDegisebilirTarih(k.adDegisti) : null
  return NextResponse.json(
    {
      girisAcik,
      kullanici: k
        ? { ad: k.ad, email: k.email, adGerekli: k.ad === null, adDegisebilir: tarih ? tarih.toISOString() : null }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** KVKK: hesabı ve bağlı skorları siler. Gövde `{ onay: true }` ister. */
export async function DELETE(req: Request) {
  if (!ayniKoken(req)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  const k = await oturumKullanici({ taze: true })
  if (!k) return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  if (await sinirAsildi(req, { ad: 'hesap-sil', limit: 5, pencere: '1 hour', hataVarsaIzin: false })) return cokHizli()

  const govde = (await req.json().catch(() => ({}))) as { onay?: unknown }
  if (govde.onay !== true) return NextResponse.json({ error: 'Onay gerekli.' }, { status: 400 })

  if (!(await kullaniciSil(k.id))) return NextResponse.json({ error: 'Hesap silinemedi.' }, { status: 502 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(KULLANICI_COOKIE, '', cerezAyari(0))
  return res
}
