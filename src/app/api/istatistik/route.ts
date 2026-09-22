import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sanitize } from '@/game/stats'
import { unluSanitize } from '@/game/unluStats'
import { cokHizli, sinirAsildi } from '@/lib/hizSinir'
import { ayniKoken, oturumKullanici } from '@/lib/kullaniciAuth'
import { istatistikOku, istatistikYaz, oyunGecerli, type Oyun } from '@/lib/istatistikStore'
import { supabaseReady } from '@/lib/supabase'

/**
 * Hesaba bağlı oyun istatistikleri.
 *
 * ⚠️ GİRİŞ ŞART ve başka bir yer YOK. Sayaçların tek kalıcı adresi burası;
 * girişsiz oyuncuda hiçbir şey saklanmıyor ve kart da çizilmiyor (bkz.
 * `store/useStatsStore`).
 *
 * ⚠️ GELEN GÖVDE SÜZÜLÜYOR. Sayaçları istemci hesaplıyor (kural saf
 * modüllerde ve testli), yani istekle "1 milyon tur kazandım" göndermek
 * mümkün. `sanitize` alanları birbirine karşı da doğruluyor — kazanılan,
 * oynanandan büyük olamaz — ve tarayıcıdaki kurcalanmış kayda uygulanan
 * süzgecin aynısı.
 */

function temizle(oyun: Oyun, veri: unknown) {
  return oyun === 'sarki' ? sanitize(veri) : unluSanitize(veri)
}

/**
 * Tarayıcının "bu sayaçlar hangi hesaba taşındı" diye sakladığı anahtar.
 *
 * ⚠️ KULLANICI KİMLİĞİ GÖNDERİLMİYOR. İstemcinin tek ihtiyacı hesapları
 * birbirinden ayırt etmek; veritabanı anahtarını tarayıcıya indirmek (hem de
 * `localStorage`'a yazılmak üzere) gereksiz bir sızıntı olurdu. Özet gizli
 * anahtarla tuzlandığı için geri çevrilemez, hesap ömrü boyunca da sabit —
 * e-posta değişse bile (eşleşme `google_sub` ile).
 */
function hesapAnahtari(id: string): string {
  const gizli = process.env.SUPABASE_SECRET_KEY ?? 'tahmin.in'
  return createHash('sha256').update(`istatistik:${gizli}:${id}`).digest('hex').slice(0, 32)
}

export async function GET() {
  const k = await oturumKullanici()
  if (!k) return NextResponse.json({ istatistik: null }, { headers: { 'Cache-Control': 'private, no-store' } })
  const anahtar = hesapAnahtari(k.id)
  if (!supabaseReady) {
    return NextResponse.json({ istatistik: {}, anahtar }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  try {
    const ham = await istatistikOku(k.id)
    const istatistik: Record<string, unknown> = {}
    for (const [oyun, veri] of Object.entries(ham)) {
      if (oyunGecerli(oyun)) istatistik[oyun] = temizle(oyun, veri)
    }
    return NextResponse.json({ istatistik, anahtar }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'İstatistik okunamadı.' }, { status: 502 })
  }
}

export async function PUT(req: Request) {
  if (!ayniKoken(req)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  const k = await oturumKullanici()
  if (!k) return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 })
  /*
   * ⚠️ Sınır GENİŞ ve hata hâlinde AÇIK: bir tur en az birkaç saniye sürüyor,
   * yani normal oyunda saatte 300 yazma imkânsıza yakın. Sınır kapanırsa
   * oyuncunun sayaçları kaybolur; bu, kötüye kullanımdan daha kötü.
   */
  if (await sinirAsildi(req, { ad: 'istatistik', limit: 300, pencere: '1 hour', hataVarsaIzin: true })) return cokHizli()

  const govde = (await req.json().catch(() => ({}))) as { oyun?: unknown; veri?: unknown }
  if (!oyunGecerli(govde.oyun)) return NextResponse.json({ error: 'Geçersiz oyun.' }, { status: 400 })

  const temiz = temizle(govde.oyun, govde.veri)
  if (!(await istatistikYaz(k.id, govde.oyun, temiz))) {
    return NextResponse.json({ error: 'İstatistik kaydedilemedi.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, veri: temiz })
}
