'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { type Difficulty } from '@/data/categories'
import { KAPAK_BOYUTLARI, kapakSamanligi, kolayAnahtarlar, type Kapak } from '@/data/kapak'
import { loadKapakChip } from '@/data/loadKapakPool'
import { alanlariAl } from '@/data/loadSongFields'
import { artworkAt } from '@/data/schema'
import { kapakReducer, kapakTurIcinde, type KapakDurum } from '@/game/kapakMachine'
import { filterByTier, pickNext } from '@/game/select'
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

/** Ölü kapakta art arda en fazla kaç albüm denenir. */
const OLU_KAPAK_SINIR = 6
/** `img.decode()` askıda kalırsa tur sonsuza kadar beklemesin. */
const DECODE_ZAMAN_ASIMI = 10_000

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

async function gorselHazirla(url: string): Promise<'ready' | 'dead'> {
  const img = new Image()
  img.decoding = 'async'
  // ⚠️ `src` ÖNCE atanmalı: bazı tarayıcılarda `decode()` kaynaksız reddediyor.
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

export function useKapakTur(): KapakTurApi {
  const [durum, dispatch] = useReducer(kapakReducer, { s: 'booting' } as KapakDurum)
  const [havuz, setHavuz] = useState<Kapak[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [belirsiz, setBelirsiz] = useState<Kapak[] | null>(null)
  const [alan, setAlan] = useState<{ ar: string; u: string } | null>(null)

  const kategori = useSettingsStore((s) => s.kapakCategory)
  const kademe = useSettingsStore((s) => s.kapakTier)
  const kolay = useSettingsStore((s) => s.kapakKolay)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const setKademe = useSettingsStore((s) => s.setKapakTier)

  const oynanan = useRef<Set<string>>(new Set())
  const turToken = useRef(0)
  const yanlisHandler = useRef<(() => void) | null>(null)

  // --- havuz ---
  useEffect(() => {
    let iptal = false
    setYukleniyor(true)
    // ⚠️ Seçki değişince ESKİ TUR HEMEN DÜŞER: eski kapak ekranda kalıp tahmin edilmesin.
    dispatch({ type: 'RESET' })
    setAlan(null)
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
        dispatch({ type: 'ARM_FAIL', reason: 'pool' })
      })

    return () => {
      iptal = true
    }
  }, [kategori])

  const suzulmus = useMemo(() => filterByTier(havuz, kademe), [havuz, kademe])

  /**
   * Otomatik tamamlama ve eşleştirme evreni — kolay moda göre anahtarlanmış.
   *
   * ⚠️ Oynanan albüm süzgeç dışında kalabilir (kademe genişletmesi); evrende
   * olmazsa "Kolay arama" açık oyuncu doğru cevabı öneride göremez.
   */
  const evren = useMemo(() => {
    const taban =
      (kapakTurIcinde(durum) || durum.s === 'won' || durum.s === 'lost') &&
      !suzulmus.some((k) => k.id === durum.kapak.id)
        ? [...suzulmus, durum.kapak]
        : suzulmus
    return taban.map((k) => kolayAnahtarlar(k, kolay))
  }, [suzulmus, durum, kolay])

  const index = useMemo(
    () => (evren.length > 0 ? buildIndex(evren, kapakSamanligi(kolay)) : null),
    [evren, kolay],
  )

  // --- tur kurulumu ---
  const turBaslat = useCallback(async (liste: Kapak[], denendi = 0) => {
    const token = ++turToken.current
    if (denendi >= OLU_KAPAK_SINIR) {
      dispatch({ type: 'ARM_FAIL', reason: 'offline' })
      return
    }

    const sec = pickNext(liste, oynanan.current)
    if (!sec) {
      dispatch({ type: 'EMPTY_POOL' })
      return
    }
    if (sec.recycled) oynanan.current = new Set()
    const kapak = sec.song
    oynanan.current.add(kapak.id)
    setBelirsiz(null)
    // ⚠️ Önceki kapağın adresi kurulum boyunca ekranda KALMAMALI.
    setAlan(null)
    dispatch({ type: 'ARM', kapak })

    const bilgi = await alanlariAl(kapak.sid)
    if (token !== turToken.current) return
    if (!bilgi?.ar) {
      void turBaslat(liste, denendi + 1)
      return
    }

    const ilk = await gorselHazirla(artworkAt(bilgi.ar, KAPAK_BOYUTLARI[0]))
    // ⚠️ Her `await` sonrası token kontrolü: bu arada yeni tur kurulduysa sonuç yutulur.
    if (token !== turToken.current) return
    if (ilk === 'dead') {
      void turBaslat(liste, denendi + 1)
      return
    }

    setAlan({ ar: bilgi.ar, u: bilgi.u })
    dispatch({ type: 'ARM_OK' })
  }, [])

  useEffect(() => {
    if (yukleniyor) return
    if (suzulmus.length === 0) {
      dispatch({ type: 'EMPTY_POOL' })
      return
    }
    void turBaslat(suzulmus)
  }, [suzulmus, yukleniyor, turBaslat])

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
    void turBaslat(suzulmus)
  }, [suzulmus, turBaslat])

  const sonrakiTur = useCallback(() => {
    // Bildiyse bir üst kademeye çık; İmkansız'da (5) tavan.
    const cikilan = durum.s === 'won' ? (Math.min(5, kademe + 1) as Difficulty) : kademe
    if (cikilan !== kademe) {
      // ⚠️ `setKademe` çağırıp DÖN: süzgeç yenilenince turu yukarıdaki etki kuruyor.
      setKademe(cikilan)
      return
    }
    void turBaslat(suzulmus)
  }, [durum, kademe, setKademe, suzulmus, turBaslat])

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
