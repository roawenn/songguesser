'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { loadChip } from '@/data/loadPool'
import { loadKapakChip } from '@/data/loadKapakPool'
import { loadUnluChip } from '@/data/loadUnluPool'
import { kapakSamanligi, type Kapak } from '@/data/kapak'
import type { Song } from '@/data/schema'
import type { Unlu } from '@/data/unlu'
import { STEPS } from '@/game/ladder'
import type { GunlukGorunum, GunlukTurGorunum } from '@/game/gunlukGorunum'
import type { BelirsizAday, GeriBildirim, GunlukHamle } from '@/game/gunlukHamle'
import { cihazOku, cihazYaz } from '@/lib/gunlukAnahtar'
import { olay, olayBirKez } from '@/lib/olay'
import { buildIndex, sarkiSamanligi, type SearchIndex } from '@/text/autocomplete'
import { useGunlukStore } from '@/store/useGunlukStore'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * Günlük modun istemci tarafı — İNCE ve SUNUCU GÜDÜMLÜ.
 *
 * ⚠️ `useRound` / `useUnluTur` / `useKapakTur` KULLANILMIYOR: üçü de cevabı
 * bilip tarayıcıda yargılıyor. Burada tarayıcı cevabı bilmez; her hamle
 * sunucuya gider ve dönen görünüm TEK DOĞRU KAYNAK olur. Yerelde tutulan tek
 * oyun bilgisi dinleme sayacı (kural değil, gösterge).
 *
 * ⚠️ TEK İSTEK KUYRUĞU: bir hamle uçuştayken yenisi GÖNDERİLMEZ, bekletilir
 * (bkz. `bekleyen`). Sunucu zaten idempotent (`sira`), ama aynı `sira` ile
 * gönderilen iki hamlenin ikincisi 409 alıp oyuncuya anlamsız hata gösterirdi.
 */

export type SesDurumu = 'yok' | 'hazirlaniyor' | 'hazir' | 'takildi' | 'desteklenmiyor'

interface Yanit {
  gorunum?: GunlukGorunum | null
  geri?: GeriBildirim
  belirsiz?: BelirsizAday[]
  cakisma?: boolean
  hata?: string
  error?: string
  cihaz?: string
}

async function istek(yol: string, govde?: unknown): Promise<{ status: number; veri: Yanit }> {
  const basliklar: Record<string, string> = {}
  const cihaz = cihazOku()
  if (cihaz) basliklar['x-gunluk-cihaz'] = cihaz
  if (govde !== undefined) basliklar['Content-Type'] = 'application/json'
  const res = await fetch(yol, {
    method: govde === undefined ? 'GET' : 'POST',
    headers: basliklar,
    body: govde === undefined ? undefined : JSON.stringify(govde),
    cache: 'no-store',
  })
  const veri = (await res.json().catch(() => ({}))) as Yanit
  return { status: res.status, veri }
}

export interface GunlukIndeksleri {
  sarki: SearchIndex<Song> | null
  unlu: SearchIndex<Unlu> | null
  kapak: SearchIndex<Kapak> | null
}

/**
 * Otomatik tamamlama evreni: üç oyunun TAM havuzu (bütün kademeler).
 *
 * ⚠️ Kademeye göre süzülmüş bir evren cevabı ele verirdi: zor turda öneri
 * listesinde yalnızca zor şarkılar çıksa aday sayısı bir anda düşerdi.
 */
function useIndeksler(): GunlukIndeksleri {
  const [sarkilar, setSarkilar] = useState<Song[] | null>(null)
  const [unluler, setUnluler] = useState<Unlu[] | null>(null)
  const [kapaklar, setKapaklar] = useState<Kapak[] | null>(null)

  useEffect(() => {
    let iptal = false
    void loadChip('karisik').then((l) => !iptal && setSarkilar(l)).catch(() => {})
    void loadUnluChip('unlu-karisik').then((l) => !iptal && setUnluler(l)).catch(() => {})
    void loadKapakChip('karisik').then((l) => !iptal && setKapaklar(l)).catch(() => {})
    return () => {
      iptal = true
    }
  }, [])

  const sarki = useMemo(() => (sarkilar ? buildIndex(sarkilar, sarkiSamanligi) : null), [sarkilar])
  const unlu = useMemo(() => (unluler ? buildIndex(unluler, (u) => u.nT) : null), [unluler])
  const kapak = useMemo(() => (kapaklar ? buildIndex(kapaklar, kapakSamanligi(false)) : null), [kapaklar])
  return { sarki, unlu, kapak }
}

export interface GunlukApi {
  /** İlk durum okuması bitti mi. */
  hazir: boolean
  /** Arşivden oynanan gün; bugünse null. Arşiv oturumu sıralamaya girmez. */
  arsivGun: string | null
  /** Arşiv günü bulunamadı (son teslimi geçmemiş, seti yok). */
  arsivYok: boolean
  gun: string | null
  /** Sunucu saati − istemci saati (ms): geri sayım ve hız çubuğu için. */
  saatFarki: number
  sonrakiGun: number | null
  gorunum: GunlukGorunum | null
  aktif: GunlukTurGorunum | null
  aktifIndex: number
  bekliyor: boolean
  belirsiz: BelirsizAday[] | null
  hata: string | null
  /** Son hamlenin geri bildirimi (sarsıntı, "doğru!" gibi anlık tepkiler). */
  sonGeri: { geri: GeriBildirim; an: number } | null
  indeksler: GunlukIndeksleri

  ses: SesDurumu
  caliyor: boolean
  listens: number
  heardIndex: number

  basla: () => void
  tahmin: (metin: string) => void
  sec: (id: string) => void
  pas: () => void
  ipucu: () => void
  sonraki: () => void
  cal: () => void
  gorselHazir: () => void
  gorselOlu: () => void
  belirsizligiTemizle: () => void
  yenile: () => void
  onYanlis: (fn: () => void) => void
}

export function useGunluk(arsivGun: string | null = null): GunlukApi {
  const [hazir, setHazir] = useState(false)
  const [arsivYok, setArsivYok] = useState(false)
  const [gun, setGun] = useState<string | null>(null)
  const [saatFarki, setSaatFarki] = useState(0)
  const [sonrakiGun, setSonrakiGun] = useState<number | null>(null)
  const [gorunum, setGorunum] = useState<GunlukGorunum | null>(null)
  const [bekliyor, setBekliyor] = useState(false)
  const [belirsiz, setBelirsiz] = useState<BelirsizAday[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [sonGeri, setSonGeri] = useState<GunlukApi['sonGeri']>(null)

  const [ses, setSes] = useState<SesDurumu>('yok')
  const [listens, setListens] = useState(0)
  const [heardIndex, setHeardIndex] = useState(-1)

  const indeksler = useIndeksler()
  const volume = useSettingsStore((s) => s.volume)
  const kaydet = useGunlukStore((s) => s.kaydet)

  const ucusta = useRef(false)
  const yanlisHandler = useRef<(() => void) | null>(null)
  /** Medyanın elimize geçtiği an ve hazır olma süresi — tur anahtarıyla. */
  const hazirlik = useRef<{ anahtar: string; bas: number; sure: number | null } | null>(null)
  const kurulanSes = useRef<string | null>(null)

  const aktifIndex = gorunum ? gorunum.turlar.length - 1 : -1
  const aktif = gorunum && aktifIndex >= 0 ? gorunum.turlar[aktifIndex]! : null
  const turAnahtari = aktif && gun ? `${gorunum!.gun}:${aktifIndex}:${aktif.medyaVerildi}` : null

  useEffect(() => clipPlayer.setVolume(volume), [volume])

  // --- durum okuma ---
  const yenile = useCallback(() => {
    const once = Date.now()
    void istek(arsivGun ? `/api/gunluk?gun=${arsivGun}` : '/api/gunluk')
      .then(({ status, veri }) => {
        if (arsivGun && status === 404) setArsivYok(true)
        const v = veri as Yanit & { gun?: string; sunucuZamani?: number; sonrakiGun?: number }
        if (v.gun) setGun(v.gun)
        if (typeof v.sunucuZamani === 'number') {
          // Gidiş-dönüşün yarısı kadar düzeltme: yanıt yolda eskidi.
          setSaatFarki(v.sunucuZamani - (once + Date.now()) / 2)
        }
        if (typeof v.sonrakiGun === 'number') setSonrakiGun(v.sonrakiGun)
        setGorunum(v.gorunum ?? null)
        setHata(null)
      })
      .catch(() => setHata('Bağlantı kurulamadı. Sayfayı yenileyip tekrar dene.'))
      .finally(() => setHazir(true))
  }, [arsivGun])

  useEffect(() => {
    yenile()
  }, [yenile])

  // --- tur değişince yerel göstergeleri sıfırla ---
  useEffect(() => {
    if (!turAnahtari) return
    if (hazirlik.current?.anahtar !== turAnahtari) {
      hazirlik.current = { anahtar: turAnahtari, bas: performance.now(), sure: null }
      setListens(0)
      setHeardIndex(-1)
      setBelirsiz(null)
    }
  }, [turAnahtari])

  const hazirOlc = useCallback(() => {
    const h = hazirlik.current
    if (h && h.sure === null) h.sure = performance.now() - h.bas
  }, [])

  // --- hamle ---
  /**
   * Uçuştayken gelen hamle — DÜŞÜRÜLMEZ, yanıttan sonra gönderilir.
   *
   * ⚠️ Eskiden sessizce yok sayılıyordu ve kutu da temizlendiği için oyuncu
   * yazdığının kaybolduğunu görmüyordu. Soğuk sunucuda ilk tahmin ~2 sn
   * sürebiliyor; o arada yazılan ikinci tahmin kayboluyordu. Yalnızca SONUNCU
   * tutulur: sıra (`sira`) yanıtla gelen görünümden hesaplanmalı.
   */
  const bekleyen = useRef<GunlukHamle | { t: 'olu' } | null>(null)

  const gonder = useCallback(
    async (hamle: GunlukHamle | { t: 'olu' }) => {
      if (!gorunum) return
      if (ucusta.current) {
        bekleyen.current = hamle
        return
      }
      const tur = hamle.t === 'sonraki' ? gorunum.turlar.length : gorunum.turlar.length - 1
      const kayit = gorunum.turlar[tur]
      const sira = kayit?.sira ?? 0
      const h = hazirlik.current
      const hazirMs = sira === 0 && h ? Math.round(h.sure ?? performance.now() - h.bas) : undefined

      ucusta.current = true
      setBekliyor(true)
      setHata(null)
      try {
        const { status, veri } = await istek('/api/gunluk/hamle', {
          oturum: gorunum.oturum, tur, sira, hamle, hazirMs,
        })
        if (veri.gorunum) setGorunum(veri.gorunum)
        if (veri.belirsiz) setBelirsiz(veri.belirsiz)
        else if (hamle.t !== 'sec') setBelirsiz(null)
        if (veri.geri) {
          setSonGeri({ geri: veri.geri, an: Date.now() })
          if (veri.geri.kind === 'yanlis') yanlisHandler.current?.()
          if (veri.geri.kind !== 'yanlis') setBelirsiz(null)
        }
        if (status === 429) setHata('Çok hızlı gidiyorsun; biraz bekleyip tekrar dene.')
        else if (status >= 400 && status !== 409) setHata(veri.hata ?? veri.error ?? 'Hamle işlenemedi.')
      } catch {
        setHata('Bağlantı koptu. Tekrar dene — hakkın gitmedi.')
      } finally {
        ucusta.current = false
        setBekliyor(false)
      }
    },
    [gorunum],
  )

  // Bekleyen hamle: yeni görünüm geldikten sonra, tur hâlâ uygunsa gönder.
  useEffect(() => {
    const h = bekleyen.current
    if (bekliyor || !h || !gorunum) return
    bekleyen.current = null
    const surer = aktif?.durum === 'oynaniyor' && gorunum.durum === 'oynaniyor'
    // Tur bu arada bittiyse (ilk tahmin doğruydu) sonraki tahmin anlamsız.
    if (h.t === 'sonraki' ? !surer : surer) void gonder(h)
  }, [bekliyor, gorunum, aktif, gonder])

  const basla = useCallback(() => {
    if (ucusta.current) return
    // ⚠️ Dokunuşun İÇİNDE: iOS ses kilidi ancak kullanıcı hareketiyle açılıyor.
    clipPlayer.unlockFromGesture()
    ucusta.current = true
    setBekliyor(true)
    setHata(null)
    void (async () => {
      try {
        const { status, veri } = await istek('/api/gunluk/basla', arsivGun ? { gun: arsivGun } : {})
        if (veri.cihaz) cihazYaz(veri.cihaz)
        if (!veri.gorunum) {
          setHata(status === 429 ? 'Çok fazla deneme. Biraz bekle.' : (veri.error ?? 'Günlük şu an açılamıyor.'))
          return
        }
        olay('gunluk_basladi', { arsiv: arsivGun !== null })
        let g = veri.gorunum
        setGorunum(g)
        // Yeni oturumsa ilk turu hemen iste — "Başla" tek dokunuş olsun.
        if (g.turlar.length === 0 && g.durum === 'oynaniyor') {
          const r = await istek('/api/gunluk/hamle', {
            oturum: g.oturum, tur: 0, sira: 0, hamle: { t: 'sonraki' },
          })
          if (r.veri.gorunum) g = r.veri.gorunum
          setGorunum(g)
        }
      } catch {
        setHata('Bağlantı kurulamadı. Tekrar dene.')
      } finally {
        ucusta.current = false
        setBekliyor(false)
      }
    })()
  }, [arsivGun])

  // --- ses ---
  const aktifSarki = aktif?.oyun === 'sarki' && aktif.durum === 'oynaniyor' ? aktif : null
  const sesKimligi = aktifSarki && turAnahtari ? `gunluk:${turAnahtari}` : null

  useEffect(() => {
    if (!aktifSarki || !sesKimligi) {
      if (kurulanSes.current) {
        clipPlayer.stop()
        kurulanSes.current = null
      }
      setSes('yok')
      return
    }
    if (kurulanSes.current === sesKimligi) return
    kurulanSes.current = sesKimligi
    setSes('hazirlaniyor')
    const { p, cs, du } = aktifSarki.medya
    // ⚠️ Kimlik OPAK: şarkı kimliği görünümde yok, olmamalı da.
    void clipPlayer.arm({ id: sesKimligi, url: p, clipStart: cs, duration: du }).then((sonuc) => {
      if (kurulanSes.current !== sesKimligi) return
      if (sonuc === 'ready') {
        hazirOlc()
        setSes('hazir')
      } else if (sonuc === 'dead-url') {
        void gonder({ t: 'olu' })
      } else if (sonuc === 'unsupported') {
        setSes('desteklenmiyor')
      } else {
        setSes('takildi')
      }
    })
  }, [aktifSarki, sesKimligi, hazirOlc, gonder])

  const oynatici = useSyncExternalStore(clipPlayer.subscribe, clipPlayer.getSnapshot, clipPlayer.getSnapshot)
  const caliyor = oynatici.status === 'playing' && oynatici.trackId === sesKimligi

  const cal = useCallback(() => {
    if (!aktifSarki || !sesKimligi || caliyor) return
    clipPlayer.unlockFromGesture()
    const track = { id: sesKimligi, url: aktifSarki.medya.p, clipStart: aktifSarki.medya.cs, duration: aktifSarki.medya.du }

    if (ses !== 'hazir') {
      /*
       * ⚠️ iOS: medya adresi sunucu yanıtıyla geldiği için ilk indirme
       * dokunuşun DIŞINDA başladı ve takılmış olabilir. Bu dokunuşun içinden
       * indirmeyi başlatıp yeniden kuruyoruz; çalmak için bir dokunuş daha.
       */
      clipPlayer.primeFromGesture(track)
      kurulanSes.current = null
      setSes('hazirlaniyor')
      void clipPlayer.arm(track).then((sonuc) => {
        kurulanSes.current = sesKimligi
        if (sonuc === 'ready') {
          hazirOlc()
          setSes('hazir')
        } else if (sonuc === 'dead-url') void gonder({ t: 'olu' })
        else setSes(sonuc === 'unsupported' ? 'desteklenmiyor' : 'takildi')
      })
      return
    }

    const kademe = aktifSarki.attempt
    void clipPlayer.play(STEPS[Math.min(kademe, STEPS.length - 1)]!).then((sonuc) => {
      if (sonuc === 'stalled') {
        setSes('takildi')
        return
      }
      if (sonuc === 'completed') {
        setListens((n) => n + 1)
        setHeardIndex((h) => Math.max(h, kademe))
      }
    })
  }, [aktifSarki, sesKimligi, caliyor, ses, hazirOlc, gonder])

  // --- bitiş kaydı ---
  useEffect(() => {
    if (!gorunum || gorunum.durum !== 'bitti' || gorunum.zamanAsimi) return
    const puan = gorunum.puan ?? 0
    const arsiv = !gorunum.sirali
    // Arşiv sonucu da yerelde tutuluyor (arşiv listesinde görünsün) ama seriye sayılmıyor.
    kaydet({ gun: gorunum.gun, puan, turlar: gorunum.turlar.map((t) => t.sonuc?.puan ?? 0), arsiv })
    olayBirKez(`gunluk:${gorunum.gun}:${arsiv}`, 'gunluk_bitti', { puan_kova: Math.floor(puan / 60) * 60, arsiv })
  }, [gorunum, kaydet])

  return {
    hazir,
    arsivGun,
    arsivYok,
    gun,
    saatFarki,
    sonrakiGun,
    gorunum,
    aktif,
    aktifIndex,
    bekliyor,
    belirsiz,
    hata,
    sonGeri,
    indeksler,
    ses,
    caliyor,
    listens,
    heardIndex,
    basla,
    tahmin: useCallback((metin: string) => void gonder({ t: 'tahmin', metin }), [gonder]),
    sec: useCallback((id: string) => void gonder({ t: 'sec', id }), [gonder]),
    pas: useCallback(() => void gonder({ t: 'pas' }), [gonder]),
    ipucu: useCallback(() => void gonder({ t: 'ipucu' }), [gonder]),
    sonraki: useCallback(() => {
      // Sıradaki tur şarkıysa ses kilidi bu dokunuşta açılsın.
      clipPlayer.unlockFromGesture()
      void gonder({ t: 'sonraki' })
    }, [gonder]),
    cal,
    gorselHazir: hazirOlc,
    gorselOlu: useCallback(() => void gonder({ t: 'olu' }), [gonder]),
    belirsizligiTemizle: useCallback(() => setBelirsiz(null), []),
    yenile,
    onYanlis: useCallback((fn: () => void) => {
      yanlisHandler.current = fn
    }, []),
  }
}
