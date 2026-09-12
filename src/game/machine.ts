import type { Song } from '@/data/schema'

/**
 * Bir adımı ne tüketti?
 *
 * - `play`  → klip sonuna kadar dinlendi
 * - `wrong` → yanlış tahmin
 * - `skip`  → pas geçildi
 */
export type StepKind = 'play' | 'wrong' | 'skip'

export interface Step {
  kind: StepKind
  /** Kullanıcının yazdığı ham metin (dinleme ve pasta boş). */
  text: string
  /** Sanatçı doğru ama şarkı yanlış mıydı? */
  sameArtist: boolean
}

export type GameState =
  | { s: 'booting' }
  | { s: 'arming'; track: Song; ladder: number[] }
  | { s: 'ready'; track: Song; ladder: number[]; attempt: number; steps: Step[] }
  | { s: 'playing'; track: Song; ladder: number[]; attempt: number; steps: Step[] }
  | { s: 'won'; track: Song; ladder: number[]; attempt: number; steps: Step[] }
  | { s: 'lost'; track: Song; ladder: number[]; attempt: number; steps: Step[] }
  | { s: 'empty' }
  | { s: 'error'; reason: 'pool' | 'audio' | 'offline' }

export type Action =
  | { type: 'ARM'; track: Song; ladder: number[] }
  | { type: 'ARM_OK' }
  | { type: 'ARM_FAIL'; reason: 'pool' | 'audio' | 'offline' }
  | { type: 'PLAY' }
  /** Klip sonuna kadar çalındı — BİR ADIM TÜKETİR. */
  | { type: 'CLIP_END' }
  /** ⚠️ Takılma ASLA bir adıma mal olmaz. */
  | { type: 'CLIP_STALL' }
  | { type: 'WRONG'; text: string; sameArtist: boolean }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  | { type: 'EMPTY_POOL' }

/** Oyuncunun kaç adımı var? Merdivenin kademe sayısı kadar. */
export function attemptsFor(ladder: number[]): number {
  return ladder.length
}

/** Şu an çalınacak klip uzunluğu. Adımlar bittiyse 0. */
export function currentClipLength(state: GameState): number {
  if (state.s !== 'ready' && state.s !== 'playing') return 0
  return state.ladder[Math.min(state.attempt, state.ladder.length - 1)]!
}

/**
 * Çal düğmesi basılabilir mi?
 *
 * Her dinleme bir adım tüketir, dolayısıyla adımlar bitince dinleme de biter.
 * Tur o noktada kaybedilmez — oyuncunun bir tahmin hakkı daha kalır.
 */
export function canPlay(state: GameState): state is Extract<GameState, { s: 'ready' }> {
  return state.s === 'ready' && state.attempt < state.ladder.length
}

/** Kaç kez dinlendi? Sonuç kartındaki "N kez dinledin" için. */
export function listenCount(steps: Step[]): number {
  return steps.reduce((n, s) => n + (s.kind === 'play' ? 1 : 0), 0)
}

/** En uzun duyulan klip (sn). Hiç dinlenmediyse 0. */
export function heardLength(steps: Step[], ladder: number[]): number {
  let max = 0
  steps.forEach((s, i) => {
    if (s.kind === 'play') max = Math.max(max, ladder[i] ?? 0)
  })
  return max
}

/** Yanlış tahmin ve pas için: adımı tüket, son adımsa turu bitir. */
function advance(
  track: Song,
  ladder: number[],
  attempt: number,
  steps: Step[],
): GameState {
  if (attempt + 1 >= ladder.length) {
    return { s: 'lost', track, ladder, attempt: attempt + 1, steps }
  }
  return { s: 'ready', track, ladder, attempt: attempt + 1, steps }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ARM':
      return { s: 'arming', track: action.track, ladder: action.ladder }

    case 'ARM_OK':
      if (state.s !== 'arming') return state
      return { s: 'ready', track: state.track, ladder: state.ladder, attempt: 0, steps: [] }

    case 'ARM_FAIL':
      return { s: 'error', reason: action.reason }

    case 'EMPTY_POOL':
      return { s: 'empty' }

    case 'PLAY':
      if (!canPlay(state)) return state
      return { ...state, s: 'playing' }

    case 'CLIP_END': {
      if (state.s !== 'playing') return state
      const steps = [...state.steps, { kind: 'play' as const, text: '', sameArtist: false }]
      // ⚠️ Dinlemek turu BİTİRMEZ. Son adım da tükense oyuncunun bir tahmin
      // hakkı kalır; tur yalnızca yanlış tahmin ya da pas ile kaybedilir.
      return {
        s: 'ready',
        track: state.track,
        ladder: state.ladder,
        attempt: state.attempt + 1,
        steps,
      }
    }

    case 'CLIP_STALL':
      // Adım sayacı DEĞİŞMEZ. Oyuncu ağ hatası yüzünden hak kaybetmemeli.
      if (state.s !== 'playing') return state
      return { ...state, s: 'ready' }

    case 'CORRECT':
      if (state.s !== 'ready' && state.s !== 'playing') return state
      return {
        s: 'won',
        track: state.track,
        ladder: state.ladder,
        attempt: state.attempt,
        steps: state.steps,
      }

    case 'WRONG': {
      if (state.s !== 'ready' && state.s !== 'playing') return state
      const steps = [
        ...state.steps,
        { kind: 'wrong' as const, text: action.text, sameArtist: action.sameArtist },
      ]
      return advance(state.track, state.ladder, state.attempt, steps)
    }

    case 'SKIP': {
      if (state.s !== 'ready' && state.s !== 'playing') return state
      const steps = [...state.steps, { kind: 'skip' as const, text: '', sameArtist: false }]
      return advance(state.track, state.ladder, state.attempt, steps)
    }

    default:
      return state
  }
}
