import { describe, it, expect } from 'vitest'
import type { Difficulty } from '@/data/categories'
import { GUNLUK_KADEMELER, GUNLUK_SIRASI } from '../gunluk'
import { gunlukSec, type GunlukHavuzlar, type SecilenOge } from '../gunlukSec'
import { tohumluRastgele } from '../rastgele'
import { kapak, sarki, unlu } from './gunlukOrnek'

const kademe = (i: number) => ((i % 5) + 1) as Difficulty

function havuzlar(n = 60): GunlukHavuzlar {
  return {
    sarkilar: Array.from({ length: n }, (_, i) => sarki(i + 1, `Şarkı ${i}`, `Sanatçı ${i % 20}`, kademe(i))),
    unluler: Array.from({ length: n }, (_, i) => unlu(`u${i}`, `Ünlü ${i}`, kademe(i))),
    kapaklar: Array.from({ length: n }, (_, i) => kapak(i + 1000, `Albüm ${i}`, `Sanatçı ${(i + 7) % 30}`, kademe(i))),
  }
}

const sanatci = (s: SecilenOge) => (s.oyun === 'unlu' ? s.oge.nT : s.oge.nA)

describe('gunlukSec', () => {
  it('sıra, kademe bantları ve yedek sayısı', () => {
    const slotlar = gunlukSec(havuzlar(), new Set(), tohumluRastgele('a'))!
    expect(slotlar.map((s) => [s.oyun, s.zorluk])).toEqual(GUNLUK_SIRASI.map((s) => [s.oyun, s.zorluk]))
    for (const s of slotlar) {
      expect(s.adaylar).toHaveLength(4)
      for (const a of s.adaylar) {
        expect(a.oyun).toBe(s.oyun)
        expect(GUNLUK_KADEMELER[s.zorluk]).toContain(a.oge.d)
      }
    }
  })

  it('aynı tohum aynı set', () => {
    const idler = (t: string) => gunlukSec(havuzlar(), new Set(), tohumluRastgele(t))!.map((s) => s.adaylar.map((a) => a.oge.id))
    expect(idler('2026-09-16')).toEqual(idler('2026-09-16'))
    expect(idler('2026-09-16')).not.toEqual(idler('2026-09-17'))
  })

  it('asıllar arasında sanatçı ve kimlik tekrarı yok', () => {
    for (const tohum of ['x', 'y', 'z', 'w']) {
      const slotlar = gunlukSec(havuzlar(), new Set(), tohumluRastgele(tohum))!
      const hepsi = slotlar.flatMap((s) => s.adaylar)
      expect(new Set(hepsi.map((a) => a.oge.id)).size).toBe(hepsi.length)
      const sanatcilar = hepsi.map(sanatci)
      expect(new Set(sanatcilar).size).toBe(sanatcilar.length)
    }
  })

  it('son günlerin öğelerini dışarıda bırakır, havuz yetmezse gevşer', () => {
    const h = havuzlar()
    const haric = new Set(h.sarkilar.filter((s) => s.d <= 2).slice(0, 20).map((s) => s.id))
    const slotlar = gunlukSec(h, haric, tohumluRastgele('b'))!
    for (const a of slotlar[0]!.adaylar) expect(haric.has(a.oge.id)).toBe(false)

    const hepsiHaric = new Set(h.sarkilar.map((s) => s.id))
    expect(gunlukSec(h, hepsiHaric, tohumluRastgele('b'))).not.toBeNull()
  })

  it('bir bant boşsa null', () => {
    const h = havuzlar()
    expect(gunlukSec({ ...h, unluler: h.unluler.filter((u) => u.d <= 2) }, new Set(), tohumluRastgele('c'))).toBeNull()
  })
})
