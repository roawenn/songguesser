/**
 * Dışarıdan verilen bir görsel adresinin sunucudan çekilmesi güvenli mi?
 *
 * ⚠️ Bu bir SSRF savunması. Yönetim paneli kimlik doğrulamalı ama uç nokta
 * yine de "bize keyfi bir adrese istek attır" demek; küratör hesabı ele
 * geçirilirse sunucu iç ağa ve bulut metadata servisine sokulabilir.
 * `169.254.169.254` tek bir GET ile bulut kimlik bilgilerini döker.
 *
 * ⚠️ Bu kontrol ANA ADI (hostname) denetler, DNS'i ÇÖZMEZ. Yani kendi alan
 * adını `127.0.0.1`'e işaretleyen biri bunu aşabilir (DNS rebinding). Tam
 * savunma çözümlenen IP'yi bağlantı anında denetlemeyi gerektirir ve Node'un
 * `fetch`'i buna izin vermiyor. Kalan risk bilinçli kabul ediliyor: uç nokta
 * yönetici çerezi arkasında ve yanıt gövdesi istemciye görsel olarak dönüyor,
 * yani sızdırılabilecek şey yalnızca "görsel gibi ayrıştırılabilen" bir yanıt.
 *
 * ⚠️ Saf ve `.ts` — `vitest` yalnızca `src/**\/*.test.ts` topluyor, bu yüzden
 * rota içinde değil burada duruyor.
 */

/** Dört sayılı IPv4 mi, öyleyse baytları. */
function ipv4(host: string): number[] | null {
  const p = host.split('.')
  if (p.length !== 4) return null
  const n = p.map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : -1))
  return n.every((x) => x >= 0 && x <= 255) ? n : null
}

/** Yerel ağ, geri döngü, bağlantı-yerel ve ayrılmış aralıklar. */
function ozelIPv4(n: number[]): boolean {
  const [a, b] = n as [number, number, number, number]
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // özel
  if (a === 127) return true // geri döngü
  if (a === 169 && b === 254) return true // bağlantı-yerel + bulut metadata
  if (a === 172 && b >= 16 && b <= 31) return true // özel
  if (a === 192 && b === 168) return true // özel
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // çok noktaya yayın + ayrılmış
  return false
}

/**
 * IPv6 adresini sekiz 16-bit gruba açar. Geçersizse `null`.
 *
 * ⚠️ Bu gerekli, çünkü `URL` ayrıştırıcısı adresi NORMALLEŞTİRİYOR:
 * `[::ffff:127.0.0.1]` → `[::ffff:7f00:1]`. Önce noktalı dörtlüyü arayan bir
 * düzenli ifade yazmıştım ve gerçek girdide HİÇ eşleşmiyordu — test yakaladı.
 */
function ipv6Gruplari(h: string): number[] | null {
  const parcalar = h.split('::')
  if (parcalar.length > 2) return null
  const oku = (x: string) => (x === '' ? [] : x.split(':').map((g) => parseInt(g, 16)))
  const sol = oku(parcalar[0] ?? '')
  const sag = parcalar.length === 2 ? oku(parcalar[1] ?? '') : []
  if ([...sol, ...sag].some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null
  if (parcalar.length === 1) return sol.length === 8 ? sol : null
  const bosluk = 8 - sol.length - sag.length
  if (bosluk < 0) return null
  return [...sol, ...Array<number>(bosluk).fill(0), ...sag]
}

function ozelIPv6(host: string): boolean {
  const h = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  const g = ipv6Gruplari(h)
  if (!g) return true // ayrıştıramadıysak güvenli tarafta kal

  // :: (belirsiz) ve ::1 (geri döngü)
  if (g.every((x) => x === 0)) return true
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true

  // fc00::/7 benzersiz yerel, fe80::/10 bağlantı-yerel
  const ilk = g[0]!
  if ((ilk & 0xfe00) === 0xfc00) return true
  if ((ilk & 0xffc0) === 0xfe80) return true

  /*
   * IPv4 gömülü biçimler — gömülü adres özelse bu da özeldir:
   *   ::ffff:a.b.c.d  (IPv4 eşlenmiş)
   *   64:ff9b::a.b.c.d (NAT64)
   */
  const gomulu = (): number[] | null => {
    const sonIki = () => [g[6]! >> 8, g[6]! & 0xff, g[7]! >> 8, g[7]! & 0xff]
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return sonIki()
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return sonIki()
    return null
  }
  const v4 = gomulu()
  if (v4 && ozelIPv4(v4)) return true

  return false
}

/** İndirilmesine izin verilen en büyük gövde. */
export const EN_BUYUK_GORSEL = 12 * 1024 * 1024

export type DisUrlSonuc = { ok: true; url: URL } | { ok: false; sebep: string }

export function guvenliDisUrl(ham: string): DisUrlSonuc {
  let u: URL
  try {
    u = new URL(ham.trim())
  } catch {
    return { ok: false, sebep: 'Geçerli bir adres değil.' }
  }

  // ⚠️ Yalnızca https. `http:` araya girmeye açık; `file:`, `data:`, `gopher:`
  // ve `blob:` ise doğrudan sunucunun kendi diskine/iç ağına kapı.
  if (u.protocol !== 'https:') {
    return { ok: false, sebep: 'Yalnızca https adresleri alınabilir.' }
  }

  // ⚠️ `toLowerCase()` YOK: proje kuralı onu `src/text/` dışında yasaklıyor ve
  // burada gereksiz — URL ayrıştırıcısı ASCII ana adı zaten küçültüyor.
  const host = u.hostname

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, sebep: 'Yerel adresler alınamaz.' }
  }

  const v4 = ipv4(host)
  if (v4 && ozelIPv4(v4)) return { ok: false, sebep: 'Yerel ağ adresleri alınamaz.' }
  if (host.includes(':') && ozelIPv6(host)) {
    return { ok: false, sebep: 'Yerel ağ adresleri alınamaz.' }
  }

  // Noktasız ana ad = iç ağ makine adı (ör. `intranet`).
  if (!v4 && !host.includes(':') && !host.includes('.')) {
    return { ok: false, sebep: 'Yerel ağ adresleri alınamaz.' }
  }

  return { ok: true, url: u }
}
