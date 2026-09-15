import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ⚠️ Modül düzeyinde önbellek tutuyor; her test taze modül ister.
 */
async function taze() {
  vi.resetModules()
  return import('../loadSongFields')
}

const alan = (p: string) => ({ p, ar: 'kapak', u: 'magaza' })

function sahteFetch() {
  const cagrilar: string[] = []
  const fn = vi.fn(async (url: string) => {
    cagrilar.push(url)
    const ids = decodeURIComponent(new URL(url, 'http://x').searchParams.get('ids') ?? '').split(',')
    return {
      ok: true,
      json: async () => ({ sarkilar: Object.fromEntries(ids.map((id) => [id, alan(`${id}.m4a`)])) }),
    }
  })
  globalThis.fetch = fn as unknown as typeof fetch
  return cagrilar
}

beforeEach(() => vi.restoreAllMocks())

describe('alanlariIsit', () => {
  it('iki kimliği TEK istekte ısıtır', async () => {
    const cagrilar = sahteFetch()
    const m = await taze()
    m.alanlariIsit(['itunes:1', 'itunes:2'])
    await vi.waitFor(() => expect(cagrilar.length).toBe(1))
    expect(cagrilar[0]).toContain('itunes%3A1%2Citunes%3A2')
  })

  it('ısıtılan ikinci kimlik için alanlariAl YENİ istek atmaz', async () => {
    const cagrilar = sahteFetch()
    const m = await taze()
    m.alanlariIsit(['itunes:1', 'itunes:2'])
    const sonuc = await m.alanlariAl('itunes:2')
    expect(sonuc?.p).toBe('itunes:2.m4a')
    expect(cagrilar.length).toBe(1)
  })

  it('zaten önbellekte olanı yeniden istemez', async () => {
    const cagrilar = sahteFetch()
    const m = await taze()
    await m.alanlariAl('itunes:1')
    m.alanlariIsit('itunes:1')
    expect(cagrilar.length).toBe(1)
  })
})

describe('alanlarOnbellekten', () => {
  it('önbellekte yoksa null, varsa senkron döner', async () => {
    sahteFetch()
    const m = await taze()
    expect(m.alanlarOnbellekten('itunes:1')).toBeNull()
    await m.alanlariAl('itunes:1')
    expect(m.alanlarOnbellekten('itunes:1')?.p).toBe('itunes:1.m4a')
  })
})
