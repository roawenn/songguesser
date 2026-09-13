import { NextResponse } from 'next/server'
import { isAuthed, adminConfigured } from '@/lib/adminAuth'
import { guvenliDisUrl, EN_BUYUK_GORSEL } from '@/lib/disUrl'

/**
 * Dışarıdaki bir görseli indirip panele `data:` URL olarak döndürür.
 *
 * ⚠️ NEDEN SUNUCUDAN VE NEDEN `data:` — canvas kirlenmesi.
 *
 * Uzak görseli doğrudan `<img src="https://…">` ile yükleyip canvas'a
 * çizersen `toBlob()` `SecurityError` fırlatır: CORS başlığı olmayan her
 * sitede canvas "kirlenir" ve dışa aktarılamaz. `crossOrigin="anonymous"`
 * denemek de çoğu kaynakta sessizce başarısız olur. Baytları sunucudan alıp
 * aynı kökenden `data:` URL olarak vermek bu sınıfı tamamen kaldırıyor.
 *
 * ⚠️ SSRF savunması `guvenliDisUrl`'de ve AYRI bir `.ts` dosyasında — burada
 * kalsaydı test edilemezdi (`vitest` yalnızca `.ts` topluyor).
 */

const ZAMAN_ASIMI_MS = 8000

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

export async function POST(req: Request) {
  const red = await guard()
  if (red) return red

  const govde = (await req.json().catch(() => null)) as { url?: unknown } | null
  const kontrol = guvenliDisUrl(String(govde?.url ?? ''))
  if (!kontrol.ok) {
    return NextResponse.json({ error: kontrol.sebep }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(kontrol.url, {
      // ⚠️ `redirect: 'manual'` — otomatik takip edilen bir yönlendirme
      // denetimi atlatırdı: `https://ornek.com/x` → `http://127.0.0.1/`.
      // Yönlendirme gelirse hedefi TEKRAR denetleyip elle takip ediyoruz.
      redirect: 'manual',
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
      headers: { accept: 'image/*' },
      cache: 'no-store',
    })

    let atlama = 0
    while (res.status >= 300 && res.status < 400 && atlama < 3) {
      const hedef = res.headers.get('location')
      if (!hedef) break
      const yeni = guvenliDisUrl(new URL(hedef, kontrol.url).toString())
      if (!yeni.ok) return NextResponse.json({ error: yeni.sebep }, { status: 400 })
      res = await fetch(yeni.url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
        headers: { accept: 'image/*' },
        cache: 'no-store',
      })
      atlama++
    }
  } catch {
    return NextResponse.json({ error: 'Adrese ulaşılamadı.' }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Adres ${res.status} döndü.` }, { status: 502 })
  }

  const tip = res.headers.get('content-type') ?? ''
  if (!tip.startsWith('image/')) {
    return NextResponse.json({ error: 'Adres bir görsel değil.' }, { status: 415 })
  }

  // Bildirilen uzunluk varsa indirmeden önce ele.
  const bildirilen = Number(res.headers.get('content-length') ?? 0)
  if (bildirilen > EN_BUYUK_GORSEL) {
    return NextResponse.json({ error: 'Görsel çok büyük.' }, { status: 413 })
  }

  const bayt = new Uint8Array(await res.arrayBuffer())
  // ⚠️ Gövde uzunluğu ayrıca denetleniyor: `content-length` yalanabilir ya da
  // hiç gelmeyebilir (chunked).
  if (bayt.byteLength > EN_BUYUK_GORSEL) {
    return NextResponse.json({ error: 'Görsel çok büyük.' }, { status: 413 })
  }

  const temizTip = tip.split(';')[0]!.trim()
  const veri = `data:${temizTip};base64,${Buffer.from(bayt).toString('base64')}`
  return NextResponse.json({ veri })
}
