import { NextResponse } from 'next/server'
import { PLAY_COLUMNS, restHeaders, restUrl, supabaseReady } from '@/lib/supabase'

/**
 * Bir ya da birkaç şarkının OYNANABİLİRLİK alanları: önizleme, kapak, mağaza.
 *
 * ⚠️ Bu uç nokta, toplu havuzdan üç URL alanını çıkarabilmek için var. O üç
 * alan 5089 satırlık yanıtın %60'ıydı (659 + 792 + 428 KB) ve hiçbiri havuzun
 * tamamı için gerekli değil: `preview` yalnızca kurulan şarkıda, `artwork` ve
 * `store_url` yalnızca sonuç kartında lazım.
 *
 * ⚠️ Tur kurulurken araya bir ağ adımı GİRMEZ: `useRound` sıradaki şarkının
 * alanlarını, oyuncu mevcut turu oynarken önden çekiyor. Yalnızca oturumun ilk
 * turu bu isteği bekler ve o istek ~200 bayt.
 *
 * Değerler değişmiyor (Apple'ın imzasız kalıcı yolları), o yüzden uzun süre
 * önbelleğe alınabilir.
 */

/** Tek istekte istenebilecek en fazla şarkı — önden yükleme 2 taneyle çalışıyor. */
const EN_COK = 25

export async function GET(req: Request) {
  if (!supabaseReady) return NextResponse.json({ sarkilar: {} })

  const ham = new URL(req.url).searchParams.get('ids') ?? ''
  const ids = [...new Set(ham.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, EN_COK)
  if (ids.length === 0) return NextResponse.json({ sarkilar: {} })

  /*
   * ⚠️ `in.()` içindeki her id tırnaklanıp kodlanıyor: id'ler `itunes:123`
   * biçiminde ve iki nokta üst üste ayrıştırıcıyı şaşırtabilir.
   */
  const filtre = ids.map((i) => `"${encodeURIComponent(i)}"`).join(',')
  const res = await fetch(
    restUrl(`songs?select=${PLAY_COLUMNS}&id=in.(${filtre})`),
    { headers: restHeaders(), next: { revalidate: 3600, tags: ['havuz'] } },
  )
  if (!res.ok) return NextResponse.json({ sarkilar: {} }, { status: 502 })

  const rows = (await res.json()) as {
    id: string
    preview: string
    artwork: string
    store_url: string
  }[]

  const sarkilar: Record<string, { p: string; ar: string; u: string }> = {}
  for (const r of rows) sarkilar[r.id] = { p: r.preview, ar: r.artwork, u: r.store_url }

  return NextResponse.json(
    { sarkilar },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  )
}
