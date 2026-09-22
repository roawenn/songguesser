import { NextResponse } from 'next/server'
import { yonetimKoru } from '@/lib/yonetimKoru'
import { restHeaders, restUrl } from '@/lib/supabase'

/** Yönetim: bir kullanıcının son günlük sonuçları (şüphe incelemesi için). */

export async function GET(req: Request) {
  const blocked = await yonetimKoru(req)
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
