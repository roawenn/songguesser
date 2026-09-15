'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { installResumeHandlers } from '@/audio/context'
import type { ChipId, Difficulty } from '@/data/categories'
import { loadChip } from '@/data/loadPool'
import { alanlariAl, birlestir } from '@/data/loadSongFields'
import { artworkAt, type Song } from '@/data/schema'
import { STEPS } from '@/game/ladder'
import { filterByTier, pickNext } from '@/game/select'
import {
  bosTur, skoraIsle, skorTablosuSanitize, sohbetTahminiDogru, SONRAKI_TUR_MS, yayinReducer,
  type SkorTablosu, type YayinEylem, type YayinTuru,
} from '@/game/yayin'
import type { SohbetMesaji } from '@/lib/sohbet/ayristir'
import { sohbeteBaglan, type BaglantiDurumu, type Platform } from '@/lib/sohbet/baglanti'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * Yayıncı modunun tur döngüsü: havuz, ses, sohbet, zamanlayıcılar.
 *
 * Kurallar `game/yayin.ts`'te (saf, testli); burada yalnızca zamanın ve dış
 * dünyanın (soket, ses motoru, `localStorage`) bağlandığı yer var.
 *
 * ⚠️ Tek oyunculu `useRound`'dan kazanılmış desenler: tur jetonu (`token`) her
 * `await` sonrası kontrol edilir; ölü önizlemede başka şarkı denenir ama sınırlı.
 *
 * ⚠️ SES KİLİDİ: tarayıcı sesi ancak bir tıklamayla açıyor. Kurulum formunun
 * gönderimi ve "Başlat" bu tıklamalar; sonraki klipler zamanlayıcıdan çalıyor ve
 * sayfa bir kez etkileşim gördüğü için izinli.
 *
 * ⚠️ Sohbet mesajı başına React durumu YAZILMAZ. Kalabalık bir yayında saniyede
 * onlarca mesaj geliyor; her biri yeniden çizim olsaydı sahne takılırdı. Mesaj
 * yalnızca DOĞRU ise eylem olur, sayaç ise saniyede bir aktarılır.
 */

export interface YayinAyari {
  platform: Platform
  kanal: string
  /** Yalnızca Kick. */
  chatroomId: number | null
  secki: ChipId
  zorluk: Difficulty
  turSayisi: number
  beklemeSn: number
}

const OLU_URL_SINIRI = 6
/** Açılış kartındaki kapağın istenen boyutu — `YayinShell` ile aynı olmalı, yoksa önyükleme boşa gider. */
export const ACILIS_KAPAK_BOYUTU = 300

const turReducer = (t: YayinTuru<Song>, e: YayinEylem<Song>) => yayinReducer(t, e)

const skorAnahtari = (a: Pick<YayinAyari, 'platform' | 'kanal'>) => `tahmin:yayin-skor:v1:${a.platform}:${a.kanal}`

function skorOku(a: YayinAyari): SkorTablosu {
  try {
    const ham = window.localStorage.getItem(skorAnahtari(a))
    return ham ? skorTablosuSanitize(JSON.parse(ham)) : {}
  } catch {
    return {}
  }
}

function skorYaz(a: YayinAyari, t: SkorTablosu): void {
  try {
    window.localStorage.setItem(skorAnahtari(a), JSON.stringify(t))
  } catch {
    // Depolama kapalıysa tablo bu oturumla sınırlı kalır.
  }
}

export interface YayinApi {
  tur: YayinTuru<Song>
  havuzHazir: boolean
  hata: string | null
  /** Oyun henüz başlatılmadı (kurulumdan sonra "Başlat" bekleniyor). */
  baslamadi: boolean
  bitti: boolean
  skor: SkorTablosu
  baglanti: { durum: BaglantiDurumu; ayrinti?: string }
  mesajSayisi: number
  /** Açılan turdan sonra otomatik geçişin zamanı; yoksa null. */
  sonrakiBitis: number | null

  baslat: () => void
  sonraki: () => void
  ac: () => void
  bitir: () => void
  skoruSifirla: () => void
  /** Yayıncının sohbeti denemesi — gerçek bir sohbet mesajı gibi işlenir. */
  yerelMesaj: (metin: string) => void
}

export function useYayin(ayar: YayinAyari): YayinApi {
  const [tur, dispatch] = useReducer(turReducer, undefined, () => bosTur<Song>())
  const [havuz, setHavuz] = useState<Song[]>([])
  const [havuzHazir, setHavuzHazir] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [baslamadi, setBaslamadi] = useState(true)
  const [bitti, setBitti] = useState(false)
  const [skor, setSkor] = useState<SkorTablosu>(() => skorOku(ayar))
  const [baglanti, setBaglanti] = useState<{ durum: BaglantiDurumu; ayrinti?: string }>({ durum: 'baglaniyor' })
  const [mesajSayisi, setMesajSayisi] = useState(0)
  const [sonrakiBitis, setSonrakiBitis] = useState<number | null>(null)

  const volume = useSettingsStore((s) => s.volume)

  const turRef = useRef(tur)
  turRef.current = tur
  const token = useRef(0)
  const oynanan = useRef(new Set<string>())
  const islenenTur = useRef(0)
  const mesajSayac = useRef(0)

  useEffect(() => installResumeHandlers(), [])
  useEffect(() => clipPlayer.setVolume(volume), [volume])
  useEffect(
    () => () => {
      // Sayfadan çıkınca (ya da ayarlara dönünce) yarım klip çalmaya devam etmesin.
      token.current++
      clipPlayer.stop()
    },
    [],
  )

  // --- havuz ---
  useEffect(() => {
    let iptal = false
    setHavuzHazir(false)
    loadChip(ayar.secki)
      .then((s) => {
        if (iptal) return
        setHavuz(s)
        setHavuzHazir(true)
      })
      .catch(() => {
        if (!iptal) setHata('Şarkı listesi yüklenemedi.')
      })
    return () => {
      iptal = true
    }
  }, [ayar.secki])

  const suzulmus = useMemo(() => filterByTier(havuz, ayar.zorluk), [havuz, ayar.zorluk])
  /** Mesaj işleyici bağımlılıksız; havuzu ref'ten okur (bkz. dosya başı). */
  const evrenRef = useRef<Song[]>([])
  evrenRef.current = suzulmus

  // --- tur kurulumu ---
  const turKur = useCallback(async (turNo: number, denendi = 0): Promise<void> => {
    const benim = ++token.current
    if (denendi >= OLU_URL_SINIRI) {
      setHata('Şarkılar yüklenemedi. Bağlantını kontrol et.')
      return
    }
    const sec = pickNext(evrenRef.current, oynanan.current)
    if (!sec) {
      setHata('Bu seçkide oynanacak şarkı yok.')
      return
    }
    if (sec.recycled) oynanan.current = new Set()
    oynanan.current.add(sec.song.id)
    setHata(null)
    setSonrakiBitis(null)

    const tam = sec.song.p ? sec.song : birlestir(sec.song, await alanlariAl(sec.song.id))
    if (benim !== token.current) return
    if (!tam.p) {
      void turKur(turNo, denendi + 1)
      return
    }

    /*
     * ⚠️ Açılış kapağı ŞİMDİDEN indirilir. Açılışta başlatılınca kare ekranda
     * bir süre boş kalıyordu (ölçüldü) — yayında cevabın en görünür anı o. Görsel
     * ekrana çizilmediği için cevap sızmıyor; ağ sekmesini açan yayıncı zaten
     * cevabı bilen kişi.
     */
    if (tam.ar) new Image().src = artworkAt(tam.ar, ACILIS_KAPAK_BOYUTU)

    dispatch({ type: 'KUR', sarki: tam, turNo })
    const sonuc = await clipPlayer.arm({ id: tam.id, url: tam.p, clipStart: tam.cs, duration: tam.du })
    if (benim !== token.current) return

    if (sonuc === 'ready') dispatch({ type: 'HAZIR' })
    else if (sonuc === 'unsupported') setHata('Tarayıcın bu sesi çalamıyor.')
    else void turKur(turNo, denendi + 1)
  }, [])

  const { faz, adim, turNo, beklemeBitis, sonSansBitis } = tur

  // Çal: kademenin klibi, bitince sohbet için bekleme.
  useEffect(() => {
    if (faz !== 'caliyor') return
    let iptal = false
    void clipPlayer.play(STEPS[adim]!).then(() => {
      // ⚠️ Takılma da "bitti" sayılır: yayında kimse düğmeye basıp tekrar
      // çalmayacak; merdiven durursa oyun kilitlenir.
      if (!iptal) dispatch({ type: 'KLIP_BITTI', simdi: Date.now(), beklemeMs: ayar.beklemeSn * 1000 })
    })
    return () => {
      iptal = true
    }
  }, [faz, adim, turNo, ayar.beklemeSn])

  useEffect(() => {
    if (faz !== 'bekliyor' || beklemeBitis === null) return
    const id = setTimeout(() => dispatch({ type: 'BEKLEME_BITTI' }), Math.max(0, beklemeBitis - Date.now()))
    return () => clearTimeout(id)
  }, [faz, beklemeBitis])

  useEffect(() => {
    if (sonSansBitis === null) return
    const id = setTimeout(() => dispatch({ type: 'SON_SANS_BITTI' }), Math.max(0, sonSansBitis - Date.now()))
    return () => clearTimeout(id)
  }, [sonSansBitis])

  // Açıldı: sesi kes, puanları yaz, sıradaki tura (ya da sonuçlara) geç.
  useEffect(() => {
    if (faz !== 'acildi') return
    clipPlayer.stop()

    // ⚠️ Tur başına TEK yazım: efekt aynı tur için yeniden çalışabilir.
    if (islenenTur.current !== turNo) {
      islenenTur.current = turNo
      const bilenler = turRef.current.bilenler
      if (bilenler.length > 0) {
        setSkor((eski) => {
          const yeni = skoraIsle(eski, bilenler)
          skorYaz(ayar, yeni)
          return yeni
        })
      }
    }

    const son = turNo >= ayar.turSayisi
    setSonrakiBitis(Date.now() + SONRAKI_TUR_MS)
    const id = setTimeout(() => {
      setSonrakiBitis(null)
      if (son) setBitti(true)
      else void turKur(turNo + 1)
    }, SONRAKI_TUR_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faz, turNo])

  // --- sohbet ---
  const mesajIsle = useCallback((m: SohbetMesaji) => {
    mesajSayac.current++
    const t = turRef.current
    if (!t.sarki || (t.faz !== 'caliyor' && t.faz !== 'bekliyor')) return
    if (t.bilenler.some((b) => b.id === m.id)) return
    if (sohbetTahminiDogru(m.metin, t.sarki, evrenRef.current)) {
      dispatch({ type: 'DOGRU', id: m.id, ad: m.ad, simdi: Date.now() })
    }
  }, [])

  useEffect(() => {
    const kapat = sohbeteBaglan(
      ayar.platform === 'twitch'
        ? { platform: 'twitch', kanal: ayar.kanal }
        : { platform: 'kick', chatroomId: ayar.chatroomId ?? 0 },
      { mesaj: mesajIsle, durum: (durum, ayrinti) => setBaglanti({ durum, ayrinti }) },
    )
    const sayac = setInterval(() => setMesajSayisi(mesajSayac.current), 1000)
    return () => {
      kapat()
      clearInterval(sayac)
    }
  }, [ayar.platform, ayar.kanal, ayar.chatroomId, mesajIsle])

  // --- eylemler ---
  const baslat = useCallback(() => {
    clipPlayer.unlockFromGesture()
    setBaslamadi(false)
    setBitti(false)
    islenenTur.current = 0
    void turKur(1)
  }, [turKur])

  const sonraki = useCallback(() => {
    clipPlayer.unlockFromGesture()
    const t = turRef.current
    if (t.turNo >= ayar.turSayisi) {
      token.current++
      setSonrakiBitis(null)
      setBitti(true)
      return
    }
    void turKur(t.turNo + 1)
  }, [ayar.turSayisi, turKur])

  const ac = useCallback(() => dispatch({ type: 'AC' }), [])

  const bitir = useCallback(() => {
    token.current++
    clipPlayer.stop()
    setSonrakiBitis(null)
    dispatch({ type: 'SIFIRLA' })
    setBitti(true)
  }, [])

  const skoruSifirla = useCallback(() => {
    setSkor({})
    skorYaz(ayar, {})
  }, [ayar])

  const yerelMesaj = useCallback(
    (metin: string) => mesajIsle({ id: 'yerel:yayinci', ad: 'Yayıncı', metin }),
    [mesajIsle],
  )

  return {
    tur, havuzHazir, hata, baslamadi, bitti, skor, baglanti, mesajSayisi, sonrakiBitis,
    baslat, sonraki, ac, bitir, skoruSifirla, yerelMesaj,
  }
}
