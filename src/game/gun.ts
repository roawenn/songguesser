/**
 * Takvim günü yardımcıları — Günlük modun "bugün"ü.
 *
 * Gün `'YYYY-MM-DD'` dizesi olarak taşınır: Postgres `date` kolonuna olduğu
 * gibi yazılıyor, URL'de okunur ve sözlük sırası takvim sırasıyla aynı.
 *
 * ⚠️ GÜN İSTANBUL'A GÖRE DÖNER, sunucunun ya da oyuncunun saat diliminden
 * bağımsız. Vercel lambdaları UTC'de çalışıyor; `new Date().toISOString()`
 * ile gün almak 00:00-03:00 arasında oyunculara DÜNÜN setini verirdi.
 *
 * ⚠️ +3 SABİTLENMEDİ. Türkiye 2016'dan beri yaz saati uygulamıyor ama saat
 * dilimi verisi Intl'den okunuyor; kural bir gün değişirse kod değişmez.
 */

export type Gun = string

const SAAT_DILIMI = 'Europe/Istanbul'

let gunBicimi: Intl.DateTimeFormat | null = null
let parcaBicimi: Intl.DateTimeFormat | null = null

/** `en-CA` biçimi zaten `YYYY-MM-DD` üretir. */
function gunBicimci(): Intl.DateTimeFormat {
  gunBicimi ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: SAAT_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return gunBicimi
}

function parcaBicimci(): Intl.DateTimeFormat {
  parcaBicimi ??= new Intl.DateTimeFormat('en-US', {
    timeZone: SAAT_DILIMI,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })
  return parcaBicimi
}

/** Verilen andaki İstanbul takvim günü. */
export function istanbulGunu(an: Date): Gun {
  return gunBicimci().format(an)
}

const GUN_DESENI = /^(\d{4})-(\d{2})-(\d{2})$/

/** Biçimi doğru VE takvimde var olan bir gün mü? (`2026-02-30` değil.) */
export function gunGecerli(s: unknown): s is Gun {
  if (typeof s !== 'string') return false
  const m = GUN_DESENI.exec(s)
  if (!m) return false
  const [y, a, g] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(y, a - 1, g))
  return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g
}

function parcala(g: Gun): [number, number, number] {
  const m = GUN_DESENI.exec(g)
  if (!m) throw new Error(`Geçersiz gün: ${g}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Gün aritmetiği UTC tarihiyle — saat dilimi burada devreye girmemeli. */
export function gunEkle(g: Gun, n: number): Gun {
  const [y, a, d] = parcala(g)
  return new Date(Date.UTC(y, a - 1, d + n)).toISOString().slice(0, 10)
}

/** `a - b`, gün cinsinden. */
export function gunFarki(a: Gun, b: Gun): number {
  const [y1, a1, d1] = parcala(a)
  const [y2, a2, d2] = parcala(b)
  return Math.round((Date.UTC(y1, a1 - 1, d1) - Date.UTC(y2, a2 - 1, d2)) / 86_400_000)
}

/** Günün ait olduğu haftanın PAZARTESİSİ. */
export function haftaBasi(g: Gun): Gun {
  const [y, a, d] = parcala(g)
  const haftaGunu = new Date(Date.UTC(y, a - 1, d)).getUTCDay() // 0 = pazar
  return gunEkle(g, -((haftaGunu + 6) % 7))
}

/** Verilen UTC anında İstanbul saatinin UTC'den farkı (ms). */
function farkMs(anMs: number): number {
  const p: Record<string, number> = {}
  for (const { type, value } of parcaBicimci().formatToParts(new Date(anMs))) {
    if (type !== 'literal') p[type] = Number(value)
  }
  const yerelUtcGibi = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!)
  return yerelUtcGibi - Math.floor(anMs / 1000) * 1000
}

/**
 * Günün İstanbul'da başladığı an (00:00:00).
 *
 * ⚠️ İKİ GEÇİŞ: ilk tahminin farkı, gece yarısı bir saat değişimine denk
 * gelirse gerçek andaki farktan ayrı olabilir; ikinci okuma bunu düzeltir.
 */
export function gunBaslangici(g: Gun): Date {
  const [y, a, d] = parcala(g)
  const yerel = Date.UTC(y, a - 1, d)
  let an = yerel - farkMs(yerel)
  an = yerel - farkMs(an)
  return new Date(an)
}

/** Verilen andan sonraki ilk İstanbul gece yarısı. */
export function sonrakiGunBaslangici(an: Date): Date {
  return gunBaslangici(gunEkle(istanbulGunu(an), 1))
}
