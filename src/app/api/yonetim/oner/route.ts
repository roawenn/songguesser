import { NextResponse } from 'next/server'
import { yonetimKoru } from '@/lib/yonetimKoru'
import { scanArtist, ITunesError } from '@/lib/itunesSearch'

/**
 * Sanatçı taraması: bir sanatçının Apple TR'de mevcut şarkılarını döndürür.
 *
 * ⚠️ Sanatçı başına TEK istek. iTunes dakikada ~20 istek kabul ediyor ve
 * aşılınca 403 dönüyor; toplu tarama panelde kuyruğa alınıp aralıklarla
 * akıtılıyor, burada paralel çağrı yapılmıyor. Sonuçlar bir saat önbellekli.
 */
export async function GET(req: Request) {
  const engel = await yonetimKoru(req)
  if (engel) return engel

  const artist = new URL(req.url).searchParams.get('sanatci')?.trim()
  if (!artist || artist.length < 2) {
    return NextResponse.json({ error: 'Sanatçı adı gerekli.' }, { status: 400 })
  }

  try {
    return NextResponse.json({ artist, results: await scanArtist(artist) })
  } catch (e) {
    if (e instanceof ITunesError) {
      return NextResponse.json({ error: e.message }, { status: e.status === 403 ? 429 : 502 })
    }
    return NextResponse.json({ error: 'Tarama başarısız.' }, { status: 502 })
  }
}
