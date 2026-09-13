import { createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

/**
 * Çökmeyen ve kısıtlamalı `localStorage` adaptörü.
 *
 * İki sorunu birden çözüyor:
 *
 * ⚠️ **Fırlatan `setItem` uygulamayı öldürüyordu.** zustand'ın `persist`
 * ara katmanı her `set()` çağrısında eşzamanlı `storage.setItem` yapıyor ve
 * `createJSONStorage` yalnızca `window.localStorage`'a *erişimi* koruyor,
 * yazmayı değil. Safari Gizli Gezinti'de ve kota dolduğunda `setItem`
 * `QuotaExceededError` fırlatıyor; ilk tur bitince istatistik yazması bir
 * efektin içinden geldiği için hata efektten dışarı çıkıyor, hata sınırı
 * olmadığından React tüm ağacı söküyor ve oyuncu **oyun ortasında boş sayfa**
 * görüyordu.
 *
 * ⚠️ **Her `set()` diske yazıyordu.** Ses kaydırıcısı sürüklenirken bu, işaretçi
 * olayı hızında (120-1000 Hz) eşzamanlı, ana iş parçacığını bloklayan bir disk
 * yazması demekti. Yazmalar artık arka kenarda toplanıyor.
 *
 * ⚠️ `getItem` SENKRON kalmalı. `ClientGame` ilk render'da kategorinin doğru
 * olmasına güveniyor (yoksa yanlış seçki için boşuna bir havuz isteği gider);
 * asenkron bir okuma o değişmezi bozardı.
 */

const BEKLE_MS = 200

function ham(): Storage | null {
  try {
    return window.localStorage
  } catch {
    // Sunucuda `window` yok; tarayıcıda site verisi engellenmiş olabilir.
    return null
  }
}

const bekleyen = new Map<string, string>()
let zamanlayici: ReturnType<typeof setTimeout> | null = null

function bosalt() {
  if (zamanlayici) {
    clearTimeout(zamanlayici)
    zamanlayici = null
  }
  if (bekleyen.size === 0) return

  const s = ham()
  if (s) {
    for (const [k, v] of bekleyen) {
      try {
        s.setItem(k, v)
      } catch {
        // Kota dolu ya da yazma engelli: oyun bundan etkilenmemeli.
      }
    }
  }
  bekleyen.clear()
}

if (typeof window !== 'undefined') {
  // Sekme kapanırken bekleyen son yazma kaybolmasın.
  window.addEventListener('pagehide', bosalt)
}

const adaptor: StateStorage = {
  getItem: (ad) => {
    try {
      return ham()?.getItem(ad) ?? null
    } catch {
      return null
    }
  },
  setItem: (ad, deger) => {
    bekleyen.set(ad, deger)
    if (zamanlayici) return
    zamanlayici = setTimeout(() => {
      zamanlayici = null
      bosalt()
    }, BEKLE_MS)
  },
  removeItem: (ad) => {
    bekleyen.delete(ad)
    try {
      ham()?.removeItem(ad)
    } catch {
      // yok say
    }
  },
}

/** Her iki kalıcı depo da bunu paylaşır — tek kuyruk, tek `pagehide` dinleyicisi. */
export const guvenliDepo = createJSONStorage(() => adaptor)
