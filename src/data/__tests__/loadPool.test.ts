import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Song } from '../schema'

/** Modül düzeyinde önbellek var; her test taze modül ister. */
async function taze() {
  vi.resetModules()
  const havuz = await import('../loadPool')
  const alanlar = await import('../loadSongFields')
  return { ...havuz, ...alanlar }
}

const sarki = (id: string, over: Partial<Song> = {}): Song => ({
  id, t: id, a: 'x', cs: 0.3, du: 29, y: 2000, e: '00', d: 3, c: 'pop',
  nT: id, nA: 'x', k: [], ...over,
})

function sahteFetch(yanit: (url: string) => unknown) {
  const cagrilar: string[] = []
  globalThis.fetch = vi.fn(async (url: string) => {
    cagrilar.push(url)
    return { ok: true, json: async () => yanit(url) }
  }) as unknown as typeof fetch
  return cagrilar
}

beforeEach(() => vi.restoreAllMocks())

describe('loadChip', () => {
  it('kademe verilince dilimi ister; tam havuz ayrı anahtar', async () => {
    const cagrilar = sahteFetch(() => ({ songs: [sarki('a')], kaynak: 'supabase' }))
    const m = await taze()
    await m.loadChip('karisik', 3)
    await m.loadChip('karisik', 3)
    await m.loadChip('karisik')
    expect(cagrilar).toEqual(['/api/havuz/karisik?kademe=3', '/api/havuz/karisik'])
  })

  it('yedek yanıt saklanmaz — sonraki çağrı yeniden dener', async () => {
    const cagrilar = sahteFetch(() => ({ songs: [sarki('a')], kaynak: 'yedek' }))
    const m = await taze()
    await m.loadChip('pop', 2)
    await m.loadChip('pop', 2)
    expect(cagrilar.length).toBe(2)
  })
})

describe('loadBaslangic', () => {
  it('paket şarkılarının alanlarını önbelleğe yazar — /api/sarki gerekmez', async () => {
    sahteFetch(() => ({ songs: [sarki('itunes:1', { p: 'bir.m4a', ar: 'kapak', u: 'magaza' })] }))
    const m = await taze()
    const paket = await m.loadBaslangic('karisik', 3)
    expect(paket).toHaveLength(1)
    expect(m.alanlarOnbellekten('itunes:1')).toEqual({ p: 'bir.m4a', ar: 'kapak', u: 'magaza' })
  })

  it('önizlemesiz şarkıyı pakete almaz', async () => {
    sahteFetch(() => ({ songs: [sarki('itunes:1'), sarki('itunes:2', { p: 'iki.m4a' })] }))
    const m = await taze()
    const paket = await m.loadBaslangic('pop', 1)
    expect(paket.map((s) => s.id)).toEqual(['itunes:2'])
  })

  it('ısıtma ile tur kurulumu üst üste binince TEK istek atılır', async () => {
    const cagrilar = sahteFetch((url) =>
      url.startsWith('/api/baslangic') ? { songs: [sarki('itunes:1', { p: 'bir.m4a' })] } : { songs: [], kaynak: 'supabase' },
    )
    const m = await taze()
    m.havuzuIsit('karisik', 3)
    await m.loadBaslangic('karisik', 3)
    expect(cagrilar.filter((u) => u.startsWith('/api/baslangic'))).toEqual(['/api/baslangic/karisik?kademe=3'])
  })

  it('ağ hatasında REDDETMEZ, boş döner ve saklamaz', async () => {
    let dusur = true
    const cagrilar: string[] = []
    globalThis.fetch = vi.fn(async (url: string) => {
      cagrilar.push(url)
      if (dusur) throw new Error('ağ yok')
      return { ok: true, json: async () => ({ songs: [sarki('itunes:1', { p: 'bir.m4a' })] }) }
    }) as unknown as typeof fetch
    const m = await taze()
    await expect(m.loadBaslangic('rap', 4)).resolves.toEqual([])
    dusur = false
    await vi.waitFor(async () => expect(await m.loadBaslangic('rap', 4)).toHaveLength(1))
    expect(cagrilar.length).toBe(2)
  })
})
