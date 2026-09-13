import { NextResponse } from 'next/server'
import { isAuthed, adminConfigured } from '@/lib/adminAuth'
import { restUrl, restHeaders } from '@/lib/supabase'

/**
 * Ziyaretçi mesajlarını okur, okundu işaretler, siler.
 *
 * Mesajlar `/api/iletisim` üzerinden gelir. Tablo RLS altında ve hiçbir
 * politikası yok; okuma da yazma da yalnızca secret key ile, yani yalnızca
 * sunucuda yapılabiliyor.
 */

export interface MessageRow {
  id: number
  name: string
  surname: string
  body: string
  read: boolean
  created_at: string
}

async function guard() {
  if (!(await adminConfigured())) {
    return NextResponse.json({ error: 'Panel yapılandırılmamış.' }, { status: 503 })
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  }
  return null
}

export async function GET() {
  const blocked = await guard()
  if (blocked) return blocked

  const params = new URLSearchParams({
    select: 'id,name,surname,body,read,created_at',
    order: 'created_at.desc',
    limit: '500',
  })

  const res = await fetch(restUrl(`messages?${params}`), {
    headers: restHeaders({ secret: true }),
    cache: 'no-store',
  })
  if (!res.ok) {
    return NextResponse.json(
      { error: `Supabase ${res.status}: ${await res.text()}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ rows: (await res.json()) as MessageRow[] })
}

/** Okundu/okunmadı işaretler. */
export async function PATCH(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })
  }
  if (typeof body.read !== 'boolean') {
    return NextResponse.json({ error: 'read gerekli.' }, { status: 400 })
  }

  const res = await fetch(restUrl(`messages?id=eq.${id}`), {
    method: 'PATCH',
    headers: { ...restHeaders({ secret: true }), Prefer: 'return=minimal' },
    body: JSON.stringify({ read: body.read }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: `Supabase ${res.status}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id gerekli.' }, { status: 400 })
  }

  const res = await fetch(restUrl(`messages?id=eq.${id}`), {
    method: 'DELETE',
    headers: restHeaders({ secret: true }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: `Supabase ${res.status}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
