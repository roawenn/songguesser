import { NextResponse } from 'next/server'
import { adminConfigured, isAuthed } from '@/lib/adminAuth'
import { restHeaders, restUrl } from '@/lib/supabase'

/** Yönetim: bir kullanıcının son günlük sonuçları (şüphe incelemesi için). */

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

export async function GET(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Geçersiz kimlik.' }, { status: 400 })

  const q = new URLSearchParams({
    kullanici_id: `eq.${id}`,
    select: 'gun,puan,basladi,bitti,supheli,zaman_asimi',
    order: 'gun.desc',
    limit: '60',
  })
  const res = await fetch(restUrl(`gunluk_oturum?${q}`), { headers: restHeaders({ secret: true }), cache: 'no-store' })
  if (!res.ok) return NextResponse.json({ error: 'Sonuçlar okunamadı.' }, { status: 502 })
  return NextResponse.json({ rows: await res.json() })
}
