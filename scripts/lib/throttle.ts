/**
 * iTunes Search API'nin IP başına ~20 istek/dakika yumuşak limiti var.
 * ⚠️ Aşıldığında 429 DEĞİL 403 döner — sadece 429 yakalayan kod sessizce ölür.
 *
 * Global minimum aralık 3200ms → ~18 istek/dk, limitin güvenli altında.
 * Cache'ten gelen yanıtlar bu kuyruğa hiç girmez.
 */
/**
 * Şeritler ayrıdır, çünkü limitler ayrıdır:
 *   - `search`: iTunes Search API — asıl kısıtlı olan uç nokta.
 *   - `cdn`: audio-ssl.itunes.apple.com — preview doğrulaması. Bu bir statik
 *     içerik CDN'i, Search API kotasına dahil değil; 3,2 sn beklemek havuz
 *     üretimini gereksiz yere iki katına çıkarırdı.
 */
const LANE_INTERVALS = {
  search: 3200,
  cdn: 150,
} as const

export type Lane = keyof typeof LANE_INTERVALS

const lastAt: Record<Lane, number> = { search: 0, cdn: 0 }
const chains: Record<Lane, Promise<unknown>> = {
  search: Promise.resolve(),
  cdn: Promise.resolve(),
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Bir şeridin çağrılarını kendi minimum aralığıyla seri hâle getirir. */
export function throttled<T>(lane: Lane, fn: () => Promise<T>): Promise<T> {
  const run = chains[lane].then(async () => {
    const wait = LANE_INTERVALS[lane] - (Date.now() - lastAt[lane])
    if (wait > 0) await sleep(wait)
    lastAt[lane] = Date.now()
    return fn()
  })
  // Zincirin bir hatayla kopmasını engelle.
  chains[lane] = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export interface RetryOptions {
  attempts?: number
  label?: string
  lane?: Lane
}

/**
 * 403 ve 429'da jitter'lı exponential backoff.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  { attempts = 4, label = url, lane = 'search' }: RetryOptions = {},
): Promise<Response> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await throttled(lane, () =>
        fetch(url, {
          ...init,
          headers: {
            'User-Agent': 'tahmin.net/1.0 (Turkish song quiz; contact: beftli@futbolist.co)',
            ...init.headers,
          },
        }),
      )
      if (res.status !== 403 && res.status !== 429) return res
      lastError = new Error(`${res.status} ${label}`)
    } catch (err) {
      lastError = err
    }
    const backoff = 2000 * 2 ** i + Math.random() * 1000
    console.warn(`  ⏳ ${label} — yeniden deneme ${i + 1}/${attempts}, ${Math.round(backoff)}ms`)
    await sleep(backoff)
  }
  throw lastError ?? new Error(`İstek başarısız: ${label}`)
}
