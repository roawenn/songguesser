import { NextResponse } from 'next/server'
import { DUELLO_SARKI, kodGecerli } from '@/game/duel'
import { cevaplar, duelloOku, oyuncular, slotDogrula } from '@/lib/duelStore'
import { loadSongsByIds } from '@/lib/duelSongs'

/**
 * Düellonun durumu — istemci bunu ~1,5 saniyede bir yoklar.
 *
 * Supabase Realtime yerine YOKLAMA seçildi: iki kişilik bir düelloda tek
 * merak edilen şey "rakip bu şarkıyı bitirdi mi", bunun için websocket
 * kurmak, RLS politikası açmak ve tarayıcıya ikinci bir istemci indirmek
 * gerekmiyor. Yoklama her ağda çalışır ve sessizce ölmez.
 *
 * ⚠️ Şarkılar YALNIZCA gizli anahtarı doğrulanan oyuncuya verilir. Aksi hâlde
 * kodu bilen herkes 5 cevabı da okuyabilirdi.
 */
export async function GET(req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
  if (!kodGecerli(kod)) return NextResponse.json({ error: 'Geçersiz kod.' }, { status: 400 })

  const duel = await duelloOku(kod)
  if (!duel) return NextResponse.json({ error: 'Lobi bulunamadı.' }, { status: 404 })
  if (new Date(duel.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu lobinin süresi dolmuş.' }, { status: 410 })
  }

  /**
   * ⚠️ Gizli anahtar BAŞLIKTAN okunur, sorgu dizesinden değil.
   *
   * Bu değer, oyuncunun adına cevap yazmanın tek taşıyıcı kimlik bilgisi ve
   * yoklama onu 1,5 saniyede bir gönderiyor. URL'de olduğu sürece CDN ve ters
   * vekil günlüklerine, tarayıcı geçmişine ve ileride eklenecek her analitiğe
   * düşüyordu — bir düelloda yüzlerce kez. Aynı köken olduğu için özel başlık
   * preflight de gerektirmiyor.
   */
  const gizli = req.headers.get('x-duello-gizli') ?? ''
  const slot = gizli ? await slotDogrula(kod, gizli) : null
  const kisiler = await oyuncular(kod)
  const hepsi = await cevaplar(kod)

  /**
   * ⚠️ Şarkılar ADIM ADIM açılır.
   *
   * Beşini birden yollamak, düelloyu kazanmak isteyen birinin ağ sekmesini
   * açıp bütün cevapları daha ilk saniyede okuması demekti. Oyuncu yalnızca
   * oynadığı şarkıyı ve bir sonrakini görür — sonraki, `useRound` sesi önden
   * yükleyebilsin diye. Kendi beş turu bitince liste tamamen açılır; bitiş
   * ekranı şarkıları gösteriyor.
   *
   * ⚠️ Bu TAM bir çözüm değil: tahmin eşleştirmesi tarayıcıda yapıldığı için
   * o an OYNANAN şarkının adı her hâlükârda bellekte — tek oyunculu turda da
   * öyle. Amaç beş cevabı peşin peşin servis etmemek.
   */
  const bitirilen = slot ? hepsi.filter((c) => c.slot === slot).length : 0
  const gorunur = Math.min(DUELLO_SARKI, bitirilen >= DUELLO_SARKI ? DUELLO_SARKI : bitirilen + 2)

  return NextResponse.json({
    kod,
    chip: duel.chip,
    status: duel.status,
    startedAt: duel.started_at,
    /*
     * ⚠️ Geri sayım ve bekleme süresi sunucunun yazdığı damgalara bakıyor.
     * İstemci kendi `Date.now()`'uyla karşılaştırdığında saati kaymış bir
     * cihazda sonuç anlamsız çıkıyordu; kaymayı ölçebilsin diye sunucu kendi
     * saatini de bildiriyor.
     */
    sunucuZamani: new Date().toISOString(),
    oyuncuSayisi: kisiler.length,
    slot,
    // Şarkılar yalnızca doğrulanmış oyuncuya.
    songs: slot ? await loadSongsByIds(duel.song_ids.slice(0, gorunur)) : null,
    cevaplar: hepsi,
  })
}
