import { describe, it, expect } from 'vitest'
import { STEPS, ATTEMPTS, MAX_STEP, tr } from '../ladder'
import {
  gameReducer,
  canPlay,
  currentClipLength,
  heardLength,
  type GameState,
} from '../machine'
import { pickNext, filterByTier } from '../select'
import { previewIsLongEnough, MIN_CLIP_START } from '@/audio/envelope'
import type { Song } from '@/data/schema'

function song(over: Partial<Song> = {}): Song {
  return {
    id: 'itunes:1', t: 'Suspus', a: 'Ceza', ar: '', p: '', cs: 0.325, du: 29,
    y: 2004, e: '00', d: 1, c: 'rap', u: '', nT: 'suspus', nA: 'ceza',
    k: ['suspus'], ...over,
  }
}

const ladder = [...STEPS]

function ready(over: Partial<Extract<GameState, { s: 'ready' }>> = {}): GameState {
  return {
    s: 'ready',
    track: song(),
    ladder,
    attempt: 0,
    steps: [],
    listens: 0,
    heardIndex: -1,
    ...over,
  }
}

/** Bir klibi sonuna kadar dinlemek: PLAY + CLIP_END. */
function listen(state: GameState): GameState {
  return gameReducer(gameReducer(state, { type: 'PLAY' }), { type: 'CLIP_END' })
}

describe('merdiven', () => {
  it('tasarımın sabit kademeleri', () => {
    expect(ladder).toEqual([0.5, 1, 2, 5, 10])
    expect(ATTEMPTS).toBe(5)
  })

  it('her kademe bir öncekinden uzun', () => {
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!)
    }
  })

  it('en uzun kademe 29 sn preview içine sığar', () => {
    // Zarf, klip başlangıcından önce pre-roll ve sonunda fade+tail ister.
    expect(previewIsLongEnough(29, MIN_CLIP_START, MAX_STEP)).toBe(true)
  })

  it('Türkçe ondalık ayırıcı virgül', () => {
    expect(tr(0.5)).toBe('0,5')
    expect(tr(10)).toBe('10')
  })
})

describe('dinlemek', () => {
  /**
   * ⚠️ Oyunun temel kuralı: DİNLEMEK BEDAVADIR. Klip yalnızca yanlış tahmin ya
   * da pas ile uzar; oyuncu bulunduğu kademeyi istediği kadar tekrar dinler.
   */
  it('kademeyi İLERLETMEZ', () => {
    const after = listen(ready())
    expect(after.s).toBe('ready')
    if (after.s === 'ready') {
      expect(after.attempt).toBe(0)
      expect(after.steps).toHaveLength(0)
      expect(currentClipLength(after)).toBe(0.5)
    }
  })

  it('yalnızca dinleme sayacını artırır', () => {
    let s = ready()
    for (let i = 0; i < 4; i++) s = listen(s)
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(s.listens).toBe(4)
    expect(s.attempt).toBe(0)
    // Dört kez dinlese de hâlâ ilk kademede: 0,5 saniye.
    expect(currentClipLength(s)).toBe(0.5)
  })

  it('aynı kademe sınırsız tekrar dinlenebilir', () => {
    let s = ready()
    for (let i = 0; i < 20; i++) {
      expect(canPlay(s)).toBe(true)
      s = listen(s)
    }
    expect(s.s).toBe('ready')
  })

  it('duyulan en yüksek kademeyi kaydeder', () => {
    let s = listen(ready())
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(heardLength(s.heardIndex, ladder)).toBe(0.5)

    s = gameReducer(s, { type: 'SKIP' })
    s = listen(s)
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(heardLength(s.heardIndex, ladder)).toBe(1)
  })

  it('geri dönüp kısa dinlemek duyulan en uzunu düşürmez', () => {
    // heardIndex bir MAKSİMUMDUR; kademe geri gitmez ama kural yine de açık olsun.
    let s = ready({ attempt: 3, heardIndex: 3 })
    s = gameReducer(s, { type: 'PLAY' })
    s = gameReducer(s, { type: 'CLIP_END' })
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(s.heardIndex).toBe(3)
  })

  it('hiç dinlemeden bilince duyulan süre sıfır', () => {
    expect(heardLength(-1, ladder)).toBe(0)
  })
})

describe('kademe tüketimi', () => {
  it('pas klibi uzatır: 0,5 → 1 → 2', () => {
    let s = ready()
    expect(currentClipLength(s)).toBe(0.5)
    s = gameReducer(s, { type: 'SKIP' })
    expect(currentClipLength(s)).toBe(1)
    s = gameReducer(s, { type: 'SKIP' })
    expect(currentClipLength(s)).toBe(2)
  })

  it('yanlış tahmin de klibi uzatır ve metni saklar', () => {
    const next = gameReducer(ready(), { type: 'WRONG', text: 'holocaust', sameArtist: true })
    expect(next.s).toBe('ready')
    if (next.s === 'ready') {
      expect(next.attempt).toBe(1)
      expect(next.steps).toHaveLength(1)
      expect(next.steps[0]!.kind).toBe('wrong')
      expect(next.steps[0]!.text).toBe('holocaust')
      expect(next.steps[0]!.sameArtist).toBe(true)
      expect(currentClipLength(next)).toBe(1)
    }
  })

  it('dinleme sayacı kademe ilerlerken korunur', () => {
    let s = listen(listen(ready()))
    s = gameReducer(s, { type: 'SKIP' })
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(s.listens).toBe(2)
    expect(s.attempt).toBe(1)
  })
})

describe('tur sonu', () => {
  it('beş yanlış tahminden sonra tur kaybedilir', () => {
    let state: GameState = ready()
    for (let i = 0; i < ATTEMPTS; i++) {
      state = gameReducer(state, { type: 'WRONG', text: 'x', sameArtist: false })
    }
    expect(state.s).toBe('lost')
  })

  it('beş pastan sonra da kaybedilir', () => {
    let state: GameState = ready()
    for (let i = 0; i < ATTEMPTS; i++) state = gameReducer(state, { type: 'SKIP' })
    expect(state.s).toBe('lost')
  })

  it('kaybedilen tur sayaçları korur — sonuç kartı onları gösterir', () => {
    let s: GameState = listen(listen(ready()))
    for (let i = 0; i < ATTEMPTS; i++) s = gameReducer(s, { type: 'SKIP' })
    expect(s.s).toBe('lost')
    if (s.s === 'lost') {
      expect(s.listens).toBe(2)
      expect(s.steps).toHaveLength(ATTEMPTS)
    }
  })

  it('doğru tahmin kazandırır ve duyulan süreyi korur', () => {
    const s = listen(ready())
    const won = gameReducer(s, { type: 'CORRECT' })
    expect(won.s).toBe('won')
    if (won.s === 'won') {
      expect(won.listens).toBe(1)
      expect(heardLength(won.heardIndex, ladder)).toBe(0.5)
    }
  })

  it('kazandıktan sonra tahminler durumu değiştirmez', () => {
    const won = gameReducer(ready(), { type: 'CORRECT' })
    expect(gameReducer(won, { type: 'WRONG', text: 'x', sameArtist: false })).toBe(won)
    expect(gameReducer(won, { type: 'PLAY' })).toBe(won)
  })
})

describe('TAKILMA', () => {
  it('hiçbir sayacı artırmaz — oyuncu ağ hatasıyla hak kaybetmemeli', () => {
    const playing = gameReducer(ready(), { type: 'PLAY' })
    expect(playing.s).toBe('playing')
    const stalled = gameReducer(playing, { type: 'CLIP_STALL' })
    expect(stalled.s).toBe('ready')
    if (stalled.s === 'ready') {
      expect(stalled.attempt).toBe(0)
      expect(stalled.listens).toBe(0)
      expect(stalled.heardIndex).toBe(-1)
      expect(stalled.steps).toHaveLength(0)
    }
  })

  it('takılmadan sonra aynı kademe tekrar dinlenebilir', () => {
    const stalled = gameReducer(gameReducer(ready(), { type: 'PLAY' }), { type: 'CLIP_STALL' })
    expect(currentClipLength(stalled)).toBe(0.5)
    expect(canPlay(stalled)).toBe(true)
  })
})

describe('klip uzunluğu', () => {
  it('mevcut kademeyi döndürür', () => {
    expect(currentClipLength(ready({ attempt: 1 }))).toBe(1)
  })

  it('tur dışında sıfır', () => {
    expect(currentClipLength({ s: 'booting' })).toBe(0)
  })
})

describe('pickNext', () => {
  const pool = [song({ id: 'a' }), song({ id: 'b' })]

  it('çalınmış şarkıyı tekrar vermez', () => {
    const pick = pickNext(pool, new Set(['a']), () => 0)
    expect(pick?.song.id).toBe('b')
    expect(pick?.recycled).toBe(false)
  })

  it('havuz tükenince döngüyü yeniden başlatır', () => {
    const pick = pickNext(pool, new Set(['a', 'b']), () => 0)
    expect(pick?.recycled).toBe(true)
    expect(pick?.song.id).toBe('a')
  })

  it('boş havuzda null', () => {
    expect(pickNext([], new Set())).toBeNull()
  })
})

describe('filterByTier — zorluk süzgeci', () => {
  const pool = [
    song({ id: 'a', d: 1 }), song({ id: 'b', d: 1 }),
    song({ id: 'c', d: 3 }), song({ id: 'd', d: 3 }),
    song({ id: 'e', d: 5 }),
  ]

  it('yeterli şarkı varsa yalnızca o kademeyi verir', () => {
    const wide = Array.from({ length: 10 }, (_, i) => song({ id: 'x' + i, d: 3 }))
    const out = filterByTier([...pool, ...wide], 3)
    expect(out.every((s) => s.d === 3)).toBe(true)
    expect(out.length).toBeGreaterThanOrEqual(8)
  })

  it('kademe inceyse komşu kademeleri ekler', () => {
    const out = filterByTier(pool, 5)
    expect(out.length).toBeGreaterThan(1)
    expect(out.some((s) => s.d === 5)).toBe(true)
  })

  it('havuz tamamen küçükse hepsini verir, sonsuz döngüye girmez', () => {
    const out = filterByTier(pool, 1)
    expect(out.length).toBe(pool.length)
  })

  it('boş havuzda boş döner', () => {
    expect(filterByTier([], 3)).toEqual([])
  })

  /**
   * ⚠️ Genişletme KADEMELİ olmalı.
   *
   * Döngüde fazladan bir `hi++` vardı ve koşulu bayat `out`u okuduğu için
   * `[1,2]` penceresi hiç denenmeden `[1,3]`e atlanıyordu: "Kolay" seçen
   * oyuncuya, yeterli kolay+orta şarkı olmasına rağmen "Zor" karışıyordu.
   */
  it('bir kademe genişletmek yetiyorsa orada durur', () => {
    const ince = [
      ...Array.from({ length: 5 }, (_, i) => song({ id: 'k' + i, d: 1 })),
      ...Array.from({ length: 50 }, (_, i) => song({ id: 'o' + i, d: 2 })),
      ...Array.from({ length: 50 }, (_, i) => song({ id: 'z' + i, d: 3 })),
    ]
    const out = filterByTier(ince, 1)
    expect(out.length).toBe(55)
    expect(out.some((s) => s.d === 3)).toBe(false)
  })

  it('aşağı genişletme de tek adım', () => {
    const ince = [
      ...Array.from({ length: 50 }, (_, i) => song({ id: 'a' + i, d: 2 })),
      ...Array.from({ length: 3 }, (_, i) => song({ id: 'b' + i, d: 3 })),
    ]
    const out = filterByTier(ince, 3)
    expect(out.length).toBe(53)
    expect(out.some((s) => s.d === 1)).toBe(false)
  })
})
