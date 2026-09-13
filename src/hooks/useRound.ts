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

/**
 * Düello kipi: tur sırası dışarıdan sürülür.
 *
 * Düelloda iki oyuncu AYNI beş şarkıyı aynı sırayla oynar; hangi şarkının ne
 * zaman kurulacağına `useRound` değil, düello sayfası karar verir. Havuz
 * yüklemesi, otomatik tamamlama ve ses motoru aynen paylaşılır — tur mantığını
 * ikinci kez yazmak, burada tek tek kazanılmış incelikleri (yarış koruması,
 * takılma, prefetch) da ikinci kez kazanmak demek olurdu.
 */
export interface DizilimOpts {
  /** Sırayla oynanacak sabit şarkılar. */
  sequence: Song[]
  /** Şu an kaçıncı şarkıdayız. */
  index: number
}

export function useRound(dizilim?: DizilimOpts): RoundApi {
  /*
   * ⚠️ Alan alan abone olunuyor. Seçicisiz `useSettingsStore()` bütün depoya
   * abone olur; "Azaltılmış animasyon" anahtarına dokunmak bile tur kancasını
   * ve altındaki her şeyi yeniden çizdiriyordu — oysa `reduce` burada hiç
   * kullanılmıyor.
   */
  const category = useSettingsStore((s) => s.category)
  const tier = useSettingsStore((s) => s.tier)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const volume = useSettingsStore((s) => s.volume)
  const setTier = useSettingsStore((s) => s.setTier)

  const sequence = dizilim?.sequence
  const seqIndex = dizilim?.index ?? 0
  const forcedSong = sequence?.[seqIndex] ?? null

  const [state, dispatch] = useReducer(gameReducer, { s: 'booting' } as GameState)
  const [pool, setPool] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [ambiguous, setAmbiguous] = useState<Song[] | null>(null)
  const [stalled, setStalled] = useState(false)
  const played = useRef(new Set<string>())
  const wrongHandler = useRef<(() => void) | null>(null)
  /** Sıradaki tur için önceden seçilip sesi önyüklenmiş şarkı. */
  const nextUp = useRef<Song | null>(null)
  /**
   * ⚠️ `startRound` bağımlılıksız bir `useCallback`; kimlik değişirse tur
   * başlatma etkisi yeniden tetiklenir ve tur iki kez kurulur. Dizilim bu
   * yüzden prop olarak değil ref üzerinden okunuyor.
   */
  const sequenceRef = useRef<Song[] | undefined>(undefined)
  const seqIndexRef = useRef(0)
  sequenceRef.current = sequence
  seqIndexRef.current = seqIndex
  /**
   * Geçerli tur kurulumunun sıra numarası.
   *
   * ⚠️ `clipPlayer.arm()` yeni bir çağrı gelince öncekini İPTAL EDER ve iptal
   * edilen çağrı `'stalled'` döner — ağ takılmasıyla aynı değer. Bu sayaç
   * olmadan geçersiz kalmış eski kurulum `ARM_FAIL` gönderip başarılı olan
   * yeni turu hata ekranına çeviriyordu. İki kurulumun üst üste binmesi
   * sanıldığından sık: StrictMode efektleri iki kez çalıştırıyor, seçki ve
   * kademe değişimleri de arka arkaya tetikleyebiliyor.
   */
  const roundToken = useRef(0)

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

  /**
   * Metin eşleştirmenin gördüğü havuz.
   *
   * ⚠️ Düelloda `filtered`'ın YANINA dizilimin tamamı eklenir. Düello şarkıları
   * kademe 1'den 5'e yayılıyor, oyuncunun kendi kademesi ise tek bir değer;
   * eklenmezse `buildIndex` cevabı içermez ve "Kolay arama" açık bir oyuncu
   * doğru şarkıyı öneri listesinden ASLA seçemez — tur oynanamaz hâle gelir.
   * `judgeGuess`'in rakip havuzu da aynı sebeple bunu görmeli.
   */
  const universe = useMemo(() => {
    if (!sequence || sequence.length === 0) return filtered
    const varOlan = new Set(filtered.map((s) => s.id))
    const eksik = sequence.filter((s) => !varOlan.has(s.id))
    return eksik.length > 0 ? [...filtered, ...eksik] : filtered
  }, [filtered, sequence])

  // Öneri listesi ve belirsizlik koruması yalnızca oynanabilir havuzu görmeli.
  const index = useMemo(
    () => (universe.length > 0 ? buildIndex(universe) : null),
    [universe],
  )

  /**
   * ⚠️ Düelloda bastırılır. `GameShell` bu ekranı sonuç panelinden ÖNCE
   * kontrol ediyor; ince bir kademe düelloyu hiç başlatmadan kilitlerdi.
   */
  const tooNarrow =
    !sequence && !loading && pool.length > 0 && filtered.length < MIN_PLAYABLE

  const ladder = useMemo(() => [...STEPS], [])

  // --- tur başlatma ---
  const startRound = useCallback(
    async (songs: Song[], rungs: number[], tried = 0, forced?: Song) => {
      const token = ++roundToken.current
      if (tried >= DEAD_URL_LIMIT) {
        dispatch({ type: 'ARM_FAIL', reason: 'offline' })
        return
      }
      /**
       * `forced` verilirse şarkı sabittir; `pickNext` atlanır — düello bunu
       * kullanıyor.
       *
       * ⚠️ `nextUp` TÜKETİLMEZ: `arm()` etkin şeride, `prefetch()` boştaki
       * şeride yazıyor. Sabit şarkı etkin şeride kurulurken boştaki adayın sesi
       * sağlam kalır ve sonraki turda `swapLanes()` onu devralır — iki
       * şeritli deck'in avantajı korunur.
       */
      let song = forced ?? null
      if (!song) {
        // Önceki turda seçilip sesi boştaki şeride yüklenmiş aday varsa onu kullan.
        // Seçki ya da kademe değiştiyse aday artık geçerli değildir.
        song = nextUp.current
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

      // ⚠️ Bu arada yeni bir tur kurulduysa bu çağrı geçersizdir: sonucu
      // YUTULUR. Aksi hâlde iptal edilmiş kurulum yeni turun üstüne yazar.
      if (token !== roundToken.current) return

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
        // Düelloda sıradaki şarkı zaten belli; rastgele seçmenin anlamı yok.
        const upcoming = forced
          ? (sequenceRef.current?.[seqIndexRef.current + 1] ?? null)
          : (() => {
              const p = pickNext(songs, played.current)
              return p && !p.recycled ? p.song : null
            })()
        if (upcoming) {
          nextUp.current = upcoming
          clipPlayer.prefetch({
            id: upcoming.id,
            url: upcoming.p,
            clipStart: upcoming.cs,
            duration: upcoming.du,
          })
        }
      } else if (result === 'dead-url') {
        /**
         * ⚠️ Özyineleme `forced`'ı TAŞIMAZ: sabitlenen şarkı çalınamıyorsa aynı
         * ölü URL'i `DEAD_URL_LIMIT` kez denemenin anlamı yok. Sabit şarkıyla
         * oynatan modlar (düello) sonucu görüp kendi kararını verir.
         */
        if (forced) {
          dispatch({ type: 'ARM_FAIL', reason: 'offline' })
          return
        }
        // Ölü URL: bu şarkıyı atla, oyuncuya hiç göstermeden sonrakine geç.
        void startRound(songs, rungs, tried + 1)
      } else {
        dispatch({ type: 'ARM_FAIL', reason: result === 'unsupported' ? 'audio' : 'offline' })
      }
    },
    [],
  )

  useEffect(() => {
    if (loading) return
    if (sequence) {
      // Düello: sıradaki sabit şarkıyı kur. Havuz yalnızca otomatik tamamlama
      // için lazım, bu yüzden `filtered` boş olsa bile devam edilir.
      if (!forcedSong) return
      void startRound(universe, ladder, 0, forcedSong)
      return
    }
    if (filtered.length === 0) return
    void startRound(filtered, ladder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, ladder, loading, sequence, seqIndex, forcedSong])

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

      const verdict = judgeGuess(raw, state.track, universe, { easySearch })

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
    [state, universe, easySearch, markWrong],
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

    /**
     * ⚠️ Düelloda `next()` tur KURMAZ ve kademe YÜKSELTMEZ.
     *
     * Sırayı düello sayfası sürüyor (`index` artınca etki turu kurar); burada
     * ayrıca `startRound` çağırmak turu iki kez kurardı. Kademe de oyuncunun
     * kendi seçimi değil, düellonun rampası — kalıcı ayarına yazılmamalı.
     */
    if (sequence) return

    // Bildiyse bir üst kademeye çık; İmkansız'da (5) tavan.
    const climbed = state.s === 'won' ? Math.min(5, tier + 1) : tier
    if (climbed !== tier) {
      // Kademe değişince `filtered` yenilenir ve turu o etki başlatır;
      // burada ayrıca startRound çağırmak turu iki kez kurardı.
      setTier(climbed as typeof tier)
      return
    }
    void startRound(filtered, ladder)
  }, [state, tier, setTier, filtered, ladder, startRound, sequence])

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
