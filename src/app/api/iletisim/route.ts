import { NextResponse } from 'next/server'
import { sinirAsildi, cokHizli } from '@/lib/hizSinir'
import { restUrl, restHeaders, supabaseReady } from '@/lib/supabase'

/**
 * Ziyaretçi mesajı alır.
 *
 * Site e-posta adresi yayınlamıyor: adres sayfada durduğu sürece toplanır ve
 * spam'e döner. Bunun yerine mesaj veritabanına yazılır, yönetim panelinden
 * okunur. Posta gönderimi YOK — kurulum ve maliyet olarak karşılığı olmayan
 * bir bağımlılık olurdu.
 *
 * ⚠️ Bu, projedeki TEK herkese açık yazma yolu. Yazma secret key ile yapıldığı
 * için RLS'i baypas ediyor; dolayısıyla doğrulama burada gerçek bir savunma,
 * kozmetik değil. Uzunluk sınırları ayrıca şemada da var (`messages_len_chk`).
 */

const SINIR = { ad: 80, soyad: 80, mesaj: 4000 } as const

/** Formdaki görünmez alan. İnsan doldurmaz; dolduysa bot demektir. */
const TUZAK = 'website'

function metin(v: unknown, enFazla: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (s.length === 0 || s.length > enFazla) return null
  return s
}

export async function POST(req: Request) {
  /*
   * ⚠️ Bal küpü bota yeter, KARARLI birine yetmez — tek satır kaldırmakla
   * atlatılıyor. Sınırsızken bu uç nokta istek başına ~4 KB yazabiliyordu,
   * yani ücretsiz kademenin 500 MB'ını doldurabilecek bir yol; üstelik
   * panelde gerçek mesajların üstünü örterdi.
   */
  if (await sinirAsildi(req, { ad: 'iletisim', limit: 3, pencere: '10 minutes', hataVarsaIzin: true })) {
    return cokHizli('Çok fazla mesaj gönderdin. Biraz bekle.')
  }

  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Mesaj kutusu şu an kapalı.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // Bal küpü: sessizce başarılı dön. Bota "yakalandın" demek, denemeye devam
  // etmesi için bilgi vermektir.
  if (typeof body[TUZAK] === 'string' && body[TUZAK].length > 0) {
    return NextResponse.json({ ok: true })
  }

  const name = metin(body.ad, SINIR.ad)
  const surname = metin(body.soyad, SINIR.soyad)
  const mesaj = metin(body.mesaj, SINIR.mesaj)

  if (!name || !surname) {
    return NextResponse.json({ error: 'Ad ve soyad gerekli.' }, { status: 400 })
  }
  if (!mesaj || mesaj.length < 3) {
    return NextResponse.json({ error: 'Mesaj çok kısa.' }, { status: 400 })
  }

  const res = await fetch(restUrl('messages'), {
    method: 'POST',
    headers: { ...restHeaders({ secret: true }), Prefer: 'return=minimal' },
    body: JSON.stringify({ name, surname, body: mesaj }),
  })

  if (!res.ok) {
    // ⚠️ Supabase'in ham hatası ziyaretçiye GÖSTERİLMEZ: tablo adı, kısıt adı
    // ve şema ayrıntısı sızdırır.
    console.error('iletisim:', res.status, await res.text())
    return NextResponse.json({ error: 'Mesaj gönderilemedi, sonra dene.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
