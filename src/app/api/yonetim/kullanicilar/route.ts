import { NextResponse } from 'next/server'
import { yonetimKoru } from '@/lib/yonetimKoru'
import { yoneticiEpostaMi } from '@/lib/adminAuth'
import { restHeaders, restUrl } from '@/lib/supabase'
import { aramaFiltresi } from '@/lib/yonetimArama'

/**
 * Yönetim: kullanıcılar — arama, ban, ad sıfırlama, şüphe bayrağı.
 *
 * ⚠️ E-posta YALNIZCA burada görünür (yönetici kimi banladığını bilsin);
 * sıralama ve herkese açık hiçbir uç nokta e-posta döndürmez.
 */

export interface KullaniciSatiri {
  id: string
  kullanici_adi: string | null
  email: string
  olusturuldu: string
  son_giris: string
  banli_at: string | null
  ban_sebebi: string | null
  /** Hesaba bağlı şüpheli günlük oturum sayısı. */
  supheli: number
  /** Sıralamaya yazılmış gün sayısı. */
  gun: number
}

const SAYFA = 50

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

function say(liste: { kullanici_id: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of liste) m.set(r.kullanici_id, (m.get(r.kullanici_id) ?? 0) + 1)
  return m
}

export async function GET(req: Request) {
  const blocked = await yonetimKoru(req)
  if (blocked) return blocked

  const url = new URL(req.url)
  const filtre = url.searchParams.get('filtre')
  const sayfa = Math.max(0, Math.min(1000, Number(url.searchParams.get('sayfa')) || 0))

  const q = new URLSearchParams({
    select: 'id,kullanici_adi,email,olusturuldu,son_giris,banli_at,ban_sebebi',
    order: 'olusturuldu.desc',
    limit: String(SAYFA),
    offset: String(sayfa * SAYFA),
  })
  const arama = aramaFiltresi(url.searchParams.get('q'))
  if (arama) q.set('or', arama)
  if (filtre === 'banli') q.set('banli_at', 'not.is.null')

  try {
    if (filtre === 'supheli') {
      const s = await rest('gunluk_oturum?supheli=eq.true&kullanici_id=not.is.null&select=kullanici_id&limit=1000')
      if (!s.ok) throw new Error()
      const idler = [...new Set(((await s.json()) as { kullanici_id: string }[]).map((r) => r.kullanici_id))]
      if (idler.length === 0) return NextResponse.json({ rows: [] })
      q.set('id', `in.(${idler.slice(0, 200).join(',')})`)
    }

    const res = await rest(`kullanicilar?${q}`)
    if (!res.ok) throw new Error()
    const rows = (await res.json()) as Omit<KullaniciSatiri, 'supheli' | 'gun'>[]
    if (rows.length === 0) return NextResponse.json({ rows: [] })

    const idler = rows.map((r) => r.id).join(',')
    const [s, g] = await Promise.all([
      rest(`gunluk_oturum?supheli=eq.true&kullanici_id=in.(${idler})&select=kullanici_id`),
      rest(`skor?mod=eq.gunluk&kullanici_id=in.(${idler})&select=kullanici_id`),
    ])
    const supheli = say(s.ok ? await s.json() : [])
    const gun = say(g.ok ? await g.json() : [])

    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, supheli: supheli.get(r.id) ?? 0, gun: gun.get(r.id) ?? 0 })),
    })
  } catch {
    return NextResponse.json({ error: 'Kullanıcılar okunamadı.' }, { status: 502 })
  }
}

type Islem = 'banla' | 'ban-kaldir' | 'ad-sifirla' | 'supheli-temizle'

export async function PATCH(req: Request) {
  const blocked = await yonetimKoru(req)
  if (blocked) return blocked

  const govde = (await req.json().catch(() => ({}))) as { id?: unknown; islem?: unknown; sebep?: unknown }
  const id = typeof govde.id === 'string' && /^[0-9a-f-]{36}$/.test(govde.id) ? govde.id : null
  const islem = govde.islem as Islem
  const sebep = typeof govde.sebep === 'string' ? govde.sebep.trim().slice(0, 300) : ''
  if (!id || !['banla', 'ban-kaldir', 'ad-sifirla', 'supheli-temizle'].includes(islem)) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  /*
   * ⚠️ YÖNETİCİ KENDİNİ (ya da bir başka yöneticiyi) BANLAYAMAZ / ADINI
   * SIFIRLAYAMAZ. Ban `yoneticiDurumu`'nda her istekte denetleniyor: tek bir
   * yanlış tıklama paneli kalıcı olarak kapatır ve geri dönüşü YOK — yetki
   * ortam değişkeninde olduğu için panelden kurtarma yapılamaz, Supabase
   * Studio'dan elle `banli_at = null` gerekir.
   */
  if (islem === 'banla' || islem === 'ad-sifirla') {
    const s = await rest(`kullanicilar?id=eq.${id}&select=email`)
    const [hedef] = s.ok ? ((await s.json()) as { email: string }[]) : []
    if (hedef && yoneticiEpostaMi(hedef.email)) {
      return NextResponse.json({ error: 'Yönetici hesabına bu işlem uygulanamaz.' }, { status: 409 })
    }
  }

  const yaz = (path: string, body: unknown) =>
    rest(path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })

  let ok = false
  switch (islem) {
    case 'banla': {
      const r = await yaz(`kullanicilar?id=eq.${id}`, { banli_at: new Date().toISOString(), ban_sebebi: sebep || null })
      // Oturumlar da silinir: ban zaten her okumada denetleniyor, bu temizlik.
      await rest(`kullanici_oturum?kullanici_id=eq.${id}`, { method: 'DELETE' })
      ok = r.ok
      break
    }
    case 'ban-kaldir':
      ok = (await yaz(`kullanicilar?id=eq.${id}`, { banli_at: null, ban_sebebi: null })).ok
      break
    case 'ad-sifirla': {
      const r = await rest('rpc/kullanici_ad_sifirla', {
        method: 'POST',
        body: JSON.stringify({ p_id: id, p_sebep: sebep || 'yönetim' }),
      })
      ok = r.ok && (await r.json()) === true
      break
    }
    case 'supheli-temizle': {
      const [a, b] = await Promise.all([
        yaz(`skor?kullanici_id=eq.${id}&supheli=eq.true`, { supheli: false }),
        yaz(`gunluk_oturum?kullanici_id=eq.${id}&supheli=eq.true`, { supheli: false }),
      ])
      ok = a.ok && b.ok
      break
    }
  }
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'İşlem yapılamadı.' }, { status: 502 })
}
