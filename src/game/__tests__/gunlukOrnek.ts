import type { Difficulty } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import type { Song } from '@/data/schema'
import type { Unlu } from '@/data/unlu'
import { normalizeLoose } from '@/text/normalize'
import type { GunlukOge, GunlukOturum, GunlukSet } from '../gunluk'

/** Günlük testlerinin ortak örnek verisi (test dosyası değil — `.test.ts` yok). */

export function sarki(id: number, t: string, a: string, d: Difficulty = 1): Song {
  return {
    id: `itunes:${id}`,
    t,
    a,
    ar: `https://is1-ssl.mzstatic.com/image/thumb/${id}/100x100bb.jpg`,
    p: `https://audio-ssl.itunes.apple.com/itunes-assets/${id}.m4a`,
    u: `https://music.apple.com/tr/album/x/${id}?i=${id}`,
    cs: 30,
    du: 30,
    y: 1999,
    e: '90',
    d,
    c: 'pop',
    nT: normalizeLoose(t),
    nA: normalizeLoose(a),
    k: [normalizeLoose(t)],
  }
}

export function unlu(id: string, ad: string, d: Difficulty = 1): Unlu {
  return { id: `unlu:${id}`, ad, d, c: 'oyuncu', v: 1, nT: normalizeLoose(ad), nA: '', k: [normalizeLoose(ad)] }
}

export function kapak(id: number, al: string, a: string, d: Difficulty = 1): Kapak {
  return {
    id: `kapak:${id}`,
    sid: `itunes:${id}0`,
    al,
    a,
    y: 2001,
    d,
    c: 'pop',
    nT: normalizeLoose(al),
    nA: normalizeLoose(a),
    k: [normalizeLoose(al)],
    ks: [normalizeLoose(a)],
  }
}

export const SARKI_1 = sarki(1, 'Şımarık', 'Tarkan', 1)
export const SARKI_2 = sarki(2, 'Gülpembe', 'Barış Manço', 4)
export const UNLU_1 = unlu('aaaa-1111', 'Kemal Sunal', 1)
export const UNLU_2 = unlu('bbbb-2222', 'Türkan Şoray', 3)
export const KAPAK_1 = kapak(10, 'Ölürüm Sana', 'Tarkan', 2)
export const KAPAK_2 = kapak(20, 'Yalnızlık Senfonisi', 'Sezen Aksu', 5)

export function ogeler(): GunlukOge[] {
  return [
    { oyun: 'sarki', sarki: SARKI_1 },
    { oyun: 'sarki', sarki: SARKI_2 },
    { oyun: 'unlu', unlu: UNLU_1 },
    { oyun: 'unlu', unlu: UNLU_2 },
    { oyun: 'kapak', kapak: KAPAK_1, ar: 'https://is1-ssl.mzstatic.com/image/thumb/k10/100x100bb.jpg', u: 'https://music.apple.com/tr/album/x/10' },
    { oyun: 'kapak', kapak: KAPAK_2, ar: 'https://is1-ssl.mzstatic.com/image/thumb/k20/100x100bb.jpg', u: 'https://music.apple.com/tr/album/x/20' },
  ]
}

export function ornekSet(): GunlukSet {
  const zorluk = ['kolay', 'zor', 'kolay', 'zor', 'kolay', 'zor'] as const
  return {
    gun: '2026-09-16',
    surum: 0,
    slotlar: ogeler().map((oge, i) => ({ oyun: oge.oyun, zorluk: zorluk[i]!, adaylar: [oge], aktif: 0 })),
  }
}

export function yeniOturum(): GunlukOturum {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    gun: '2026-09-16',
    sirali: true,
    bitti: null,
    zamanAsimi: false,
    turlar: [],
    puan: null,
    surum: 0,
    yedekKullanildi: false,
  }
}
