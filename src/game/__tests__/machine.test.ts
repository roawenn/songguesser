import { describe, it, expect } from 'vitest'
import { STEPS, ATTEMPTS, MAX_STEP, tr } from '../ladder'
import {
  gameReducer,
  canPlay,
  currentClipLength,
  heardLength,
  listenCount,
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

describe('adım tüketimi', () => {
  const track = song()
  const ready: GameState = { s: 'ready', track, ladder, attempt: 0, steps: [] }

  it('bir klibi sonuna kadar dinlemek bir adım tüketir', () => {
    const after = listen(ready)
    expect(after.s).toBe('ready')
    if (after.s === 'ready') {
      expect(after.attempt).toBe(1)
      expect(after.steps).toEqual([{ kind: 'play', text: '', sameArtist: false }])
    }
  })

  it('her dinleme bir sonraki kademeyi açar: 0,5 → 1 → 2', () => {
    let s: GameState = ready
    expect(currentClipLength(s)).toBe(0.5)
    s = listen(s)
    expect(currentClipLength(s)).toBe(1)
    s = listen(s)
    expect(currentClipLength(s)).toBe(2)
  })

  it('yanlış tahmin bir adım tüketir', () => {
    const next = gameReducer(ready, { type: 'WRONG', text: 'holocaust', sameArtist: true })
    expect(next.s).toBe('ready')
    if (next.s === 'ready') {
      expect(next.attempt).toBe(1)
      expect(next.steps).toHaveLength(1)
      expect(next.steps[0]!.kind).toBe('wrong')
      expect(next.steps[0]!.sameArtist).toBe(true)
    }
  })

  it('pas da bir adım tüketir', () => {
    const next = gameReducer(ready, { type: 'SKIP' })
    if (next.s === 'ready') {
      expect(next.attempt).toBe(1)
      expect(next.steps[0]!.kind).toBe('skip')
    }
  })

  it('yanlış tahmin sonrası dinleme bir sonraki kademeyi verir', () => {
    const afterWrong = gameReducer(ready, { type: 'WRONG', text: 'x', sameArtist: false })
    expect(currentClipLength(afterWrong)).toBe(1)
  })
})

describe('tur sonu', () => {
  const track = song()
  const ready: GameState = { s: 'ready', track, ladder, attempt: 0, steps: [] }

  it('beş yanlış tahminden sonra tur kaybedilir', () => {
    let state: GameState = ready
    for (let i = 0; i < ATTEMPTS; i++) {
      state = gameReducer(state, { type: 'WRONG', text: 'x', sameArtist: false })
    }
    expect(state.s).toBe('lost')
  })

  it('TÜM klipleri dinlemek turu BİTİRMEZ — bir tahmin hakkı kalır', () => {
    let s: GameState = ready
    for (let i = 0; i < ATTEMPTS; i++) s = listen(s)
    expect(s.s).toBe('ready')
    if (s.s === 'ready') expect(s.attempt).toBe(ATTEMPTS)
  })

  it('adımlar bitince Çal kapanır', () => {
    let s: GameState = ready
    expect(canPlay(s)).toBe(true)
    for (let i = 0; i < ATTEMPTS; i++) s = listen(s)
    expect(canPlay(s)).toBe(false)
    // Kapalıyken PLAY hiçbir şey değiştirmez.
    expect(gameReducer(s, { type: 'PLAY' })).toBe(s)
  })

  it('tüm klipler dinlendikten sonraki yanlış tahmin turu bitirir', () => {
    let s: GameState = ready
    for (let i = 0; i < ATTEMPTS; i++) s = listen(s)
    const lost = gameReducer(s, { type: 'WRONG', text: 'x', sameArtist: false })
    expect(lost.s).toBe('lost')
  })

  it('tüm klipler dinlendikten sonra da bilinebilir', () => {
    let s: GameState = ready
    for (let i = 0; i < ATTEMPTS; i++) s = listen(s)
    const won = gameReducer(s, { type: 'CORRECT' })
    expect(won.s).toBe('won')
  })

  it('kazandıktan sonra tahminler durumu değiştirmez', () => {
    const won = gameReducer(ready, { type: 'CORRECT' })
    expect(gameReducer(won, { type: 'WRONG', text: 'x', sameArtist: false })).toBe(won)
  })
})

describe('TAKILMA', () => {
  const ready: GameState = { s: 'ready', track: song(), ladder, attempt: 0, steps: [] }

  it('adım TÜKETMEZ — oyuncu ağ hatasıyla hak kaybetmemeli', () => {
    const playing = gameReducer(ready, { type: 'PLAY' })
    expect(playing.s).toBe('playing')
    const stalled = gameReducer(playing, { type: 'CLIP_STALL' })
    expect(stalled.s).toBe('ready')
    if (stalled.s === 'ready') {
      expect(stalled.attempt).toBe(0)
      expect(stalled.steps).toHaveLength(0)
    }
  })

  it('takılmadan sonra aynı kademe tekrar dinlenebilir', () => {
    const stalled = gameReducer(gameReducer(ready, { type: 'PLAY' }), { type: 'CLIP_STALL' })
    expect(currentClipLength(stalled)).toBe(0.5)
    expect(canPlay(stalled)).toBe(true)
  })
})

describe('sonuç özeti', () => {
  it('kaç kez dinlendiğini sayar', () => {
    let s: GameState = { s: 'ready', track: song(), ladder, attempt: 0, steps: [] }
    s = listen(s)
    s = gameReducer(s, { type: 'WRONG', text: 'x', sameArtist: false })
    s = listen(s)
    if (s.s !== 'ready') throw new Error('ready bekleniyordu')
    expect(listenCount(s.steps)).toBe(2)
    // Dinlenen en uzun klip üçüncü kademe: adım 0 (0,5) ve adım 2 (2).
    expect(heardLength(s.steps, ladder)).toBe(2)
  })

  it('hiç dinlemeden bilince duyulan süre sıfır', () => {
    expect(heardLength([], ladder)).toBe(0)
    expect(listenCount([])).toBe(0)
  })
})

describe('klip uzunluğu', () => {
  it('mevcut adımı döndürür', () => {
    const state: GameState = { s: 'ready', track: song(), ladder, attempt: 1, steps: [] }
    expect(currentClipLength(state)).toBe(1)
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
})
