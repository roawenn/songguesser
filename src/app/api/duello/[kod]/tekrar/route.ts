import { NextResponse } from 'next/server'
import { DUELLO_TUR, kodGecerli } from '@/game/duel'
import { cevaplar, duelloKur, duelloOku, slotDogrula, tekrarKodAyarla, turleriSec } from '@/lib/duelStore'
import { cokHizli, sinirAsildi } from '@/lib/hizSinir'
import { supabaseReady } from '@/lib/supabase'

/**
 * Rövanş: biten bir düellodan aynı ayarlarla YENİ lobi.
 *
 * ⚠️ AYNI ŞARKILAR TEKRAR OYNANMAZ. Yeni lobi `turleriSec` ile yeniden seçim
 * yapıyor; aynı beşliyi vermek rövanşı ezberden oynanan bir tura çevirirdi.
 * Değişmeyen tek şey oyun, seçki ve kapak düellosundaki kolay mod tercihi.
 *
 * ⚠️ İSTEK/KABUL ayrı uç nokta değil. İlk basan lobiyi kurup kodu eski
 * düelloya yazıyor; ikinci basan aynı kodu alıyor ve ona katılıyor. Böylece
 * "kabul" ayrı bir durum makinesi gerektirmiyor.
 */
export async function POST(req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
  if (!kodGecerli(kod)) return NextResponse.json({ error: 'Geçersiz kod.' }, { status: 400 })
  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Düello şu an kapalı.' }, { status: 503 })
  }

  // Lobi kurmanın kendi sınırı var; rövanş da lobi kuruyor.
  if (await sinirAsildi(req, { ad: 'duello-tekrar', limit: 10, pencere: '10 minutes', hataVarsaIzin: true })) {
    return cokHizli('Çok fazla rövanş istedin. Biraz bekle.')
  }

  const duel = await duelloOku(kod)
  if (!duel) return NextResponse.json({ error: 'Lobi bulunamadı.' }, { status: 404 })
  if (new Date(duel.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu lobinin süresi dolmuş.' }, { status: 410 })
  }

  /*
   * ⚠️ Gizli anahtar ŞART: kodu bilen üçüncü biri rövanş lobisi kurup
   * oyuncuları başka bir odaya sürükleyememeli. Başlıktan okunuyor —
   * yoklamayla aynı gerekçe (bkz. `api/duello/[kod]`).
   */
  const gizli = req.headers.get('x-duello-gizli') ?? ''
  const slot = gizli ? await slotDogrula(kod, gizli) : null
  if (!slot) return NextResponse.json({ error: 'Bu düellonun oyuncusu değilsin.' }, { status: 403 })

  // Rövanş ancak kendi beş turunu bitiren isteyebilir.
  const hepsi = await cevaplar(kod)
  if (hepsi.filter((c) => c.slot === slot).length < DUELLO_TUR) {
    return NextResponse.json({ error: 'Düello daha bitmedi.' }, { status: 409 })
  }

  // Rakip önce davrandıysa yeni lobi zaten var; oraya katıl.
  if (duel.tekrar_kod) return NextResponse.json({ kod: duel.tekrar_kod })

  const songIds = await turleriSec(duel.oyun, duel.chip)
  if (!songIds) {
    return NextResponse.json({ error: 'Bu seçkide yeni bir tur kurulamadı.' }, { status: 409 })
  }

  const kurulan = await duelloKur(duel.oyun, duel.chip, songIds, duel.kolay)
  if (!kurulan) return NextResponse.json({ error: 'Lobi kurulamadı, tekrar dene.' }, { status: 502 })

  const gecerli = await tekrarKodAyarla(kod, kurulan.code)

  /*
   * ⚠️ Yarışı KAYBETTİYSEK kendi gizli anahtarımızı DÖNMÜYORUZ: o anahtar
   * bizim kurduğumuz (artık sahipsiz) lobiye ait. Rakibin lobisine normal
   * katılma yolundan gireceğiz. Sahipsiz lobi iki saatte kendiliğinden düşer.
   */
  return gecerli === kurulan.code
    ? NextResponse.json({ kod: gecerli, gizli: kurulan.secret, slot: 1 })
    : NextResponse.json({ kod: gecerli })
}
