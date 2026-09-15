import 'server-only'
import { createHash } from 'node:crypto'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/**
 * Havuz yanıtlarını SIKIŞTIRARAK döndürür.
 *
 * ⚠️ Next bu rotaları kendiliğinden sıkıştırmıyor (ölçüldü: hem `next dev` hem
 * `next start`, `content-encoding` başlığı yok). Karışık seçkinin havuzu 3,86 MB
 * ve oyunun ilk turu bu yanıt inmeden başlamıyordu: yerelde tek başına ~1,3 sn.
 * Brotli ile 547 KB, gzip ile 641 KB.
 *
 * ⚠️ Sıkıştırılmış gövde BELLEKTE tutuluyor (kısa ömürlü). Yoksa her istek
 * 3,8 MB'lık JSON'u yeniden üretip yeniden sıkıştırırdı: ~165 ms CPU. Süre
 * `Cache-Control: max-age` ile aynı tutuldu, yani bayatlık penceresi değişmiyor.
 *
 * ⚠️ `ETag` + `304`: seçki değişmediyse tarayıcı gövdeyi hiç indirmiyor.
 *
 * ⚠️ GÖVDE DE TEMBEL: isteği okumak (Accept-Encoding) rotayı dinamik yapıyor,
 * yani Next'in rota önbelleği devreden çıkıyor ve her istek Supabase'e 16
 * sayfalık okuma yapıyordu (40 ms → 1,2 sn, ölçüldü). Bu yüzden üretici
 * fonksiyon yalnızca önbellek soğukken çağrılıyor.
 */

/** Bu süre boyunca kayıt taze sayılır. */
const TTL_MS = 60_000
/**
 * Tazelik bittikten sonra kaydın BAYAT olarak servis edilebileceği süre.
 *
 * ⚠️ Olmasaydı her dakikanın ilk isteği havuzu yeniden üretirdi: Supabase'den
 * 16 sayfalık okuma, ~1,2 sn (ölçüldü). Bayatı verip arkadan tazelemek, o
 * bekleyişi yalnızca sunucunun ilk isteğine indiriyor. Yanıt başlığındaki
 * `stale-while-revalidate` ile aynı fikir.
 */
const BAYAT_MS = 10 * 60_000

/** Node Buffer'ının kendi baytları — havuzdan (pooled) pay almadan. */
function arrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

interface Kayit {
  zaman: number
  /** Arkada süren tazeleme — aynı anda ikinci kez üretilmesin. */
  yenileniyor?: Promise<void>
  etag: string
  /** ⚠️ `Buffer` DEĞİL `ArrayBuffer`: `Response` gövde tipi Node'un Buffer'ını kabul etmiyor. */
  ham: ArrayBuffer
  br?: ArrayBuffer
  gzip?: ArrayBuffer
}

const onbellek = new Map<string, Kayit>()

async function uretVeYaz(anahtar: string, uret: () => Promise<unknown>): Promise<Kayit> {
  const ham = arrayBuffer(Buffer.from(JSON.stringify(await uret()), 'utf8'))
  const etag = `"${createHash('sha1').update(new Uint8Array(ham)).digest('base64url').slice(0, 20)}"`
  // Aynı içerik yeniden üretildiyse sıkıştırılmışları KORU: brotli 84 ms.
  const onceki = onbellek.get(anahtar)
  const kayit: Kayit =
    onceki && onceki.etag === etag
      ? { ...onceki, zaman: Date.now(), yenileniyor: undefined }
      : { zaman: Date.now(), etag, ham }
  onbellek.set(anahtar, kayit)
  return kayit
}

async function kayitAl(anahtar: string, uret: () => Promise<unknown>): Promise<Kayit> {
  const eski = onbellek.get(anahtar)
  if (!eski) return uretVeYaz(anahtar, uret)

  const yas = Date.now() - eski.zaman
  if (yas < TTL_MS) return eski

  if (yas < BAYAT_MS) {
    // Bayat ama servis edilebilir: tazelemeyi arkada başlat, beklemeden dön.
    eski.yenileniyor ??= uretVeYaz(anahtar, uret)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        const guncel = onbellek.get(anahtar)
        if (guncel) guncel.yenileniyor = undefined
      })
    return eski
  }

  return uretVeYaz(anahtar, uret)
}

/**
 * `anahtar`: seçki başına önbellek anahtarı (ör. `havuz:pop`).
 * `uret`: gövdeyi üreten fonksiyon — YALNIZCA önbellek soğukken çağrılır.
 */
export async function sikistirilmisJson(
  req: Request,
  anahtar: string,
  uret: () => Promise<unknown>,
  basliklar: Record<string, string> = {},
): Promise<Response> {
  const kayit = await kayitAl(anahtar, uret)

  const temel: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    ETag: kayit.etag,
    // ⚠️ Vekiller aynı adresi farklı kodlamalarla ayrı saklamalı.
    Vary: 'Accept-Encoding',
    ...basliklar,
  }

  if (req.headers.get('if-none-match') === kayit.etag) {
    return new Response(null, { status: 304, headers: temel })
  }

  const kabul = req.headers.get('accept-encoding') ?? ''
  if (/\bbr\b/.test(kabul)) {
    kayit.br ??= arrayBuffer(brotliCompressSync(new Uint8Array(kayit.ham), {
      params: {
        // Kalite 5: 547 KB / 84 ms. Kalite 11 yalnızca ~%3 daha küçük ama saniyelerce sürüyor.
        [constants.BROTLI_PARAM_QUALITY]: 5,
        [constants.BROTLI_PARAM_SIZE_HINT]: kayit.ham.byteLength,
      },
    }))
    return new Response(kayit.br, { headers: { ...temel, 'Content-Encoding': 'br' } })
  }
  if (/\bgzip\b/.test(kabul)) {
    kayit.gzip ??= arrayBuffer(gzipSync(new Uint8Array(kayit.ham)))
    return new Response(kayit.gzip, { headers: { ...temel, 'Content-Encoding': 'gzip' } })
  }
  return new Response(kayit.ham, { headers: temel })
}
