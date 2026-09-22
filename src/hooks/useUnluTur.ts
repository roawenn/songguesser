'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadUnluChip } from '@/data/loadUnluPool'
import { storagePublicUrlIstemci } from '@/lib/storageIstemci'
import { MIN_PLAYABLE, type Difficulty } from '@/data/categories'
import { unluGorselYolu, type Unlu } from '@/data/unlu'
import { unluReducer, turIcinde, type UnluDurum } from '@/game/unluMachine'
import { filterByTier, pickNext, sonrakiDoluKademe } from '@/game/select'
import { judgeGuess, type Verdict } from '@/text/match'
import { buildIndex, type SearchIndex } from '@/text/autocomplete'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * Ünlü turunun yönetimi — `useRound`'un kardeşi.
 *
 * `useRound` 465 satır ve yarısı `clipPlayer`; ayrı yazıldı. Ama orada tek tek
 * kazanılmış ŞU DESENLER birebir taşındı ve sebepleri burada da geçerli:
 *
 *   · `turToken` yarış koruması — StrictMode çift mount'unda ve hızlı seçki
 *     değişiminde iptal edilmiş kurulum yeni turun üstüne yazıyordu.
 *   · Seçki değişiminde `RESET` — yeni havuz gelene kadar eski kişi ekranda
 *     kalıyor ve oyuncu onu tahmin edebiliyordu.
 *   · `played` + `pickNext` + `recycled` — havuz tükenince sayaç sıfırlanır.
 *   · `nextUp` önyükleme — sıradaki görsel tur oynanırken iniyor.
 *   · `next()` içinde kademe yükselince `setTier` çağırıp DÖNMEK — aksi hâlde
 *     tur iki kez kurulur.
 *   · Alan alan abonelik — seçicisiz `useSettingsStore()` tüm ağacı ilgisiz
 *     her değişimde yeniden çizdiriyor.
 */

/**
 * Düello kipi: tur sırası DIŞARIDAN sürülür.
 *
 * İki oyuncu aynı beş kişiyi aynı sırayla oynuyor; hangi turun ne zaman
 * kurulacağına kanca değil düello sayfası karar veriyor.
 */
export interface DizilimOpts {
  dizilim: Unlu[]
  index: number
}

/** Ölü görselde art arda en fazla kaç kişi denenir. */
const OLU_GORSEL_SINIR = 6
/** `img.decode()` askıda kalırsa turu sonsuza kadar bekletmesin. */
const DECODE_ZAMAN_ASIMI = 10_000

export interface UnluTurApi {
  durum: UnluDurum
  havuz: Unlu[]
  /** Zorluk süzgecinden geçmiş, oynanan havuz. */
  suzulmus: Unlu[]
  /**
   * Havuz ince: kişiler kısa sürede tekrar edecek.
   *
   * ⚠️ Bu bir UYARI, ENGEL DEĞİL. Önce engeldi ve yanlıştı — aşağıya bak.
   */
  azKisi: boolean
  /** Boş ekranın sebebi — seçki mi boş, yalnızca kademe mi? */
  bosSebep: 'secki' | 'kademe'
  index: SearchIndex<Unlu> | null
  yukleniyor: boolean
  /** Son tahmin belirsizse adaylar burada — hak tüketilmedi. */
  belirsiz: Unlu[] | null
  gorselUrl: string

  tahmin: (raw: string) => Verdict<Unlu>
  kisiSec: (u: Unlu) => void
  pas: () => void
  /** Aynı seçkide başka bir kişiye geç — bedava, hak tüketmez. */
  degistir: () => void
  sonraki: () => void
  belirsizligiTemizle: () => void
  onYanlis: (fn: () => void) => void
}

/** Görseli indirip çözer; başarısızsa `dead` döner. */
async function gorselHazirla(url: string): Promise<'ready' | 'dead'> {
  const img = new Image()
  img.decoding = 'async'
  // ⚠️ `src` ÖNCE atanmalı: bazı tarayıcılarda `decode()` kaynaksız çağrılınca
  // reddediyor.
  img.src = url
  try {
    await Promise.race([
      img.decode(),
      new Promise((_, red) => setTimeout(() => red(new Error('zaman aşımı')), DECODE_ZAMAN_ASIMI)),
    ])
    return 'ready'
  } catch {
    return 'dead'
  }
}

export function useUnluTur(opts?: DizilimOpts): UnluTurApi {
  const [durum, dispatch] = useReducer(unluReducer, { s: 'booting' } as UnluDurum)
  const [havuz, setHavuz] = useState<Unlu[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [belirsiz, setBelirsiz] = useState<Unlu[] | null>(null)

  // ⚠️ Alan alan abonelik — seçicisiz okuma tüm ağacı gereksiz çizdiriyor.
  const kategori = useSettingsStore((s) => s.unluCategory)
  const kademe = useSettingsStore((s) => s.unluTier)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const setKademe = useSettingsStore((s) => s.setUnluTier)

  const oynanan = useRef<Set<string>>(new Set())
  const sonraki = useRef<Unlu | null>(null)
  /**
   * BİR ÜST kademenin adayı — oyuncu bilirse kademe oraya yükseliyor.
   *
   * ⚠️ Şarkı oyunundaki hatanın aynısı buradaydı: `filterByTier` tam kademe
   * eşleşmesi yaptığı için kazanınca önyüklenen kişi her seferinde eleniyor ve
   * indirilen görsel çöpe gidiyordu (bkz. `useRound`). Görsel ancak tur
   * kazanıldığı anda indirilir; kaybedilen turlarda boşa veri harcanmaz.
   */
  const sonrakiUst = useRef<Unlu | null>(null)
  /** Sonuç belli olunca çivilenen aday — `pickNext` onu ezmesin. */
  const sabitAday = useRef<Unlu | null>(null)
  const turToken = useRef(0)
  const yanlisHandler = useRef<(() => void) | null>(null)

  // --- havuz ---
  useEffect(() => {
    let iptal = false
    setYukleniyor(true)
    /*
     * ⚠️ Seçki değişince ESKİ TUR HEMEN DÜŞÜRÜLÜR. Şarkı tarafında bu
     * yapılmadığı için oyuncu kategoriyi değiştirip hemen çal'a bastığında
     * önceki seçkinin şarkısı çalıyordu; burada karşılığı, eski kişinin
     * görselinin ekranda kalması olurdu.
     */
    dispatch({ type: 'RESET' })
    oynanan.current = new Set()
    sonraki.current = null
    sonrakiUst.current = null
    sabitAday.current = null

    void loadUnluChip(kategori)
      .then((liste) => {
        if (iptal) return
        setHavuz(liste)
        setYukleniyor(false)
      })
      .catch(() => {
        if (iptal) return
        setHavuz([])
        setYukleniyor(false)
        dispatch({ type: 'ARM_FAIL', reason: 'pool' })
      })

    return () => {
      iptal = true
    }
  }, [kategori])

  const dizilim = opts?.dizilim
  const dizilimIndex = opts?.index ?? 0

  /**
   * ⚠️ KADEME TAM EŞLEŞİR — komşu kademelere genişleme YOK (`min: 0`).
   *
   * `filterByTier` normalde bir kademede `MIN_PLAYABLE` (8) kişiden azsa
   * komşu kademeleri de katıyor. O kural 15 bin şarkılık havuz için yazıldı;
   * ünlü havuzu bugün 6 kişi, yani HİÇBİR kademe 8'e ulaşmıyor ve süzgeç
   * sonuna kadar genişleyip her kademede herkesi gösteriyordu. Küratör
   * "Kolay" dediği kişiyi "Uzman"da görüyordu — etiketin anlamı kalmamıştı.
   *
   * Artık oyuncuya ne seçtiyse o gösteriliyor; kademe boşsa oyun bunu açıkça
   * söylüyor (bkz. `bosSebep` ve `UnluShell`).
   */
  const suzulmus = useMemo(() => filterByTier(havuz, kademe, 0), [havuz, kademe])

  /**
   * Boş ekranın sebebi: seçkide hiç kimse yok mu, yoksa yalnızca bu kademe mi
   * boş? İkisine verilecek öğüt farklı — biri kategori, diğeri zorluk değiştirmek.
   */
  const bosSebep: 'secki' | 'kademe' = havuz.length === 0 ? 'secki' : 'kademe'

  /**
   * ⚠️ ÜST KADEME ÖN YÜKLEMESİ KAPALI.
   *
   * Kazanınca bir üst kademenin adayı önden indiriliyordu. Bu, yalnızca
   * süzgeç komşu kademeleri kattığı için işe yarıyordu: kişi o zaman oynanan
   * listede de bulunuyordu. Tam eşleşmede üst kademedeki kişi `turBaslat`'ın
   * "listede mi?" kontrolünden eleniyor — indirilen görsel doğrudan çöpe
   * giderdi. Kademe zaten kendiliğinden yükselmiyor; oyuncu seçiyor.
   */
  const ustListe = useMemo<Unlu[]>(() => [], [])
  const ustListeRef = useRef<Unlu[]>([])
  ustListeRef.current = ustListe
  /*
   * ⚠️ Bu ENGEL DEĞİL, yalnızca uyarı — ve bir zamanlar engeldi: oyun
   * "Bu zorlukta oynanacak kadar kişi yok" deyip kilitleniyordu. Az kişiyle
   * oyun gayet oynanır, sadece tekrar eder; kilitlemek oyuncudan oynayabileceği
   * bir oyunu almaktı.
   *
   * `MIN_PLAYABLE` burada yalnızca "tekrar edebilir" eşiği. Kademe tam
   * eşleştiği için (yukarı bkz.) sayı gerçekten o kademedeki kişi sayısıdır.
   */
  const azKisi = suzulmus.length > 0 && suzulmus.length < MIN_PLAYABLE

  /**
   * Otomatik tamamlama evreni.
   *
   * ⚠️ Oynanan kişi süzgeç dışında kalabilir (kademe genişletmesi sonrası);
   * evrene eklenmezse "Kolay arama" açık oyuncu doğru cevabı öneri listesinde
   * göremez — `useRound`'daki aynı gerekçe.
   */
  const evren = useMemo(() => {
    /*
     * ⚠️ Düelloda dizilimdeki kişiler de evrene GİRMELİ. Girmezse "Kolay
     * arama" açık oyuncu doğru cevabı öneri listesinde göremez ve tur
     * oynanamaz hâle gelir — `useRound`'daki aynı gerekçe.
     */
    const taban = dizilim ? [...suzulmus, ...dizilim.filter((u) => !suzulmus.some((x) => x.id === u.id))] : suzulmus
    if (!turIcinde(durum) && durum.s !== 'won' && durum.s !== 'lost') return taban
    const k = durum.kisi
    return taban.some((u) => u.id === k.id) ? taban : [...taban, k]
  }, [suzulmus, durum, dizilim])

  const index = useMemo(
    () => (evren.length > 0 ? buildIndex(evren, (u) => u.nT) : null),
    [evren],
  )

  // --- tur kurulumu ---
  const turBaslat = useCallback(
    async (liste: Unlu[], denendi = 0, zorlanan?: Unlu) => {
      const token = ++turToken.current
      if (denendi >= OLU_GORSEL_SINIR) {
        dispatch({ type: 'ARM_FAIL', reason: 'offline' })
        return
      }

      let kisi = zorlanan ?? sabitAday.current ?? sonraki.current
      sabitAday.current = null
      sonraki.current = null
      if (!kisi || !liste.some((u) => u.id === kisi!.id)) {
        const sec = pickNext(liste, oynanan.current)
        if (!sec) {
          dispatch({ type: 'EMPTY_POOL' })
          return
        }
        if (sec.recycled) oynanan.current = new Set()
        kisi = sec.song
      }
      oynanan.current.add(kisi.id)
      setBelirsiz(null)

      dispatch({ type: 'ARM', kisi })

      const sonuc = await gorselHazirla(storagePublicUrlIstemci(unluGorselYolu(kisi)))
      // ⚠️ `await` sonrası token kontrolü ŞART: bu arada yeni bir tur
      // kurulduysa bu çağrı geçersizdir ve sonucu YUTULMALIDIR.
      if (token !== turToken.current) return

      if (sonuc === 'dead') {
        // ⚠️ Özyineleme `zorlanan`ı TAŞIMAZ: sabitlenen kişi açılamıyorsa aynı
        // ölü görseli altı kez denemenin anlamı yok.
        if (zorlanan) {
          dispatch({ type: 'ARM_FAIL', reason: 'image' })
          return
        }
        void turBaslat(liste, denendi + 1)
        return
      }

      dispatch({ type: 'ARM_OK' })

      // Sıradaki kişiyi şimdiden seç ve görselini indirmeye başla.
      // Düelloda sıra belli; rastgele seçmenin anlamı yok.
      const aday = zorlanan
        ? null
        : (() => {
            const a = pickNext(liste, oynanan.current)
            return a && !a.recycled ? a.song : null
          })()
      if (aday) {
        sonraki.current = aday
        void gorselHazirla(storagePublicUrlIstemci(unluGorselYolu(aday)))
      }

      // Kazanılırsa oynanacak aday; görseli ancak kazanıldığı anda indirilir.
      sonrakiUst.current = zorlanan
        ? null
        : (() => {
            const liste2 = ustListeRef.current
            if (liste2.length === 0) return null
            const a = pickNext(liste2, oynanan.current)
            return a && !a.recycled ? a.song : null
          })()
    },
    [],
  )

  useEffect(() => {
    if (dizilim) {
      const k = dizilim[dizilimIndex]
      if (k) void turBaslat(dizilim, 0, k)
      return
    }
    if (yukleniyor) return
    if (suzulmus.length === 0) {
      dispatch({ type: 'EMPTY_POOL' })
      return
    }
    void turBaslat(suzulmus)
  }, [suzulmus, yukleniyor, turBaslat, dizilim, dizilimIndex])

  // --- eylemler ---
  /**
   * Tur KAZANILDI: sıradaki turun adayını üst kademeninkiyle değiştir ve
   * görselini indirmeye başla. Oyuncu sonuç kartını okurken yetişiyor.
   */
  const hedefleAday = useCallback(() => {
    const ust = sonrakiUst.current
    if (!ust) return
    sabitAday.current = ust
    void gorselHazirla(storagePublicUrlIstemci(unluGorselYolu(ust)))
  }, [])

  const yanlisIsle = useCallback((text: string) => {
    dispatch({ type: 'WRONG', text })
    yanlisHandler.current?.()
  }, [])

  const tahmin = useCallback(
    (raw: string): Verdict<Unlu> => {
      if (!turIcinde(durum)) return { kind: 'empty' }
      const v = judgeGuess(raw, durum.kisi, evren, { easySearch })
      if (v.kind === 'correct') {
        dispatch({ type: 'CORRECT' })
        hedefleAday()
      }
      else if (v.kind === 'wrong') yanlisIsle(raw)
      else if (v.kind === 'ambiguous') setBelirsiz(v.candidates)
      return v
    },
    [durum, evren, easySearch, yanlisIsle, hedefleAday],
  )

  const kisiSec = useCallback(
    (u: Unlu) => {
      if (!turIcinde(durum)) return
      if (u.id === durum.kisi.id) {
        dispatch({ type: 'CORRECT' })
        hedefleAday()
      } else yanlisIsle(u.ad)
    },
    [durum, yanlisIsle, hedefleAday],
  )

  const pas = useCallback(() => {
    if (!turIcinde(durum)) return
    dispatch({ type: 'SKIP' })
    setBelirsiz(null)
  }, [durum])

  const degistir = useCallback(() => {
    void turBaslat(suzulmus)
  }, [suzulmus, turBaslat])

  const sonrakiTur = useCallback(() => {
    /*
     * ⚠️ Düelloda `sonraki()` tur KURMAZ ve kademe YÜKSELTMEZ. Sırayı düello
     * sayfası sürüyor (index artınca etki turu kurar); burada ayrıca tur
     * kurmak onu iki kez kurardı. Kademe de oyuncunun seçimi değil düellonun
     * rampası — kalıcı ayarına yazılmamalı.
     */
    if (dizilim) return
    // Bildiyse üstteki İLK DOLU kademeye çık; yukarısı boşsa burada kal.
    const cikilan = durum.s === 'won' ? sonrakiDoluKademe(havuz, kademe) : kademe
    if (cikilan !== kademe) {
      /*
       * ⚠️ `setKademe` çağırıp DÖNÜYORUZ. Kademe değişince `suzulmus`
       * yenileniyor ve turu YUKARIDAKİ ETKİ kuruyor; burada ayrıca
       * `turBaslat` çağırmak turu iki kez kurar.
       */
      setKademe(cikilan)
      return
    }
    void turBaslat(suzulmus)
  }, [durum, havuz, kademe, setKademe, suzulmus, turBaslat, dizilim])

  const belirsizligiTemizle = useCallback(() => setBelirsiz(null), [])
  const onYanlis = useCallback((fn: () => void) => {
    yanlisHandler.current = fn
  }, [])

  const gorselUrl =
    durum.s === 'arming' || turIcinde(durum) || durum.s === 'won' || durum.s === 'lost'
      ? storagePublicUrlIstemci(unluGorselYolu(durum.kisi))
      : ''

  return {
    durum,
    havuz,
    suzulmus,
    azKisi,
    bosSebep,
    index,
    yukleniyor,
    belirsiz,
    gorselUrl,
    tahmin,
    kisiSec,
    pas,
    degistir,
    sonraki: sonrakiTur,
    belirsizligiTemizle,
    onYanlis,
  }
}
