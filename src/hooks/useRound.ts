'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { installResumeHandlers } from '@/audio/context'
import { loadChip } from '@/data/loadPool'
import { alanlariAl, alanlariIsit, alanlarOnbellekten, birlestir } from '@/data/loadSongFields'
import type { Song } from '@/data/schema'
import { MIN_PLAYABLE, type Difficulty } from '@/data/categories'
import { gameReducer, canPlay, currentClipLength, type GameState } from '@/game/machine'
import { STEPS } from '@/game/ladder'
import { pickNext, filterByTier } from '@/game/select'
import { judgeGuess, type Verdict } from '@/text/match'
import { buildIndex, sarkiSamanligi, type SearchIndex } from '@/text/autocomplete'
import { useSettingsStore } from '@/store/useSettingsStore'
import { sanatciSlug } from '@/text/sanatci'

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
  index: SearchIndex<Song> | null
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
  /** İpucu al: pas gibi bir kademe yakar, tahmin hakkı yakmaz. */
  hint: () => void
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

/** Tek oyunculu modun seçenekleri. */
export interface RoundSecenek {
  /**
   * Sanatçı modu: yalnızca bu kısa adın (`sanatciSlug(nA)`) şarkıları.
   *
   * ⚠️ Havuz her zaman `karisik`: sanatçının şarkıları birden fazla türe
   * dağılmış olabilir ve kalıcı seçki ayarı DEĞİŞTİRİLMEZ — oyuncu moddan
   * çıkınca kendi seçkisine döner.
   */
  sanatci?: string | null
}

export function useRound(dizilim?: DizilimOpts, secenek?: RoundSecenek): RoundApi {
  /*
   * ⚠️ Alan alan abone olunuyor. Seçicisiz `useSettingsStore()` bütün depoya
   * abone olur; "Azaltılmış animasyon" anahtarına dokunmak bile tur kancasını
   * ve altındaki her şeyi yeniden çizdiriyordu — oysa `reduce` burada hiç
   * kullanılmıyor.
   */
  const ayarKategori = useSettingsStore((s) => s.category)
  const sanatci = secenek?.sanatci ?? null
  const category = sanatci ? 'karisik' : ayarKategori
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
  /** Sıradaki tur için önceden seçilip sesi önyüklenmiş şarkı (AYNI kademe). */
  const nextUp = useRef<Song | null>(null)
  /**
   * BİR ÜST kademenin adayı — oyuncu bilirse kademe oraya yükseliyor.
   *
   * ⚠️ İki aday tutmanın sebebi: `filterByTier` tam kademe eşleşmesi yapıyor ve
   * havuzlar büyük olduğu için `filtered(tier)` ile `filtered(tier+1)` AYRIK.
   * Tek aday tutulurken KAZANAN oyuncunun adayı her seferinde eleniyor, sesi ve
   * alanları çöpe gidiyordu — "bildikten sonra sıradaki şarkı geç geliyor"
   * şikâyetinin kökü buydu. Bu adayın alanları baştan ısıtılıyor (~200 bayt),
   * sesi ise ancak tur kazanıldığı anda indirilmeye başlıyor.
   */
  const nextUpUst = useRef<Song | null>(null)
  /** Sonuç belli olunca çivilenen aday — `pickNext` onu ezmesin. */
  const sabitAday = useRef<Song | null>(null)
  /**
   * Kurulum sürerken "Sıradaki şarkı" yeniden tetiklenmesin.
   *
   * ⚠️ Düğme `autoFocus`: Enter'a basılı tutmak da tekrar tıklama üretiyor ve
   * her tekrar `roundToken`'ı artırıp süren `arm()`'ı iptal ediyor, kurulum
   * baştan başlıyordu — yani gecikmeyi kullanıcının kendisi ikiye katlıyordu.
   */
  const kilit = useRef(false)
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
    /**
     * ⚠️ Elde kalan tur HEMEN düşürülür.
     *
     * Yeni seçkinin havuzu ağdan gelene kadar durum ESKİ turu `ready`
     * tutuyordu, yani `canPlay` doğru kalıyordu: oyuncu kategoriyi değiştirip
     * hemen çal'a bastığında önceki seçkinin şarkısı çalıyordu. Sesi de
     * durdurmak gerekiyor — hazırlanmış klip şeritte duruyor.
     */
    clipPlayer.stop()
    dispatch({ type: 'RESET' })
    loadChip(category)
      .then((songs) => {
        if (cancelled) return
        played.current = new Set()
        nextUp.current = null
        nextUpUst.current = null
        sabitAday.current = null
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
    /*
     * ⚠️ `sanatci` da bağımlılık: moddan çıkarken seçki zaten `karisik` ise
     * `category` değişmez ve elde sanatçının turu kalırdı. Havuz söz önbelleğinden
     * geldiği için yeniden yükleme ağa gitmiyor.
     */
  }, [category, sanatci])

  // Sanatçı modunda havuz önce sanatçıya daraltılır.
  const sanatciHavuzu = useMemo(
    () => (sanatci ? pool.filter((s) => sanatciSlug(s.nA) === sanatci) : pool),
    [pool, sanatci],
  )

  // Zorluk kademesi havuzu süzer; küratörlük inceyse komşu kademeler eklenir.
  // Sanatçı havuzu küçük olduğu için orada genişleme sık devreye girer — bilinçli.
  const filtered = useMemo(() => filterByTier(sanatciHavuzu, tier), [sanatciHavuzu, tier])

  /**
   * Kazanılırsa oynanacak kademenin havuzu.
   *
   * ⚠️ `startRound` bağımlılıksız bir `useCallback`; bu yüzden liste ref
   * üzerinden okunuyor. Bağımlılık olsaydı kimliği her değiştiğinde tur kurulum
   * etkisi yeniden tetiklenir ve tur iki kez kurulurdu.
   */
  const ustListe = useMemo(
    () => (tier < 5 ? filterByTier(sanatciHavuzu, (tier + 1) as Difficulty) : []),
    [sanatciHavuzu, tier],
  )
  const ustListeRef = useRef<Song[]>([])
  ustListeRef.current = ustListe

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
  /*
   * ⚠️ İndeks ERTELENİYOR. `buildIndex` (uFuzzy + binlerce şarkı) kademe
   * yükselince tıklama karesinde senkron çalışıyordu; mobil işlemcide
   * "Sıradaki şarkı" ile turun kurulması arasındaki en görünür senkron kalemdi.
   * `filtered` acil kaldığı için TUR KURULUMU GECİKMEZ; yalnızca öneri listesi
   * bir kare sonra hazırlanır ve tahmin kutusu o sırada zaten kapalı.
   */
  const ertelenmisEvren = useDeferredValue(universe)
  const index = useMemo(
    () => (ertelenmisEvren.length > 0 ? buildIndex(ertelenmisEvren, sarkiSamanligi) : null),
    [ertelenmisEvren],
  )

  /**
   * Havuz ince: şarkılar kısa sürede tekrar edecek.
   *
   * ⚠️ Bu bir UYARI, ENGEL DEĞİL — ve eskiden engeldi.
   *
   * `filterByTier` kademeleri ZATEN sonuna kadar genişletiyor. Bir kategoride
   * 5 şarkı varsa hangi kademe seçilirse seçilsin beşi birden dönüyor, yani
   * sonuç her kademede `< MIN_PLAYABLE` — oyun HİÇBİR kademede açılmıyordu ve
   * ekrandaki "başka bir zorluk dene" tavsiyesi imkânsız bir şey öneriyordu.
   *
   * Bugün şarkı tarafında tetiklenmiyor (en küçük kategori 1595 şarkı) ama
   * ünlü oyununda tam olarak bu yaşandı: 5 kişilik havuzda oyun kilitlendi.
   * `MIN_PLAYABLE` genişleme eşiği; oynanabilirlik ölçütü değil.
   *
   * ⚠️ Düelloda bastırılır — dizilim zaten sabit.
   */
  const tooNarrow =
    !sequence && !loading && pool.length > 0 && filtered.length < MIN_PLAYABLE

  const ladder = useMemo(() => [...STEPS], [])

  // --- tur başlatma ---
  const startRound = useCallback(
    async (songs: Song[], rungs: number[], tried = 0, forced?: Song, tekrarlanan?: Song) => {
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
      let song = forced ?? tekrarlanan ?? null
      if (!song) {
        /*
         * Önce ÇİVİLENEN aday: tur biterken sonucuna göre seçilmiş ve sesi
         * indirilmeye başlanmış şarkı (bkz. `hedefleAday`, `next`). Yoksa
         * önceki turda seçilen aynı kademe adayı. Seçki ya da kademe değiştiyse
         * aşağıdaki liste kontrolü ikisini de eler.
         */
        song = sabitAday.current ?? nextUp.current
        sabitAday.current = null
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

      /**
       * Oynanabilirlik alanlarını (önizleme, kapak, mağaza) tamamla.
       *
       * ⚠️ Bunlar toplu havuzda GELMİYOR — üç URL alanı 5089 satırlık yanıtın
       * %60'ıydı. Önbellek ve önden ısıtma sayesinde bu çağrı neredeyse her
       * zaman anında döner; yalnızca oturumun ilk turu ~200 baytlık bir istek
       * bekler.
       *
       * ⚠️ Düelloda şarkılar sunucudan TAM geliyor; `p` zaten doluysa ağ hiç
       * kullanılmaz.
       */
      const tam = song.p ? song : birlestir(song, await alanlariAl(song.id))

      // ⚠️ Yeni bir `await`, yeni bir yarış penceresi: token burada da
      // kontrol edilmeli, yoksa geçersiz kalmış kurulum ARM gönderir.
      if (token !== roundToken.current) return

      if (!tam.p) {
        /*
         * Alanlar gelmedi — ölü URL ile AYNI muamele: başka şarkı denenir.
         *
         * ⚠️ Eskiden burada doğrudan hata ekranına gidiliyordu ("Şarkı
         * yüklenemedi" + "Tekrar dene"). Oysa bu, ağ tökezlemesinin yanı sıra
         * tamamen olağan bir durumda da oluyor: küratör şarkıyı kapatmışsa ya da
         * havuz eski bir kopyadan geldiyse `/api/sarki` o kimlik için boş döner
         * (ölçüldü). Tek bir ölü kayıt yüzünden oyunu durdurmak yerine sıradaki
         * şarkıya geçiliyor; sınır `DEAD_URL_LIMIT`.
         *
         * ⚠️ Sabit şarkıda (düello) değiştirme YOK: iki oyuncu aynı parçayı
         * oynamak zorunda.
         */
        if (forced) {
          dispatch({ type: 'ARM_FAIL', reason: 'offline' })
          return
        }
        void startRound(songs, rungs, tried + 1)
        return
      }

      dispatch({ type: 'ARM', track: tam, ladder: rungs })

      const result = await clipPlayer.arm({
        id: tam.id,
        url: tam.p,
        clipStart: tam.cs,
        duration: tam.du,
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

        /*
         * İKİNCİ aday: oyuncu bilirse kademe yükselecek ve `upcoming` o havuzda
         * olmayacak (bkz. `nextUpUst`). Sesi burada indirilmez — tur
         * kazanıldığı anda başlar; oyuncu sonuç panelini okurken yetişiyor.
         */
        const ustAday = forced
          ? null
          : (() => {
              const liste = ustListeRef.current
              if (liste.length === 0) return null
              const p = pickNext(liste, played.current)
              return p && !p.recycled ? p.song : null
            })()

        nextUp.current = upcoming
        nextUpUst.current = ustAday

        /*
         * ⚠️ İki adayın ALANLARI da şimdiden, TEK istekte çekilir. Bu olmadan
         * her tur başlangıcı ~200 baytlık bir istek beklerdi; ayrı ayrı
         * istenseydi kazanılan gidiş-dönüşün yarısı geri verilirdi.
         */
        const isitilacak = [upcoming, ustAday]
          .filter((s): s is Song => Boolean(s) && !s!.p)
          .map((s) => s.id)
        if (isitilacak.length > 0) alanlariIsit(isitilacak)

        if (upcoming) {
          const sesiIndir = (url: string) =>
            clipPlayer.prefetch({
              id: upcoming.id,
              url,
              clipStart: upcoming.cs,
              duration: upcoming.du,
            })
          if (upcoming.p) sesiIndir(upcoming.p)
          else {
            void alanlariAl(upcoming.id).then((alan) => {
              if (alan) sesiIndir(alan.p)
            })
          }
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
      } else if (result === 'stalled' && !forced && !tekrarlanan) {
        /*
         * ⚠️ Takılma bir kez YENİDEN DENENİR (ölü URL 6 kez deneniyordu, takılma
         * hiç). Arabellek kapısı küçüldükten sonra tek bir tökezleme, aynı şarkı
         * ve korunan arabellekle çoğu zaman anında toparlanıyor; oyuncuya tam
         * ekran "bağlantı takıldı" göstermek bunun yanında pahalı bir yalandı.
         */
        void startRound(songs, rungs, tried, undefined, song)
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

  /**
   * Tur KAZANILDI: sıradaki turun adayını üst kademeninkiyle değiştir ve sesini
   * indirmeye başla.
   *
   * ⚠️ Zamanlaması önemli: oyuncu bundan sonra sonuç panelini okuyor (tipik
   * 1,5-4 sn). İndirme o pencerede ilerlediği için "Sıradaki şarkı"ya basıldığında
   * ses çoğu zaman hazır oluyor. Daha erken indirmek, kaybedilen turlarda boşa
   * giden mobil veri demekti.
   */
  const hedefleAday = useCallback(() => {
    const ust = nextUpUst.current
    if (!ust) return
    sabitAday.current = ust

    const indir = (url: string) =>
      clipPlayer.prefetch({ id: ust.id, url, clipStart: ust.cs, duration: ust.du })

    const hazir = ust.p ?? alanlarOnbellekten(ust.id)?.p
    if (hazir) {
      indir(hazir)
      return
    }
    /*
     * ⚠️ Alanlar HENÜZ gelmediyse beklenip indirme yine de başlatılıyor.
     * Şarkıyı çabuk bilen oyuncuda (tur birkaç saniye sürüyor) ısıtma isteği
     * hâlâ uçuşta olabiliyor; bu dal olmadan indirme ancak "Sıradaki şarkı"
     * tıklamasında başlıyor ve yavaş hatta 2,5 saniyeye mal oluyordu (ölçüldü).
     * Ek istek yok: `alanlariAl` uçuştaki toplu isteğe katılıyor.
     */
    void alanlariAl(ust.id).then((alan) => {
      // Bu arada tur değişmişse (seçki, kademe, "şarkıyı değiştir") vazgeç.
      if (alan && sabitAday.current?.id === ust.id) indir(alan.p)
    })
  }, [])

  const guess = useCallback(
    (raw: string): Verdict => {
      if (state.s !== 'ready' && state.s !== 'playing') return { kind: 'empty' }

      const verdict = judgeGuess(raw, state.track, universe, { easySearch })

      if (verdict.kind === 'correct') {
        clipPlayer.stop()
        dispatch({ type: 'CORRECT' })
        setAmbiguous(null)
        hedefleAday()
      } else if (verdict.kind === 'ambiguous') {
        // Hak TÜKETİLMEZ — kullanıcı hangisini kastettiğini seçsin.
        setAmbiguous(verdict.candidates)
      } else if (verdict.kind === 'wrong') {
        markWrong(raw, verdict.sameArtist)
      }
      return verdict
    },
    [state, universe, easySearch, markWrong, hedefleAday],
  )

  /** Kolay modu: şıktan seçim. Metin eşleştirmesine gerek yok, id yeter. */
  const guessSong = useCallback(
    (song: Song) => {
      if (state.s !== 'ready' && state.s !== 'playing') return
      if (song.id === state.track.id) {
        clipPlayer.stop()
        dispatch({ type: 'CORRECT' })
        setAmbiguous(null)
        hedefleAday()
      } else {
        markWrong(song.t, song.nA === state.track.nA)
      }
    },
    [state, markWrong, hedefleAday],
  )

  const skip = useCallback(() => {
    if (state.s !== 'ready' && state.s !== 'playing') return
    clipPlayer.stop()
    dispatch({ type: 'SKIP' })
    setAmbiguous(null)
  }, [state])

  /**
   * İpucu. Sınırlar (en fazla iki, son kademede yok) makinede; burada yalnızca
   * çalan klibi durdurmak var — kademe değişince yarım kalan klip yanlış
   * uzunlukta çalmaya devam ederdi.
   */
  const hint = useCallback(() => {
    if (state.s !== 'ready' && state.s !== 'playing') return
    clipPlayer.stop()
    dispatch({ type: 'HINT' })
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
    // ⚠️ `swapLanes()` YOK: şeridi artık `arm()` veriye göre seçiyor (bkz.
    // `ClipPlayer.ensureLane`). Körlemesine takas, hazır arabelleği çöpe atıyordu.
    void startRound(filtered, ladder)
  }, [filtered, ladder, startRound])

  const next = useCallback(() => {
    // ⚠️ Kurulum sürerken gelen ikinci çağrı YUTULUR: yoksa `roundToken` artıp
    // süren `arm()` iptal olur ve bekleme ikiye katlanır.
    if (kilit.current || state.s === 'arming') return
    // iOS: önyükleme bir gesture içinde başlamalı — "Sıradaki" tıklaması bu.
    clipPlayer.unlockFromGesture()

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

    /*
     * ⚠️ İNDİRME BU DOKUNUŞUN İÇİNDE, ilk `await`ten önce başlıyor: iOS
     * `preload="auto"`yu yok sayıyor ve medya baytlarını yalnızca bir gesture
     * içinde çekiyor (bkz. `audio/context.ts`). Tur kurulumu bir efektten
     * çağrıldığı için indirme eskiden dokunuşun dışında kalıyordu.
     *
     * Aday ÇİVİLENİYOR; aksi hâlde `pickNext` başka bir şarkı seçer ve burada
     * başlattığımız indirme çöpe gider.
     */
    const aday = (climbed !== tier ? nextUpUst.current : nextUp.current) ?? sabitAday.current
    if (aday) {
      sabitAday.current = aday
      const url = aday.p ?? alanlarOnbellekten(aday.id)?.p
      if (url) {
        clipPlayer.primeFromGesture({ id: aday.id, url, clipStart: aday.cs, duration: aday.du })
      }
    }

    kilit.current = true
    if (climbed !== tier) {
      // Kademe değişince `filtered` yenilenir ve turu o etki başlatır;
      // burada ayrıca startRound çağırmak turu iki kez kurardı.
      setTier(climbed as typeof tier)
      return
    }
    void startRound(filtered, ladder)
  }, [state, tier, setTier, filtered, ladder, startRound, sequence])

  /** Kurulum bitince (ya da hata verince) kilit açılır. */
  useEffect(() => {
    if (state.s !== 'arming' && state.s !== 'booting') kilit.current = false
  }, [state.s])

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
    play, guess, guessSong, skip, hint, reroll, next, clearAmbiguity, onWrong,
  }
}
