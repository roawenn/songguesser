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

/**
 * Oyun alanının (üst bant + sahne) 1:1 ölçekte istediği YÜKSEKLİK.
 *
 * ⚠️ Ölçek eskiden yalnızca GENİŞLİĞE bakıyordu. 1920 genişlikte çarpan 1
 * çıkıyor, ama 1920×1080 bir monitörde tarayıcı çerçevesinden sonra ~940 px
 * kalıyor: sahne 1035 px istediği için "Geç" ve "Şarkıyı değiştir" ekranın
 * altında kalıyor, her şey yukarıya yapışmış görünüyordu. 2560×1440'ta sorun
 * yok, çünkü orada yükseklik zaten yetiyor — bu yüzden yalnızca ikinci
 * monitörde ortaya çıkıyordu.
 *
 * Değer ölçüldü: üst bant 178 px + sahne 851 px = 1029, üstüne biraz nefes.
 */
const TASARIM_Y = 1050
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
      /*
       * İki kısıt da geçerli: sahne hem yatayda hem dikeyde sığmalı.
       * Hangisi daha darsa ölçeği o belirler.
       */
      const ham = Math.min(1, g / TASARIM_G, window.innerHeight / TASARIM_Y)
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
