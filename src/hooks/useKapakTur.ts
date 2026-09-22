'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { type Difficulty } from '@/data/categories'
import { KAPAK_BOYUTLARI, kapakSamanligi, kolayAnahtarlar, type Kapak } from '@/data/kapak'
import { loadKapakChip } from '@/data/loadKapakPool'
import { alanlariAl } from '@/data/loadSongFields'
import { artworkAt } from '@/data/schema'
import { kapakReducer, kapakTurIcinde, type KapakDurum } from '@/game/kapakMachine'
import { filterByTier, filterByYear, pickNext } from '@/game/select'
import { buildIndex, type SearchIndex } from '@/text/autocomplete'
import { judgeGuess, type Verdict } from '@/text/match'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * Kapak turunun yönetimi — `useUnluTur`'un kardeşi; oradaki kazanılmış desenler
 * aynen taşındı: `turToken` yarış koruması, seçki değişiminde `RESET`,
 * `played` + `pickNext` + `recycled`, `next()`'te kademe yükselince `setTier`
 * çağırıp DÖNMEK, alan alan abonelik.
 *
 * ⚠️ ÖNYÜKLEME YALNIZCA BİR SONRAKİ NETLİK. Beş boyutun hepsini baştan indirmek
 * adımları gecikmesiz açardı ama tam kapak ilk saniyede tarayıcı önbelleğine —
 * ve ağ sekmesine — düşerdi. Pikselleştirmenin sunucuda yapılmasının bütün
 * amacı buydu (bkz. `KapakKare`).
 *
 * ⚠️ KOLAY MOD anahtarları istemcide kuruluyor (`kolayAnahtarlar`): havuz tek,
 * kabul kuralı oyuncunun ayarına göre değişiyor. Cevap da evren de aynı
 * dönüşümden geçmeli — biri geçip diğeri geçmezse doğru yazılan sanatçı
 * "belirsiz" ya da "yanlış" sayılırdı.
 */

/**
 * Düello kipi: tur sırası ve kabul kuralı DIŞARIDAN sürülür.
 *
 * ⚠️ `kolay` LOBİDEN gelir, oyuncunun ayarından değil: iki oyuncuya aynı kural.
 *
 * ⚠️ Kabuk bunu oyunun HER fazında geçirmeli (lobide boş dizilimle). Geçmezse
 * kanca tek oyunculu kipe düşer ve lobi beklenirken arka planda rastgele turlar
 * kurup kapak indirir.
 */
export interface KapakDizilimOpts {
  dizilim: Kapak[]
  index: number
  kolay: boolean
}

/** Ölü kapakta art arda en fazla kaç albüm denenir. */
const OLU_KAPAK_SINIR = 6
/**
 * İlk kare bu sürede inmezse tur YİNE DE açılır; kare kutuda yükleme
 * göstergesiyle iner (bkz. `KapakKare`).
 */
const ILK_KARE_BEKLEME = 4000

export interface KapakTurApi {
  durum: KapakDurum
  havuz: Kapak[]
  /** Zorluk süzgecinden geçmiş, oynanan havuz. */
  suzulmus: Kapak[]
  index: SearchIndex<Kapak> | null
  /** Son tahmin belirsizse adaylar — hak tüketilmedi. */
  belirsiz: Kapak[] | null
  /** Kapağın Apple adresi (boyut `artworkAt` ile seçilir). Tur kurulana kadar boş. */
  kapakAr: string
  /** Apple Music bağlantısı — sonuç kartı için. */
  magazaUrl: string

  tahmin: (raw: string) => Verdict<Kapak>
  kapakSec: (k: Kapak) => void
  pas: () => void
  degistir: () => void
  sonraki: () => void
  belirsizligiTemizle: () => void
  onYanlis: (fn: () => void) => void
}

/**
 * Görseli indirir.
 *
 * ⚠️ YAVAŞLIK ÖLÜM DEĞİL. Eskiden `img.decode()` 10 sn beklenip albüm "ölü"
 * sayılıyordu: Apple küçük boyutları zaman zaman saniyelerce geç veriyor ve
 * `decode()` arka plandaki sekmede askıda kalabiliyor. Altı albüm üst üste
 * böyle düşünce ekranda "Kapak açılamadı" kalıyordu. Artık yalnızca KESİN hata
 * (`onerror`: 404, bozuk dosya) ölüm; süre dolarsa `yavas` ve tur yine açılır.
 * `decode` de gerekmiyor — gereken yalnızca baytların önbelleğe inmesi.
 */
function gorselHazirla(url: string): Promise<'ready' | 'dead' | 'yavas'> {
  return new Promise((coz) => {
    const img = new Image()
    const zaman = setTimeout(() => coz('yavas'), ILK_KARE_BEKLEME)
    img.onload = () => {
      clearTimeout(zaman)
      coz('ready')
    }
    img.onerror = () => {
      clearTimeout(zaman)
      coz('dead')
    }
    img.src = url
  })
}

export function useKapakTur(opts?: KapakDizilimOpts): KapakTurApi {
  const [durum, dispatch] = useReducer(kapakReducer, { s: 'booting' } as KapakDurum)
  const [havuz, setHavuz] = useState<Kapak[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [belirsiz, setBelirsiz] = useState<Kapak[] | null>(null)
  const [alan, setAlan] = useState<{ ar: string; u: string } | null>(null)

  const kategori = useSettingsStore((s) => s.kapakCategory)
  const kademe = useSettingsStore((s) => s.kapakTier)
  const ayarKolay = useSettingsStore((s) => s.kapakKolay)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const yil = useSettingsStore((s) => s.yil)
  const setKademe = useSettingsStore((s) => s.setKapakTier)

  const dizilim = opts?.dizilim
  const dizilimIndex = opts?.index ?? 0
  // Düelloda lobinin kuralı; tek başına oynarken oyuncunun ayarı.
  const kolay = opts ? opts.kolay : ayarKolay

  const oynanan = useRef<Set<string>>(new Set())
  const turToken = useRef(0)
  const yanlisHandler = useRef<(() => void) | null>(null)

  // --- havuz ---
  useEffect(() => {
    let iptal = false
    setYukleniyor(true)
    // ⚠️ Seçki değişince ESKİ TUR HEMEN DÜŞER: eski kapak ekranda kalıp tahmin edilmesin.
    // Düelloda seçki ayarı değişmiyor; havuz yalnızca otomatik tamamlama için.
    if (!dizilim) {
      dispatch({ type: 'RESET' })
      setAlan(null)
    }
    oynanan.current = new Set()

    void loadKapakChip(kategori)
      .then((liste) => {
        if (iptal) return
        setHavuz(liste)
        setYukleniyor(false)
      })
      .catch(() => {
        if (iptal) return
        setHavuz([])
        setYukleniyor(false)
        if (!dizilim) dispatch({ type: 'ARM_FAIL', reason: 'pool' })
      })

    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori])

  /*
   * ⚠️ SIRA: önce YIL, sonra KADEME — `api/havuz`'daki aynı gerekçe. Kademe
   * dilimi önce alınıp sonra yıla süzülseydi, `filterByTier`'in genişletmesi
   * yıl süzgecinden önce "yeterli" der ve hiç devreye girmezdi: ince hücreler
   * (ör. Sanat Müziği + Bu yıl) boş ekrana düşerdi.
   *
   * ⚠️ Şarkının aksine burada SUNUCU dilimlemiyor: kapak havuzu tam geliyor,
   * iki süzgeç de istemcide. Yani yıl kapak tarafında hiçbir yeni önbellek
   * anahtarı ya da istek üretmiyor.
   */
  const yilDilimi = useMemo(() => filterByYear(havuz, yil), [havuz, yil])
  const suzulmus = useMemo(() => filterByTier(yilDilimi, kademe), [yilDilimi, kademe])

  /**
   * Otomatik tamamlama ve eşleştirme evreni — kolay moda göre anahtarlanmış.
   *
   * ⚠️ Oynanan albüm süzgeç dışında kalabilir (kademe genişletmesi); evrende
   * olmazsa "Kolay arama" açık oyuncu doğru cevabı öneride göremez. Düelloda
   * dizilimin tamamı da eklenir — `useUnluTur`'daki aynı gerekçe.
   */
  const evren = useMemo(() => {
    const ekler = [
      ...(dizilim ?? []),
      ...(kapakTurIcinde(durum) || durum.s === 'won' || durum.s === 'lost' ? [durum.kapak] : []),
    ]
    const varOlan = new Set(suzulmus.map((k) => k.id))
    const taban = [...suzulmus]
    for (const k of ekler) {
      if (!varOlan.has(k.id)) {
        varOlan.add(k.id)
        taban.push(k)
      }
    }
    return taban.map((k) => kolayAnahtarlar(k, kolay))
  }, [suzulmus, durum, kolay, dizilim])

  const index = useMemo(
    () => (evren.length > 0 ? buildIndex(evren, kapakSamanligi(kolay)) : null),
    [evren, kolay],
  )

  // --- tur kurulumu ---
  const turBaslat = useCallback(async (liste: Kapak[], denendi = 0, zorlanan?: Kapak) => {
    const token = ++turToken.current
    if (denendi >= OLU_KAPAK_SINIR) {
      dispatch({ type: 'ARM_FAIL', reason: 'offline' })
      return
    }

    let kapak = zorlanan ?? null
    if (!kapak) {
      const sec = pickNext(liste, oynanan.current)
      if (!sec) {
        dispatch({ type: 'EMPTY_POOL' })
        return
      }
      if (sec.recycled) oynanan.current = new Set()
      kapak = sec.song
    }
    oynanan.current.add(kapak.id)
    setBelirsiz(null)
    // ⚠️ Önceki kapağın adresi kurulum boyunca ekranda KALMAMALI.
    setAlan(null)
    dispatch({ type: 'ARM', kapak })

    const bilgi = await alanlariAl(kapak.sid)
    if (token !== turToken.current) return
    const ilk = bilgi?.ar ? await gorselHazirla(artworkAt(bilgi.ar, KAPAK_BOYUTLARI[0])) : 'dead'
    // ⚠️ Her `await` sonrası token kontrolü: bu arada yeni tur kurulduysa sonuç yutulur.
    if (token !== turToken.current) return

    if (!bilgi?.ar || ilk === 'dead') {
      // ⚠️ Sabit (düello) albüm açılamıyorsa başka albüm denenmez: iki oyuncu
      // aynı albümü oynamalı. Kabuk "Bu turu geç" kaçış kapısını gösterir.
      if (zorlanan) {
        dispatch({ type: 'ARM_FAIL', reason: 'image' })
        return
      }
      void turBaslat(liste, denendi + 1)
      return
    }

    setAlan({ ar: bilgi.ar, u: bilgi.u })
    dispatch({ type: 'ARM_OK' })
  }, [])

  // Tek oyunculu tur.
  useEffect(() => {
    if (dizilim) return
    if (yukleniyor) return
    if (suzulmus.length === 0) {
      dispatch({ type: 'EMPTY_POOL' })
      return
    }
    void turBaslat(suzulmus)
  }, [suzulmus, yukleniyor, turBaslat, dizilim])

  /*
   * Düello turu — AYRI etki.
   *
   * ⚠️ Havuz bağımlılıkları (`suzulmus`, `yukleniyor`) burada YOK: otomatik
   * tamamlama havuzu tur başladıktan sonra inerse, ortak bir etki oynanan turu
   * baştan kurar ve açılmış adımları sıfırlardı.
   */
  const zorlananKapak = dizilim?.[dizilimIndex]
  useEffect(() => {
    if (!dizilim || !zorlananKapak) return
    void turBaslat(dizilim, 0, zorlananKapak)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zorlananKapak?.id, turBaslat])

  // Bir SONRAKİ netlik kademesini önden indir — yalnızca o (bkz. dosya başı).
  const adim = kapakTurIcinde(durum) ? durum.adim : 0
  useEffect(() => {
    if (!alan || adim === 0) return
    const sonrakiBoyut = KAPAK_BOYUTLARI[adim]
    if (sonrakiBoyut) void gorselHazirla(artworkAt(alan.ar, sonrakiBoyut))
  }, [alan, adim])

  // --- eylemler ---
  const yanlisIsle = useCallback((text: string, sameArtist: boolean) => {
    dispatch({ type: 'WRONG', text, sameArtist })
    yanlisHandler.current?.()
  }, [])

  const tahmin = useCallback(
    (raw: string): Verdict<Kapak> => {
      if (!kapakTurIcinde(durum)) return { kind: 'empty' }
      const cevap = kolayAnahtarlar(durum.kapak, kolay)
      const v = judgeGuess(raw, cevap, evren, { easySearch })
      if (v.kind === 'correct') dispatch({ type: 'CORRECT' })
      else if (v.kind === 'wrong') yanlisIsle(raw, v.sameArtist)
      else if (v.kind === 'ambiguous') setBelirsiz(v.candidates)
      return v
    },
    [durum, kolay, evren, easySearch, yanlisIsle],
  )

  const kapakSec = useCallback(
    (k: Kapak) => {
      if (!kapakTurIcinde(durum)) return
      if (k.id === durum.kapak.id) dispatch({ type: 'CORRECT' })
      else yanlisIsle(k.al, k.nA !== '' && k.nA === durum.kapak.nA)
    },
    [durum, yanlisIsle],
  )

  const pas = useCallback(() => {
    if (!kapakTurIcinde(durum)) return
    dispatch({ type: 'SKIP' })
    setBelirsiz(null)
  }, [durum])

  const degistir = useCallback(() => {
    // Düelloda albüm sabit; değiştirmek rakiple farklı albüm oynamak olurdu.
    if (dizilim) return
    void turBaslat(suzulmus)
  }, [suzulmus, turBaslat, dizilim])

  const sonrakiTur = useCallback(() => {
    // ⚠️ Düelloda tur KURULMAZ ve kademe YÜKSELMEZ — sırayı düello sayfası sürüyor.
    if (dizilim) return
    // Bildiyse bir üst kademeye çık; İmkansız'da (5) tavan.
    const cikilan = durum.s === 'won' ? (Math.min(5, kademe + 1) as Difficulty) : kademe
    if (cikilan !== kademe) {
      // ⚠️ `setKademe` çağırıp DÖN: süzgeç yenilenince turu yukarıdaki etki kuruyor.
      setKademe(cikilan)
      return
    }
    void turBaslat(suzulmus)
  }, [durum, kademe, setKademe, suzulmus, turBaslat, dizilim])

  const belirsizligiTemizle = useCallback(() => setBelirsiz(null), [])
  const onYanlis = useCallback((fn: () => void) => {
    yanlisHandler.current = fn
  }, [])

  return {
    durum,
    havuz,
    suzulmus,
    index,
    belirsiz,
    kapakAr: alan?.ar ?? '',
    magazaUrl: alan?.u ?? '',
    tahmin,
    kapakSec,
    pas,
    degistir,
    sonraki: sonrakiTur,
    belirsizligiTemizle,
    onYanlis,
  }
}
