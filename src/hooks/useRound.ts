'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { installResumeHandlers } from '@/audio/context'
import { loadChip } from '@/data/loadPool'
import type { Song } from '@/data/schema'
import { MIN_PLAYABLE } from '@/data/categories'
import { gameReducer, canPlay, currentClipLength, type GameState } from '@/game/machine'
import { STEPS } from '@/game/ladder'
import { pickNext, filterByTier } from '@/game/select'
import { judgeGuess, type Verdict } from '@/text/match'
import { buildIndex } from '@/text/autocomplete'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * Ölü preview URL'inde art arda en fazla kaç şarkı denenir.
 *
 * ⚠️ Sınır ZORUNLU. `pickNext` havuz tükenince çalınanlar kümesini sıfırlar,
 * yani "hepsini denedim" durumu asla oluşmaz; sınırsız özyineleme Apple CDN'e
 * erişilemeyen bir ağda sekmeyi kilitler.
 */
const DEAD_URL_LIMIT = 6

export interface RoundApi {
  state: GameState
  pool: Song[]
  /** Zorluk süzgecinden geçmiş, oynanan havuz. */
  filtered: Song[]
  /** Bu zorlukta oynanacak kadar şarkı yok. */
  tooNarrow: boolean
  index: ReturnType<typeof buildIndex> | null
  clipLength: number
  /** Çal basılabilir mi? Tur sürdüğü sürece evet — dinlemek bedava. */
  canPlay: boolean
  loading: boolean
  /** Son tahmin belirsizse adaylar burada — hak tüketilmedi. */
  ambiguous: Song[] | null
  stalled: boolean
  /** Etiketteki kayıt numarası, örn. "NK-014". */
  tapeCode: string

  play: () => void
  guess: (raw: string) => Verdict
  guessSong: (song: Song) => void
  skip: () => void
  /** Aynı seçkide başka bir şarkıya geç — bedava, hak tüketmez. */
  reroll: () => void
  next: () => void
  clearAmbiguity: () => void
  /** Yanlış tahminde kaseti sarsmak için kayıt olunur. */
  onWrong: (fn: () => void) => void
}

export function useRound(): RoundApi {
  const { category, tier, easySearch, volume, setTier } = useSettingsStore()

  const [state, dispatch] = useReducer(gameReducer, { s: 'booting' } as GameState)
  const [pool, setPool] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [ambiguous, setAmbiguous] = useState<Song[] | null>(null)
  const [stalled, setStalled] = useState(false)
  const played = useRef(new Set<string>())
  const wrongHandler = useRef<(() => void) | null>(null)
  /** Sıradaki tur için önceden seçilip sesi önyüklenmiş şarkı. */
  const nextUp = useRef<Song | null>(null)

  useEffect(() => installResumeHandlers(), [])
  useEffect(() => clipPlayer.setVolume(volume), [volume])

  // --- havuz ---
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadChip(category)
      .then((songs) => {
        if (cancelled) return
        played.current = new Set()
        nextUp.current = null
        setPool(songs)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          dispatch({ type: 'ARM_FAIL', reason: 'pool' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [category])

  // Zorluk kademesi havuzu süzer; küratörlük inceyse komşu kademeler eklenir.
  const filtered = useMemo(() => filterByTier(pool, tier), [pool, tier])

  // Öneri listesi ve belirsizlik koruması yalnızca oynanabilir havuzu görmeli.
  const index = useMemo(
    () => (filtered.length > 0 ? buildIndex(filtered) : null),
    [filtered],
  )

  const tooNarrow = !loading && pool.length > 0 && filtered.length < MIN_PLAYABLE

  const ladder = useMemo(() => [...STEPS], [])

  // --- tur başlatma ---
  const startRound = useCallback(async (songs: Song[], rungs: number[], tried = 0) => {
    if (tried >= DEAD_URL_LIMIT) {
      dispatch({ type: 'ARM_FAIL', reason: 'offline' })
      return
    }
    // Önceki turda seçilip sesi boştaki şeride yüklenmiş aday varsa onu kullan.
    // Seçki ya da kademe değiştiyse aday artık geçerli değildir.
    let song = nextUp.current
    nextUp.current = null
    if (!song || !songs.some((s) => s.id === song!.id)) {
      const pick = pickNext(songs, played.current)
      if (!pick) {
        dispatch({ type: 'EMPTY_POOL' })
        return
      }
      if (pick.recycled) played.current = new Set()
      song = pick.song
    }
    played.current.add(song.id)

    setAmbiguous(null)
    setStalled(false)
    dispatch({ type: 'ARM', track: song, ladder: rungs })

    const result = await clipPlayer.arm({
      id: song.id,
      url: song.p,
      clipStart: song.cs,
      duration: song.du,
    })

    if (result === 'ready') {
      dispatch({ type: 'ARM_OK' })

      /*
       * Sıradaki şarkıyı şimdiden seç ve boştaki şeride önyükle — iki şeritli
       * deck'in bütün amacı buydu ama `prefetch` hiç çağrılmıyordu. Oyuncu tahmin
       * ederken indirme bitiyor, "Sıradaki şarkı"da bekleme kalmıyor.
       *
       * `recycled` adayı atlanır: havuz tükenmişse `played` sıfırlanacak demektir,
       * bu kararı tur gerçekten başlarken vermek gerekir.
       */
      const upcoming = pickNext(songs, played.current)
      if (upcoming && !upcoming.recycled) {
        nextUp.current = upcoming.song
        clipPlayer.prefetch({
          id: upcoming.song.id,
          url: upcoming.song.p,
          clipStart: upcoming.song.cs,
          duration: upcoming.song.du,
        })
      }
    } else if (result === 'dead-url') {
      // Ölü URL: bu şarkıyı atla, oyuncuya hiç göstermeden sonrakine geç.
      void startRound(songs, rungs, tried + 1)
    } else {
      dispatch({ type: 'ARM_FAIL', reason: result === 'unsupported' ? 'audio' : 'offline' })
    }
  }, [])

  useEffect(() => {
    if (loading || filtered.length === 0) return
    void startRound(filtered, ladder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, ladder, loading])

  const clipLength = currentClipLength(state)

  const play = useCallback(() => {
    if (!canPlay(state)) return
    // ⚠️ Gesture içinden senkron: iOS kilidi burada açılır.
    clipPlayer.unlockFromGesture()
    const len = currentClipLength(state)
    dispatch({ type: 'PLAY' })
    setStalled(false)
    void clipPlayer.play(len).then((result) => {
      if (result === 'stalled') {
        // Takılma kademe TÜKETMEZ.
        setStalled(true)
        dispatch({ type: 'CLIP_STALL' })
      } else {
        dispatch({ type: 'CLIP_END' })
      }
    })
  }, [state])

  const markWrong = useCallback((text: string, sameArtist: boolean) => {
    dispatch({ type: 'WRONG', text, sameArtist })
    setAmbiguous(null)
    wrongHandler.current?.()
  }, [])

  const guess = useCallback(
    (raw: string): Verdict => {
      if (state.s !== 'ready' && state.s !== 'playing') return { kind: 'empty' }

      const verdict = judgeGuess(raw, state.track, filtered, { easySearch })

      if (verdict.kind === 'correct') {
        clipPlayer.stop()
        dispatch({ type: 'CORRECT' })
        setAmbiguous(null)
      } else if (verdict.kind === 'ambiguous') {
        // Hak TÜKETİLMEZ — kullanıcı hangisini kastettiğini seçsin.
        setAmbiguous(verdict.candidates)
      } else if (verdict.kind === 'wrong') {
        markWrong(raw, verdict.sameArtist)
      }
      return verdict
    },
    [state, filtered, easySearch, markWrong],
  )

  /** Kolay modu: şıktan seçim. Metin eşleştirmesine gerek yok, id yeter. */
  const guessSong = useCallback(
    (song: Song) => {
      if (state.s !== 'ready' && state.s !== 'playing') return
      if (song.id === state.track.id) {
        clipPlayer.stop()
        dispatch({ type: 'CORRECT' })
        setAmbiguous(null)
      } else {
        markWrong(song.t, song.nA === state.track.nA)
      }
    },
    [state, markWrong],
  )

  const skip = useCallback(() => {
    if (state.s !== 'ready' && state.s !== 'playing') return
    clipPlayer.stop()
    dispatch({ type: 'SKIP' })
    setAmbiguous(null)
  }, [state])

  /**
   * Şarkıyı değiştir: aynı seçki, aynı zorluk, yeni parça.
   *
   * Pas geçmekten farkı bedava olması — tur kaybedilmez, kademe tüketilmez.
   * Tanımadığı bir şarkıyı beş hak boyunca zorlamak yerine oyuncu turu
   * tamamen bırakabilsin diye var.
   */
  const reroll = useCallback(() => {
    // iOS: önyükleme bir gesture içinde başlamalı — bu tıklama o gesture.
    clipPlayer.unlockFromGesture()
    clipPlayer.stop()
    clipPlayer.swapLanes()
    void startRound(filtered, ladder)
  }, [filtered, ladder, startRound])

  const next = useCallback(() => {
    // iOS: önyükleme bir gesture içinde başlamalı — "Sıradaki" tıklaması bu.
    clipPlayer.unlockFromGesture()
    clipPlayer.swapLanes()

    // Bildiyse bir üst kademeye çık; İmkansız'da (5) tavan.
    const climbed = state.s === 'won' ? Math.min(5, tier + 1) : tier
    if (climbed !== tier) {
      // Kademe değişince `filtered` yenilenir ve turu o etki başlatır;
      // burada ayrıca startRound çağırmak turu iki kez kurardı.
      setTier(climbed as typeof tier)
      return
    }
    void startRound(filtered, ladder)
  }, [state, tier, setTier, filtered, ladder, startRound])

  const clearAmbiguity = useCallback(() => setAmbiguous(null), [])
  const onWrong = useCallback((fn: () => void) => {
    wrongHandler.current = fn
  }, [])

  const tapeCode = useMemo(() => {
    if (state.s === 'booting' || state.s === 'empty' || state.s === 'error') return 'NK-000'
    const i = pool.findIndex((s) => s.id === state.track.id)
    return `NK-${String(i + 1).padStart(3, '0')}`
  }, [state, pool])

  return {
    state, pool, filtered, tooNarrow, index, clipLength, loading, ambiguous, stalled, tapeCode,
    canPlay: canPlay(state),
    play, guess, guessSong, skip, reroll, next, clearAmbiguity, onWrong,
  }
}
