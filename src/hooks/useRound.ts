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
  /** Bu tur bir arkadaşın meydan okuması mı? */
  isChallenge: boolean
  /** Meydan okumanın akıbeti — arıza hâlinde oyuncuya ne söyleneceğini belirler. */
  challengeStatus: ChallengeStatus

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
 * Meydan okumanın akıbeti.
 *
 * ⚠️ Ortak kural: meydan okuma HİÇBİR ZAMAN oyunu durdurmaz. Her arıza yolu
 * "bir açıklama + normal tur" ile biter; `state.s === 'error'` ekranına asla
 * düşülmez. Arkadaşının bozuk linki oyuncunun oyununu bozmamalı.
 */
export type ChallengeStatus =
  | 'yok'
  | 'cozuluyor'
  | 'hazir'
  | 'bulunamadi'
  | 'calinamadi'

export function useRound(opts: { challengeSongId?: string } = {}): RoundApi {
  const { challengeSongId } = opts
  const { category, tier, easySearch, volume, setTier } = useSettingsStore()

  const [challengeSong, setChallengeSong] = useState<Song | null>(null)
  const [challengeStatus, setChallengeStatus] = useState<ChallengeStatus>(
    challengeSongId ? 'cozuluyor' : 'yok',
  )

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
   * ⚠️ `filtered`'ın YERİNE geçmez, yanına eklenir — tur başlatma etkisi
   * `filtered`'a bağlı kalsın diye. Meydan okunan şarkı alıcının kademesinde
   * olmayabilir; o zaman `buildIndex` cevabı içermez ve "Kolay arama" açık bir
   * oyuncu doğru şarkıyı öneri listesinden ASLA seçemez — tur oynanamaz hâle
   * gelir. Aynı şekilde `judgeGuess`'in rakip havuzu da cevabı görmeli.
   */
  const universe = useMemo(
    () =>
      challengeSong && !filtered.some((s) => s.id === challengeSong.id)
        ? [...filtered, challengeSong]
        : filtered,
    [filtered, challengeSong],
  )

  // Öneri listesi ve belirsizlik koruması yalnızca oynanabilir havuzu görmeli.
  const index = useMemo(
    () => (universe.length > 0 ? buildIndex(universe) : null),
    [universe],
  )

  /**
   * ⚠️ Meydan okumada bastırılır. `GameShell` bu ekranı `ResultPanel`'den ÖNCE
   * kontrol ediyor; ince bir kademeye gelen meydan okuma aksi hâlde "Bu zorlukta
   * yeterli şarkı yok" ekranına takılır ve hiç oynanamaz.
   */
  const tooNarrow =
    !challengeSong && !loading && pool.length > 0 && filtered.length < MIN_PLAYABLE

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
       * Meydan okumada şarkı sabittir; `pickNext` atlanır.
       *
       * ⚠️ `nextUp` TÜKETİLMEZ: `arm()` etkin şeride, `prefetch()` boştaki
       * şeride yazıyor. Sabit şarkı etkin şeride kurulurken boştaki adayın sesi
       * sağlam kalır ve meydan okuma bitince `swapLanes()` onu devralır — iki
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
        /**
         * ⚠️ Özyineleme `forced`'ı TAŞIMAZ. Taşısaydı çalınamayan bir meydan
         * okuma şarkısı aynı ölü URL'i `DEAD_URL_LIMIT` kez deneyip hata
         * ekranıyla biterdi. Doğrusu: meydan okuma düşer, oyuncu yine oynar.
         */
        if (forced) {
          setChallengeStatus('calinamadi')
          // Bayrağı temizlemek tur başlatma etkisini tetikler; burada ayrıca
          // startRound çağırmak turu iki kez kurardı.
          setChallengeSong(null)
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

  // Meydan okunan şarkıyı havuzda bul. Havuz zaten yükleniyor, ek istek yok.
  useEffect(() => {
    if (!challengeSongId || challengeSong || loading || pool.length === 0) return
    const hit = pool.find((s) => s.id === challengeSongId)
    if (hit) {
      setChallengeSong(hit)
      setChallengeStatus('hazir')
    } else {
      // Şarkı silinmiş, kapatılmış ya da diskteki yedek havuz eski.
      setChallengeStatus('bulunamadi')
    }
  }, [challengeSongId, challengeSong, pool, loading])

  /**
   * ⚠️ Meydan okuma bir FAZ, "bir kez çalıştır" bayrağı değil.
   *
   * StrictMode dev'de efektleri iki kez çalıştırıyor. Ref tabanlı bir bayrakta
   * ikinci çalıştırma meydan okumanın üstüne normal tur kurar ve özelliği dev
   * ortamında imkânsız hâle getirirdi. Faz olarak tutulunca ikinci çalıştırma
   * AYNI şarkıyı yeniden kurar — normal turlarda bugün zaten olan davranış.
   */
  useEffect(() => {
    if (loading) return
    if (challengeSong) {
      void startRound(universe, ladder, 0, challengeSong)
      return
    }
    // Havuz henüz gelmediyse normal turu kurup meydan okumayı ezme.
    if (challengeStatus === 'cozuluyor') return
    if (filtered.length === 0) return
    void startRound(filtered, ladder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, ladder, loading, challengeSong, challengeStatus])

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
     * ⚠️ Meydan okuma tek turluktur ve kademe YÜKSELTMEZ.
     *
     * Zorluğu oyuncu seçmedi, arkadaşı seçti; `tier` ise kalıcı bir ayar
     * (`nakarat:ayarlar:v3`). Bir arkadaşın linki oyuncunun kendi ayarını
     * kalıcı olarak değiştirmemeli.
     *
     * ⚠️ Burada `startRound` ÇAĞRILMAZ — bayrağı temizlemek tur başlatma
     * etkisini tetikler ve turu o kurar. Aşağıdaki kademe değişimiyle birebir
     * aynı değişmez.
     */
    if (challengeSong) {
      setChallengeSong(null)
      setChallengeStatus('yok')
      return
    }

    // Bildiyse bir üst kademeye çık; İmkansız'da (5) tavan.
    const climbed = state.s === 'won' ? Math.min(5, tier + 1) : tier
    if (climbed !== tier) {
      // Kademe değişince `filtered` yenilenir ve turu o etki başlatır;
      // burada ayrıca startRound çağırmak turu iki kez kurardı.
      setTier(climbed as typeof tier)
      return
    }
    void startRound(filtered, ladder)
  }, [state, tier, setTier, filtered, ladder, startRound, challengeSong])

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
    isChallenge: challengeSong !== null,
    challengeStatus,
    play, guess, guessSong, skip, reroll, next, clearAmbiguity, onWrong,
  }
}
