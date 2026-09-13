'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Song } from '@/data/schema'
import type { ChipId } from '@/data/categories'
import { anahtarOku, anahtarYaz } from '@/lib/duelloAnahtar'
import {
  BEKLEME_SINIRI_MS, DUELLO_TUR, kazanan, skorla,
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

/**
 * ⚠️ Kanca artık öğe tipinde JENERİK: şarkı düellosu `Song`, ünlü düellosu
 * `Unlu` geçiriyor. Yoklama, saat kayması, bekleyen cevap yeniden denemesi,
 * terminal hata ve faz makinesi — hiçbirine dokunulmadı; hepsi öğeden bağımsız
 * ve tek tek kazanılmış düzeltmeler.
 */
interface Durum<T> {
  /** Hangi oyun — sunucudan gelir, kabuk seçimini o belirler. */
  oyun: 'sarki' | 'unlu'
  chip: ChipId
  status: 'bekliyor' | 'oynaniyor' | 'bitti'
  startedAt: string | null
  /** Sunucunun o anki saati — istemci saatindeki kaymayı ölçmek için. */
  sunucuZamani: string
  oyuncuSayisi: number
  slot: 1 | 2 | null
  songs: T[] | null
  cevaplar: { slot: 1 | 2; song_index: number; won: boolean; maliyet: number; ikincil: number }[]
}

export interface DuelloApi<T> {
  faz: DuelloFaz
  hata: string | null
  kod: string
  slot: 1 | 2 | null
  songs: T[]
  /** Lobinin oyunu — sahne rengi ve kabuk bunu kullanır. */
  chip: ChipId | null
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
  cevapGonder: (r: { won: boolean; maliyet: number; ikincil: number }) => void
}

export function useDuello<T extends { id: string }>(kod: string): DuelloApi<T> {
  const [durum, setDurum] = useState<Durum<T> | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [simdi, setSimdi] = useState(() => Date.now())

  const gizli = useRef<string | null>(null)
  /** Anahtarı hangi lobi için okuduk — kod değişirse yeniden okunur. */
  const okunanKod = useRef<string | null>(null)
  /** Sunucunun onayladığı sıralar — çift gönderimi engeller. */
  const gonderilen = useRef(new Set<number>())
  /**
   * Sunucuya henüz ULAŞMAMIŞ cevap.
   *
   * ⚠️ Eskiden sıra, istek atılmadan önce "gönderildi" işaretleniyordu ve
   * `.catch` yoktu. Tek bir ağ hıçkırığında indeks sonsuza kadar işaretli
   * kalıyor, `aktif` sunucu satırlarından türediği için hiç ilerlemiyor ve
   * oyuncu kilitli bir turda kalıyordu. Artık işaretleme sunucu onayından
   * sonra; onaya kadar yoklama döngüsü yeniden dener.
   */
  const bekleyenCevap = useRef<{
    songIndex: number
    r: { won: boolean; maliyet: number; ikincil: number }
  } | null>(null)
  const gonderiliyor = useRef(false)
  /**
   * Sunucu saati − istemci saati.
   *
   * ⚠️ Geri sayım ve bekleme süresi, sunucunun yazdığı damgalarla istemcinin
   * `Date.now()`'unu karşılaştırıyor. Saati geri kalmış bir telefonda fark
   * negatif çıkıyor ve geri sayım "603" gibi bir sayıda dakikalarca donuyordu.
   */
  const sapma = useRef(0)
  /** Terminal hata (404/410) alındı mı — yoklama durur. */
  const terminal = useRef(false)
  /** Oyuncu beş turu bitirdi mi — lobi süresi dolsa da sonuç ekranı korunur. */
  const bitmis = useRef(false)
  /** Katılma isteği havada mı — iki yoklama aynı anda katılmaya kalkmasın. */
  const katiliyor = useRef(false)
  /** Rakibi beklemeye ne zaman başladık (süre aşımı için). */
  const beklemeBasi = useRef<number | null>(null)

  /*
   * Tarayıcıdaki gizli anahtar: kuran kişi zaten sahiptir.
   *
   * ⚠️ Okuma `useEffect`'te DEĞİL, render sırasında yapılıyor. Efekt ilk
   * yoklamadan sonra çalışabiliyordu; o aralıkta anahtar `null` görünüyor ve
   * lobiyi kuran kişi kendi lobisine 2. oyuncu olarak katılabiliyordu.
   */
  if (okunanKod.current !== kod) {
    okunanKod.current = kod
    gizli.current = anahtarOku(kod)
  }

  const yokla = useCallback(async () => {
    try {
      // ⚠️ Anahtar BAŞLIKTA. URL'de olduğu sürece her yoklama onu CDN/vekil
      // günlüklerine ve tarayıcı geçmişine yazıyordu.
      const res = await fetch(`/api/duello/${kod}`, {
        headers: gizli.current ? { 'x-duello-gizli': gizli.current } : undefined,
      })
      const d = await res.json()
      if (!res.ok) {
        /**
         * ⚠️ BİTMİŞ bir düelloda 404/410 YOK SAYILIR.
         *
         * Lobi 2 saatte geçersizleşiyor. Oyuncu turunu bitirip sonuç ekranında
         * kalmışsa (çok olağan: rakibini bekliyor ya da listeye bakıyor),
         * süre dolduğu anda 410 geliyor, `hata` yalnızca BAŞARILI bir yoklamayla
         * temizlenebildiği için de asla temizlenemiyordu: kazanan, skorlar ve
         * beş şarkılık liste "Bu lobinin süresi dolmuş." yazısıyla siliniyordu.
         *
         * ⚠️ Ayrıca yoklama DURUR. Terminal bir hatada 1,5 saniyede bir aynı
         * 410'u dövmenin anlamı yok.
         */
        if (res.status === 404 || res.status === 410) {
          terminal.current = true
          if (!bitmis.current) setHata(d.error ?? 'Bu düello artık yok.')
          return
        }
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
            anahtarYaz(kod, kd.gizli)
            return // sıradaki yoklama şarkılarla gelsin
          }
          if (k.status === 409) setHata('Bu düello dolu.')
          return
        } finally {
          katiliyor.current = false
        }
      }

      const gelen = d as Durum<T>
      if (gelen.sunucuZamani) {
        const t = Date.parse(gelen.sunucuZamani)
        if (Number.isFinite(t)) sapma.current = t - Date.now()
      }
      setDurum(gelen)
      setHata(null)
    } catch {
      // Ağ hıçkırığı yoklamayı durdurmamalı; bir sonraki tur yeniden dener.
    }
  }, [kod])

  /** Bekleyen cevabı sunucuya ulaştırmayı dener. Başarısızlıkta sessizce bırakır. */
  const cevapYolla = useCallback(async () => {
    const b = bekleyenCevap.current
    if (!b || gonderiliyor.current || !gizli.current) return
    gonderiliyor.current = true
    try {
      const res = await fetch(`/api/duello/${kod}/cevap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gizli: gizli.current, songIndex: b.songIndex, ...b.r }),
      })
      if (res.ok) {
        gonderilen.current.add(b.songIndex)
        bekleyenCevap.current = null
        await yokla()
      } else if (res.status !== 502 && res.status < 500) {
        /*
         * ⚠️ 4xx KALICI bir rettir (geçersiz sıra, bu düelloda değilsin).
         * Yeniden denemek her yoklamada aynı isteği atan sonsuz bir döngü
         * olurdu; bekleyen düşürülüp oyuncunun ilerlemesine izin veriliyor.
         */
        bekleyenCevap.current = null
      }
    } catch {
      // Ağ hatası: bekleyen duruyor, bir sonraki yoklama yeniden dener.
    } finally {
      gonderiliyor.current = false
    }
  }, [kod, yokla])

  useEffect(() => {
    void yokla()
    const id = setInterval(() => {
      if (terminal.current) return
      setSimdi(Date.now())
      void yokla()
      // Ulaşamamış cevap varsa her turda yeniden denenir.
      void cevapYolla()
    }, YOKLAMA_MS)
    return () => clearInterval(id)
  }, [yokla, cevapYolla])

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
    maliyet: c.maliyet,
    ikincil: c.ikincil,
  }))

  const slot = durum?.slot ?? null
  const benimSlot: 1 | 2 = slot ?? 1
  const rakipSlot: 1 | 2 = benimSlot === 1 ? 2 : 1

  const benimCevap = cevaplar.filter((c) => c.slot === benimSlot)
  const rakipIlerleme = cevaplar.filter((c) => c.slot === rakipSlot).length
  const aktif = benimCevap.length
  // Beş tur bitince lobi süresi dolsa da sonuç ekranı korunur (bkz. `yokla`).
  if (aktif >= DUELLO_TUR) bitmis.current = true

  // `cevapGonder` çağrıldığı anda hangi sıradaydık — render'dan bağımsız tut.
  const gonderilenSira = useRef<number | null>(null)
  gonderilenSira.current = aktif < DUELLO_TUR ? aktif : null

  const cevapGonder = useCallback(
    (r: { won: boolean; maliyet: number; ikincil: number }) => {
      const i = gonderilenSira.current
      if (i === null || gonderilen.current.has(i) || !gizli.current) return
      // Aynı sıra için zaten bir gönderim bekliyorsa üstüne yazma.
      if (bekleyenCevap.current?.songIndex === i) return
      bekleyenCevap.current = { songIndex: i, r }
      void cevapYolla()
    },
    [cevapYolla],
  )

  /**
   * ⚠️ Bekleme YALNIZCA SONDA.
   *
   * Eskiden her şarkıdan sonra rakibin o şarkıyı bitirmesi bekleniyordu: hızlı
   * oyuncu beş kez, her seferinde dakikalarca bekleyebiliyordu ve düello bir
   * oyundan çok sıra beklemeye dönüyordu. Artık herkes kendi hızında beş
   * şarkıyı bitiriyor; tek bekleme noktası sonuç ekranından önce, ki ikisi de
   * kazananı aynı anda görsün.
   */
  const hepsiBitti = aktif >= DUELLO_TUR
  const rakipBitti = rakipIlerleme >= DUELLO_TUR
  const sonBekleme = hepsiBitti && !rakipBitti

  useEffect(() => {
    if (sonBekleme) beklemeBasi.current ??= Date.now()
    else beklemeBasi.current = null
  }, [sonBekleme])
  const beklemeSuresi = beklemeBasi.current ? simdi - beklemeBasi.current : 0

  /** Sunucu saatiyle hizalanmış şimdi. */
  const sunucuSimdi = simdi + sapma.current

  /**
   * ⚠️ İki katmanlı koruma.
   *
   * Kayma telafisi doğru sonucu verir; kelepçe ise telafi bir şekilde yanlış
   * olsa bile (ilk yoklama gelmeden, sunucu damgası bozuksa) geri sayımın
   * 3 saniyeden uzun sürmesini imkânsız kılar. Eskiden saati 10 dakika geri
   * olan bir telefon 96 punto "603" yazan bir ekranda donuyordu.
   */
  const geriSayimKalan = durum?.startedAt
    ? Math.min(
        GERI_SAYIM_MS,
        Math.max(0, GERI_SAYIM_MS - (sunucuSimdi - new Date(durum.startedAt).getTime())),
      )
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
    if (hepsiBitti) {
      /*
       * ⚠️ Süre aşımı ŞART. Rakip oyunu ortada bırakırsa bekleyen oyuncu
       * sonucunu sonsuza kadar göremezdi. Cevaplanmamış şarkılar `skorla`
       * içinde zaten kayıp sayılıyor.
       */
      if (rakipBitti || beklemeSuresi >= BEKLEME_SINIRI_MS) return 'bitti'
      return 'bekleme'
    }
    return 'oynaniyor'
  })()

  const doluHata = !slot && durum !== null && durum.oyuncuSayisi >= 2

  const benim = skorla(cevaplar, benimSlot)
  const rakip = skorla(cevaplar, rakipSlot)

  const sonuclar = Array.from({ length: DUELLO_TUR }, (_, i) => ({
    benim: cevaplar.find((c) => c.slot === benimSlot && c.songIndex === i)?.won ?? null,
    rakip: cevaplar.find((c) => c.slot === rakipSlot && c.songIndex === i)?.won ?? null,
  }))

  return {
    faz,
    /*
     * ⚠️ Metin İKİ durumu birden kapsıyor. Eskiden yalnızca "iki oyuncu çoktan
     * başlamış" yazıyordu ve bu, tarayıcı verisini kaybeden ya da bağlantıyı
     * ikinci bir cihazda açan OYUNCUNUN KENDİSİNE de gösteriliyordu — oysa o,
     * iki oyuncudan biri. Sunucu ikisini ayırt edemiyor; metin ayırt ediyor.
     */
    hata:
      hata ??
      (doluHata
        ? 'Bu düello dolu. Oyunculardan biri sensen, düelloyu başlattığın tarayıcıda devam etmelisin.'
        : null),
    kod,
    slot,
    songs,
    // ⚠️ Lobinin çipi DIŞA VERİLİYOR. Okunuyordu ama API'de yoktu; kabuk sahne
    // rengini yerel ayardan alıyordu, yani davet linkine tıklayan arkadaş
    // düello başka seçkide olsa bile KENDİ son seçkisinin rengini görüyordu.
    chip: durum?.chip ?? null,
    aktif: Math.min(aktif, DUELLO_TUR - 1),
    benim,
    rakip,
    sonuc: kazanan(benim, rakip),
    rakipIlerleme,
    sonuclar,
    geriSayim: Math.max(1, Math.ceil(geriSayimKalan / 1000)),
    cevapGonder,
  }
}
