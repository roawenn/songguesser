/**
 * Bir kategorinin tohum sanatçılarını tarar ve bulunanları havuza ekler.
 *
 *   npx tsx scripts/havuz-tara.ts <kategori> [--yaz]
 *
 * `--yaz` olmadan yalnızca RAPOR verir, hiçbir şey yazmaz.
 *
 * ⚠️ Panelin "hepsini tara" akışının betik hâli. Aynı uç noktaları kullanır,
 * yani aynı elemelerden geçer: parti içi ve veritabanına karşı kopya ayıklama,
 * kademe önerisi, yıl düzeltmesi.
 *
 * ⚠️ Sanatçılar arasında bekleme ŞART. iTunes dakikada ~20 istek kabul ediyor
 * ve aşılınca 429 değil 403 dönüyor; paralel tarama kuyruğu komple düşürür.
 *
 * ⚠️ Kademeler ARACIN ÖNERİSİ. Sıra tabanlı bir sezgi, ölçüm değil; küratör
 * panelden değiştirebilir.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_IDS, type CategoryId } from '../src/data/categories'
import { seedsFor } from '../src/data/seeds'

const KOK = process.env.TAHMIN_KOK ?? 'http://localhost:3000'
/** iTunes sınırına takılmamak için sanatçılar arası bekleme. */
const ARA_MS = 3000
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Parca {
  trackId: number
  title: string
  artist: string
  onerilenKademe?: number
  year: number
}

function env(name: string): string {
  const file = join(process.cwd(), '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && m[1] === name && !process.env[name]) process.env[name] = m[2]
    }
  }
  const v = process.env[name]
  if (!v) throw new Error(`${name} tanımlı değil (.env.local)`)
  return v
}

const CEREZ_DOSYA = join(process.cwd(), '.tahmin-oturum')
/** ⚠️ Üretimde `__Host-` öneki çerez ADININ parçasıdır. */
const CEREZ_ADI = KOK.startsWith('https://') ? '__Host-tahmin_yonetim' : 'tahmin_yonetim'
/** 32 baytın base64url hâli — `lib/adminAuth` ile aynı biçim. */
const BELIRTEC_DESENI = /^[A-Za-z0-9_-]{43}$/

/**
 * Yönetici çerezini okur.
 *
 * ⚠️ BETİK ARTIK GİRİŞ YAPMIYOR. Panel parolası kaldırıldı; yetki bir Google
 * hesabına bağlı ve bir komut satırı aracı tarayıcısız OAuth akışını
 * yürütemez. Bunun yerine tarayıcıdaki oturum çerezi elle yapıştırılıyor.
 *
 * ⚠️ Çerez 12 SAAT geçerli — parolanın aksine kalıcı bir sır değil. Süresi
 * dolunca panelden yeniden doğrulayıp kopyalamak gerekir.
 */
function cerezOku(): string {
  const ham = (
    process.env.TAHMIN_YONETIM_CEREZ ?? (existsSync(CEREZ_DOSYA) ? readFileSync(CEREZ_DOSYA, 'utf8') : '')
  ).trim()
  if (BELIRTEC_DESENI.test(ham)) return ham
  throw new Error(
    'Yönetici çerezi gerekli:\n' +
      `  1) Tarayıcıda ${KOK}/yonetim aç, "Google ile doğrula"yı tamamla\n` +
      `  2) DevTools → Application → Cookies → ${CEREZ_ADI} değerini kopyala\n` +
      '  3) .tahmin-oturum dosyasına yapıştır (ya da TAHMIN_YONETIM_CEREZ=... ver)',
  )
}

async function sayim(cat: CategoryId): Promise<number> {
  const r = await fetch(
    `${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/songs?select=id&category=eq.${cat}`,
    {
      headers: {
        apikey: env('SUPABASE_SECRET_KEY'),
        Authorization: `Bearer ${env('SUPABASE_SECRET_KEY')}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    },
  )
  return Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
}

async function main() {
  const cat = process.argv[2] as CategoryId
  const yaz = process.argv.includes('--yaz')
  if (!CATEGORY_IDS.includes(cat)) {
    console.error(`Kullanım: npx tsx scripts/havuz-tara.ts <${CATEGORY_IDS.join('|')}> [--yaz]`)
    process.exit(1)
  }

  /*
   * ⚠️ `origin` ŞART: yönetim yazma yolları artık CSRF denetimi (`ayniKoken`)
   * uyguluyor. Başlıksız istek 403 alır ve `--yaz` sessizce hiçbir şey yazmaz.
   */
  const bas = { cookie: `${CEREZ_ADI}=${cerezOku()}`, origin: KOK }

  // Tek sağlık yoklaması: çerez düşmüşse ilk taramadan önce anla.
  const sag = await fetch(`${KOK}/api/yonetim`, { headers: bas })
  if (!sag.ok) {
    throw new Error(
      sag.status === 404
        ? 'Çerez geçersiz/süresi dolmuş ya da bu hesap artık YONETICI_EPOSTALAR içinde değil.'
        : `Yönetim erişimi yok (${sag.status}).`,
    )
  }

  const sanatcilar = seedsFor(cat)
  const once = await sayim(cat)
  console.log(`${cat}: ${sanatcilar.length} sanatçı taranacak · havuzda ${once} şarkı\n`)

  const bulunan = new Map<number, Parca>()
  for (const [i, sanatci] of sanatcilar.entries()) {
    const r = await fetch(`${KOK}/api/yonetim/oner?sanatci=${encodeURIComponent(sanatci)}`, {
      headers: bas,
    })
    const d = (await r.json()) as { results?: Parca[]; error?: string }
    if (!r.ok) {
      console.log(`  [${i + 1}/${sanatcilar.length}] ${sanatci}: HATA ${d.error ?? r.status}`)
      // 403 iTunes sınırıdır; devam etmek kuyruğun kalanını da yakar.
      if (r.status === 502) break
    } else {
      const res = d.results ?? []
      for (const t of res) bulunan.set(t.trackId, t)
      console.log(`  [${i + 1}/${sanatcilar.length}] ${sanatci}: ${res.length} parça`)
    }
    if (i < sanatcilar.length - 1) await bekle(ARA_MS)
  }

  const tracks = [...bulunan.values()].map((t) => ({
    track: t,
    tier: t.onerilenKademe ?? 3,
    year: t.year,
  }))
  console.log(`\nbenzersiz parça: ${tracks.length}`)

  if (!yaz) {
    console.log('(--yaz verilmedi, hiçbir şey yazılmadı)')
    return
  }

  const r = await fetch(`${KOK}/api/yonetim/ara`, {
    method: 'POST',
    headers: { ...bas, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat, tracks }),
  })
  const d = (await r.json()) as {
    eklenen?: number
    atlanan?: string[]
    zatenVar?: string[]
    basarisiz?: string[]
    error?: string
  }
  const sonra = await sayim(cat)

  if (d.error) console.log('HATA:', d.error.slice(0, 300))
  console.log(
    `eklenen ${d.eklenen ?? 0} · zaten havuzda ${d.zatenVar?.length ?? 0} · ` +
      `kopya atlandı ${d.atlanan?.length ?? 0} · yazılamayan ${d.basarisiz?.length ?? 0}`,
  )
  console.log(`${cat}: ${once} → ${sonra} (+${sonra - once})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
