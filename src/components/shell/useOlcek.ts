'use client'

import { useEffect } from 'react'

/**
 * Sahneyi 1920×1080 tasarımına göre ORANTILI küçültür.
 *
 * ⚠️ Kırılma noktalı bir ızgara yerine ölçekleme seçildi (kullanıcı kararı):
 * 1500px altında sütun genişlikleri değişince MacBook'ta her şey yer
 * değiştiriyordu. Ölçekle dizilim birebir aynı kalıyor, yalnızca küçülüyor.
 *
 * ⚠️ `transform: scale` DEĞİL, `zoom`. `transform` düzeni etkilemez: ölçeklenen
 * eleman hâlâ eski yerini kaplar, sayfa altında kocaman bir boşluk kalır ve
 * kaydırma bozulur. `zoom` düzenin kendisini ölçekler — çocuklar küçülen
 * ölçüde dizilir — ve bugün tüm güncel tarayıcılarda destekleniyor.
 *
 * ⚠️ Çarpan JS'ten geliyor çünkü CSS'te `zoom: calc(100vw / 1920)` yazılamıyor.
 * Kırılma noktalı medya sorguları basamaklı bir küçülme verirdi; sürekli
 * ölçek her genişlikte tasarımın oranını koruyor.
 */

/** Tasarımın referans genişliği. */
const TASARIM_G = 1920
/** Bu genişliğin altında artık ölçeklemiyoruz; mobil düzen devralıyor. */
const MOBIL_ESIK = 900
/**
 * En fazla küçültme.
 *
 * ⚠️ Alt sınır ŞART. 900px'te 0,47'ye inen bir ölçek 13px'lik metni 6px yapar;
 * "aynı görünsün" isteği okunamayan bir sahneye dönüşür. Alt sınırın altında
 * kalan genişlikler mobil düzene düşüyor.
 */
const EN_KUCUK = 0.62

export function useOlcek(): void {
  useEffect(() => {
    const kok = document.documentElement

    const uygula = () => {
      const g = window.innerWidth
      if (g < MOBIL_ESIK) {
        kok.style.removeProperty('--nk-olcek')
        kok.removeAttribute('data-olcek')
        return
      }
      const ham = Math.min(1, g / TASARIM_G)
      const olcek = Math.max(EN_KUCUK, ham)
      kok.style.setProperty('--nk-olcek', String(Math.round(olcek * 1000) / 1000))
      kok.setAttribute('data-olcek', olcek < 1 ? 'kucuk' : 'tam')
    }

    uygula()
    window.addEventListener('resize', uygula)
    return () => {
      window.removeEventListener('resize', uygula)
      kok.style.removeProperty('--nk-olcek')
      kok.removeAttribute('data-olcek')
    }
  }, [])
}
