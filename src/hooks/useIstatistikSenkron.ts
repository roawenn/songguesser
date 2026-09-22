'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { BOS, birlestir, sanitize, type Istatistik } from '@/game/stats'
import { UNLU_BOS, unluBirlestir, unluSanitize, type UnluIstatistik } from '@/game/unluStats'
import { useHesap } from '@/hooks/useHesap'
import { useKapakStatsStore } from '@/store/useKapakStatsStore'
import { useStatsStore } from '@/store/useStatsStore'
import { useUnluStatsStore } from '@/store/useUnluStatsStore'

/**
 * İstatistikleri hesapla eşitler — TEK KALICI YER HESAP.
 *
 * Depolar artık `localStorage`'a yazmıyor (gerekçe: `store/useStatsStore`).
 * Sayfa açılışında sayaçlar hesaptan okunuyor, tur bitince hesaba yazılıyor.
 * Girişsiz oyuncuda bu kanca hiçbir şey yapmaz ve kart da çizilmez.
 *
 * ⚠️ ÇİFT SAYIM ARTIK YAPISAL OLARAK İMKÂNSIZ: bellek her sayfa yüklemesinde
 * boş başlıyor, dolayısıyla "bellektekini hesaptakiyle topla" adımı yalnızca
 * bu oturumda oynanmış ve henüz yazılmamış turları ekleyebiliyor. `hesapId`
 * yine de duruyor çünkü kanca bir kereden çok çalışabilir (oturum bilgisi
 * tazelendiğinde); ikinci çalışmada toplama değil kopyalama yapılıyor.
 */

/** Depo değişikliğinden sonra yazma için beklenen süre. */
const YAZ_GECIKME_MS = 1500

type Oyun = 'sarki' | 'unlu' | 'kapak'

/**
 * `persist` döneminden kalan anahtarlar.
 *
 * ⚠️ SON BİR KEZ OKUNUYOR. Tarayıcıda biriktirdiği sayaçları olan oyuncular
 * var; depoyu kapatıp onları sessizce çöpe atmak, "verilerim yine gitti"
 * şikâyetinin ta kendisi olurdu. İlk girişte hesaptakiyle toplanıp yazılıyor,
 * YAZMA BAŞARILI OLUNCA siliniyor — yazma düşerse kayıt yerinde kalıyor ve
 * sonraki denemede yine bulunuyor.
 */
const ESKI_ANAHTAR: Record<Oyun, string> = {
  sarki: 'tahmin:istatistik:v1',
  unlu: 'tahmin:unlu-istatistik:v1',
  kapak: 'tahmin:kapak-istatistik:v1',
}

/** Kartların "hesaptan daha okumadık" durumunu ayırt etmesi için. */
interface DurumStore {
  okundu: boolean
  bitti: () => void
}

export const useIstatistikDurum = create<DurumStore>()((set) => ({
  okundu: false,
  bitti: () => set({ okundu: true }),
}))

function eskiKayit(oyun: Oyun): unknown {
  try {
    const ham = window.localStorage.getItem(ESKI_ANAHTAR[oyun])
    if (!ham) return undefined
    // zustand `persist` biçimi: { state: {...}, version: n }
    const v = JSON.parse(ham) as { state?: unknown }
    return v?.state
  } catch {
    return undefined
  }
}

function eskiKayitSil(oyun: Oyun): void {
  try {
    window.localStorage.removeItem(ESKI_ANAHTAR[oyun])
  } catch {
    // Site verisi engelliyse zaten okunamamıştı.
  }
}

/**
 * Bir oyunun deposuna açılan kapı.
 *
 * ⚠️ Yöntemler `unknown` alıp veriyor, tip parametresi `kur`'un İÇİNDE
 * kalıyor: üç depo iki farklı sayaç şekli taşıyor (şarkıda "en iyi saniye",
 * diğerlerinde "en iyi şerit") ve tek bir dizide dolaşılınca birleşim tipi
 * `birlestir`'i çağrılamaz hâle getiriyor.
 */
interface Kapi {
  oyun: Oyun
  /** Hesaptan geleni (ve varsa eski yerel kaydı) yerelle eşitler. */
  esitle: (ham: unknown, eski: unknown, anahtar: string) => unknown | null
  /** Gönderilecek güncel sayaçlar ve deponun bağlı olduğu hesap. */
  guncel: () => { veri: unknown; hesapId: string | null }
  abone: (f: () => void) => () => void
}

interface Depo<T> {
  getState: () => T & { hesapId: string | null; yerlestir: (veri: T, hesapId: string) => void }
  subscribe: (f: () => void) => () => void
}

function kur<T extends { oynanan: number }>(
  oyun: Oyun,
  depo: Depo<T>,
  suz: (v: unknown) => T,
  kaynastir: (a: T, b: T) => T,
  bos: T,
): Kapi {
  return {
    oyun,
    guncel: () => {
      const s = depo.getState()
      return { veri: suz(s), hesapId: s.hesapId }
    },
    abone: (f) => depo.subscribe(f),
    esitle: (ham, eski, anahtar) => {
      const s = depo.getState()
      const yerel = suz(s)
      const sunucu = ham === undefined ? bos : suz(ham)

      /*
       * ⚠️ İkinci çalışmada (oturum bilgisi tazelendi) TOPLAMA YOK. Yerel
       * ileride olabilir — çevrimdışı ya da yazması düşmüş turlar — o yüzden
       * körü körüne sunucu da alınmıyor; çok turu olan kazanıyor.
       */
      if (s.hesapId === anahtar) {
        const yeni = yerel.oynanan > sunucu.oynanan ? yerel : sunucu
        s.yerlestir(yeni, anahtar)
        return yeni.oynanan > sunucu.oynanan ? yeni : null
      }

      const yeni = kaynastir(kaynastir(yerel, sunucu), eski === undefined ? bos : suz(eski))
      s.yerlestir(yeni, anahtar)
      return yeni.oynanan > sunucu.oynanan ? yeni : null
    },
  }
}

const KAPILAR: readonly Kapi[] = [
  kur('sarki', useStatsStore, sanitize, birlestir, BOS),
  kur('unlu', useUnluStatsStore, unluSanitize, unluBirlestir, UNLU_BOS),
  kur('kapak', useKapakStatsStore, unluSanitize, unluBirlestir, UNLU_BOS),
]

async function yaz(oyun: Oyun, veri: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/istatistik', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oyun, veri }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function useIstatistikSenkron(): void {
  const { yuklendi, kullanici } = useHesap()

  useEffect(() => {
    if (!yuklendi) return
    if (!kullanici) {
      // Misafirde okunacak bir şey yok; kartlar "giriş yap" çağrısına düşsün.
      useIstatistikDurum.getState().bitti()
      return
    }

    let iptal = false
    const zamanlayicilar = new Map<Oyun, ReturnType<typeof setTimeout>>()
    const cozucular: (() => void)[] = []

    void fetch('/api/istatistik', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('istek'))))
      .then((v: { istatistik?: Record<string, unknown> | null; anahtar?: string }) => {
        if (iptal || !v.anahtar || !v.istatistik) return
        const anahtar = v.anahtar

        for (const kapi of KAPILAR) {
          const eski = eskiKayit(kapi.oyun)
          const yazilacak = kapi.esitle(v.istatistik[kapi.oyun], eski, anahtar)
          if (yazilacak === null) {
            // Taşınacak bir şey yoksa eski kayıt da yerinde durmasın.
            if (eski !== undefined) eskiKayitSil(kapi.oyun)
            continue
          }
          void yaz(kapi.oyun, yazilacak).then((ok) => {
            if (ok && eski !== undefined) eskiKayitSil(kapi.oyun)
          })
        }

        // Okuma bittikten SONRA abone ol: yerleştirmelerimiz yazma tetiklemesin.
        for (const kapi of KAPILAR) {
          cozucular.push(
            kapi.abone(() => {
              const mevcut = zamanlayicilar.get(kapi.oyun)
              if (mevcut) clearTimeout(mevcut)
              zamanlayicilar.set(
                kapi.oyun,
                setTimeout(() => {
                  const { veri, hesapId } = kapi.guncel()
                  if (hesapId === anahtar) void yaz(kapi.oyun, veri)
                }, YAZ_GECIKME_MS),
              )
            }),
          )
        }
      })
      .catch(() => undefined)
      .finally(() => {
        // Hata olsa bile kartlar sonsuza kadar "yükleniyor" demesin.
        if (!iptal) useIstatistikDurum.getState().bitti()
      })

    return () => {
      iptal = true
      for (const t of zamanlayicilar.values()) clearTimeout(t)
      for (const c of cozucular) c()
    }
  }, [yuklendi, kullanici])
}
