'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Song } from '@/data/schema'
import type { ChipId } from '@/data/categories'
import {
  BEKLEME_SINIRI_MS, DUELLO_SARKI, kazanan, skorla,
  type DuelloCevap, type DuelloSkor, type DuelloSonuc,
} from '@/game/duel'

/**
 * Düello durumu — sunucuyu yoklayarak sürülür.
 *
 * ⚠️ Supabase Realtime yerine YOKLAMA. İki kişilik bir düelloda tek merak
 * edilen şey "rakip bu şarkıyı bitirdi mi"; bunun için websocket kurmak, üç
 * tabloya RLS okuma politikası açmak (ki o zaman `song_ids` de okunabilir
 * olurdu) ve tarayıcıya ikinci bir istemci indirmek gerekmiyor. Yoklama her
 * ağda çalışır ve sessizce ölmez.
 */

const YOKLAMA_MS = 1500
const GERI_SAYIM_MS = 3000

export type DuelloFaz =
  | 'yukleniyor'
  | 'lobi'
  | 'gerisayim'
  | 'oynaniyor'
  | 'bekleme'
  | 'bitti'
  | 'hata'

interface Durum {
  chip: ChipId
  status: 'bekliyor' | 'oynaniyor' | 'bitti'
  startedAt: string | null
  oyuncuSayisi: number
  slot: 1 | 2 | null
  songs: Song[] | null
  cevaplar: { slot: 1 | 2; song_index: number; won: boolean; heard_seconds: number; listens: number }[]
}

export interface DuelloApi {
  faz: DuelloFaz
  hata: string | null
  kod: string
  slot: 1 | 2 | null
  songs: Song[]
  /** Şu an oynanan şarkının sırası (0..4). */
  aktif: number
  benim: DuelloSkor
  rakip: DuelloSkor
  sonuc: DuelloSonuc
  /** Rakip kaç şarkı bitirdi — lobide ve beklemede gösterilir. */
  rakipIlerleme: number
  /** Şarkı sırasına göre iki oyuncunun sonucu; `null` = henüz cevaplamadı. */
  sonuclar: { benim: boolean | null; rakip: boolean | null }[]
  /** Geri sayımda kalan saniye (3, 2, 1). */
  geriSayim: number
  cevapGonder: (r: { won: boolean; heardSeconds: number; listens: number }) => void
}

/** localStorage anahtarı — her lobi için ayrı gizli anahtar. */
const anahtar = (kod: string) => `tahmin:duello:${kod}`

export function useDuello(kod: string): DuelloApi {
  const [durum, setDurum] = useState<Durum | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [simdi, setSimdi] = useState(() => Date.now())

  const gizli = useRef<string | null>(null)
  /** Bu sıradaki cevap gönderildi mi — çift gönderimi engeller. */
  const gonderilen = useRef(new Set<number>())
  /** Katılma isteği havada mı — iki yoklama aynı anda katılmaya kalkmasın. */
  const katiliyor = useRef(false)
  /** Rakibi beklemeye ne zaman başladık (süre aşımı için). */
  const beklemeBasi = useRef<number | null>(null)

  // Tarayıcıdaki gizli anahtar: kuran kişi zaten sahiptir.
  useEffect(() => {
    try {
      gizli.current = window.localStorage.getItem(anahtar(kod))
    } catch {
      // Gizli pencerede localStorage kapalı olabilir; katılma yolu yine çalışır.
      gizli.current = null
    }
  }, [kod])

  const yokla = useCallback(async () => {
    try {
      const q = gizli.current ? `?gizli=${encodeURIComponent(gizli.current)}` : ''
      const res = await fetch(`/api/duello/${kod}${q}`)
      const d = await res.json()
      if (!res.ok) {
        setHata(d.error ?? 'Düello okunamadı.')
        return
      }

      /*
       * Gizli anahtarım yoksa ve yer varsa otomatik katıl. Arkadaş linke
       * tıkladığında ayrıca bir "katıl" düğmesine basmak zorunda kalmamalı;
       * lobi zaten onun için kuruldu.
       */
      if (!gizli.current && d.oyuncuSayisi < 2) {
        /*
         * ⚠️ Tek uçuş kuralı. İki yoklama üst üste binince ikisi de katılmaya
         * kalkıyor, ikincisi kendi kardeşinin açtığı slot yüzünden 409 alıyor
         * ve oyuncuya bir an "bu düello dolu" yazıyordu — oysa girmişti.
         */
        if (katiliyor.current) return
        katiliyor.current = true
        try {
          const k = await fetch(`/api/duello/${kod}/katil`, { method: 'POST' })
          const kd = await k.json()
          if (k.ok && kd.gizli) {
            gizli.current = kd.gizli
            try {
              window.localStorage.setItem(anahtar(kod), kd.gizli)
            } catch {
              /* kalıcı olmasa da oturum boyunca ref'te duruyor */
            }
            return // sıradaki yoklama şarkılarla gelsin
          }
          if (k.status === 409) setHata('Bu düello dolu.')
          return
        } finally {
          katiliyor.current = false
        }
      }

      setDurum(d as Durum)
      setHata(null)
    } catch {
      // Ağ hıçkırığı yoklamayı durdurmamalı; bir sonraki tur yeniden dener.
    }
  }, [kod])

  useEffect(() => {
    void yokla()
    const id = setInterval(() => {
      setSimdi(Date.now())
      void yokla()
    }, YOKLAMA_MS)
    return () => clearInterval(id)
  }, [yokla])

  /**
   * ⚠️ Şarkı dizisinin KİMLİĞİ sabit kalmalı.
   *
   * Yoklama her 1,5 saniyede taze bir dizi döndürüyor. `useRound`'un tur kurma
   * etkisi hem diziyi hem o anki şarkıyı bağımlılık olarak görüyor; kimlik her
   * yoklamada değişince tur da her yoklamada YENİDEN kuruluyordu — deneme
   * sayacı 1'e dönüyor, klip başa sarıyor ve oyuncu beş hakkını hiç
   * tüketemiyordu. Ayrıca otomatik tamamlama dizini boşuna yeniden kuruluyordu.
   * Kimlikler aynıysa eski diziyi koru.
   */
  const imza = (durum?.songs ?? []).map((s) => s.id).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const songs = useMemo(() => durum?.songs ?? [], [imza])

  const cevaplar: DuelloCevap[] = (durum?.cevaplar ?? []).map((c) => ({
    slot: c.slot,
    songIndex: c.song_index,
    won: c.won,
    heardSeconds: c.heard_seconds,
    listens: c.listens,
  }))

  const slot = durum?.slot ?? null
  const benimSlot: 1 | 2 = slot ?? 1
  const rakipSlot: 1 | 2 = benimSlot === 1 ? 2 : 1

  const benimCevap = cevaplar.filter((c) => c.slot === benimSlot)
  const rakipIlerleme = cevaplar.filter((c) => c.slot === rakipSlot).length
  const aktif = benimCevap.length

  // `cevapGonder` çağrıldığı anda hangi sıradaydık — render'dan bağımsız tut.
  const gonderilenSira = useRef<number | null>(null)
  gonderilenSira.current = aktif < DUELLO_SARKI ? aktif : null

  const cevapGonder = useCallback(
    (r: { won: boolean; heardSeconds: number; listens: number }) => {
      const i = gonderilenSira.current
      if (i === null || gonderilen.current.has(i) || !gizli.current) return
      gonderilen.current.add(i)
      void fetch(`/api/duello/${kod}/cevap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gizli: gizli.current, songIndex: i, ...r }),
      }).then(() => void yokla())
    },
    [kod, yokla],
  )

  // Rakip geride kaldıysa bekleme süresini ölç.
  const bekliyor = aktif > 0 && aktif < DUELLO_SARKI && rakipIlerleme < aktif
  useEffect(() => {
    if (bekliyor) beklemeBasi.current ??= Date.now()
    else beklemeBasi.current = null
  }, [bekliyor])
  const beklemeSuresi = beklemeBasi.current ? simdi - beklemeBasi.current : 0

  const geriSayimKalan = durum?.startedAt
    ? GERI_SAYIM_MS - (simdi - new Date(durum.startedAt).getTime())
    : GERI_SAYIM_MS

  const faz: DuelloFaz = (() => {
    if (hata) return 'hata'
    if (!durum) return 'yukleniyor'
    /**
     * ⚠️ Lobi doluyken gizli anahtarı olmayan biri OYUNCU DEĞİLDİR.
     *
     * Bu kontrol olmadan üçüncü kişi (ya da tarayıcı verisini kaybetmiş bir
     * oyuncu) sonsuza kadar sahte bir "arkadaşın bekleniyor" ekranında kalıyor
     * ve düellonun çoktan başladığını hiç öğrenemiyordu.
     */
    if (!slot && durum.oyuncuSayisi >= 2) return 'hata'
    if (durum.oyuncuSayisi < 2 || !durum.songs) return 'lobi'
    if (geriSayimKalan > 0) return 'gerisayim'
    if (aktif >= DUELLO_SARKI) return 'bitti'
    if (bekliyor && beklemeSuresi < BEKLEME_SINIRI_MS) return 'bekleme'
    return 'oynaniyor'
  })()

  const doluHata = !slot && durum !== null && durum.oyuncuSayisi >= 2

  const benim = skorla(cevaplar, benimSlot)
  const rakip = skorla(cevaplar, rakipSlot)

  const sonuclar = Array.from({ length: DUELLO_SARKI }, (_, i) => ({
    benim: cevaplar.find((c) => c.slot === benimSlot && c.songIndex === i)?.won ?? null,
    rakip: cevaplar.find((c) => c.slot === rakipSlot && c.songIndex === i)?.won ?? null,
  }))

  return {
    faz,
    hata: hata ?? (doluHata ? 'Bu düello dolu — iki oyuncu çoktan başlamış.' : null),
    kod,
    slot,
    songs,
    aktif: Math.min(aktif, DUELLO_SARKI - 1),
    benim,
    rakip,
    sonuc: kazanan(benim, rakip),
    rakipIlerleme,
    sonuclar,
    geriSayim: Math.max(1, Math.ceil(geriSayimKalan / 1000)),
    cevapGonder,
  }
}
