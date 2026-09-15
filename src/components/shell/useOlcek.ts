'use client'

import { useEffect } from 'react'

/**
 * Sahneyi tasarım ölçüsüne göre ORANTILI büyütür ve küçültür.
 *
 * ⚠️ Kırılma noktalı bir ızgara yerine ölçekleme seçildi (kullanıcı kararı):
 * 1500px altında sütun genişlikleri değişince MacBook'ta her şey yer
 * değiştiriyordu. Ölçekle dizilim birebir aynı kalıyor, yalnızca boyu değişiyor.
 *
 * ⚠️ `transform: scale` DEĞİL, `zoom`. `transform` düzeni etkilemez: ölçeklenen
 * eleman hâlâ eski yerini kaplar, sayfa altında kocaman bir boşluk kalır ve
 * kaydırma bozulur. `zoom` düzenin kendisini ölçekler.
 *
 * ⚠️ Çarpan JS'ten geliyor çünkü CSS'te `zoom: calc(100vh / 1050)` yazılamıyor.
 */

/**
 * Izgaranın RAHAT durduğu asgari tasarım genişliği.
 *
 * ⚠️ 1920 DEĞİL. 1920'ye bölmek sahnenin 1920 px'lik bir tuvale çizildiğini
 * varsayıyordu; oysa sütunlar çok daha dar bir alana sığıyordu ve kalan genişlik
 * yanlarda boş kalıyordu (1080p'de %40). Değer: sütunlar 300 + 760 + 300, yan
 * dolgular 2 × 110, en dar aralıklar 2 × 72 (bkz. `.nk-stage-grid`).
 */
const TASARIM_G = 1724

/**
 * Oyun alanının (üst bant + ızgara + footer) ölçek 1'de istediği YÜKSEKLİK.
 *
 * ⚠️ Sayfa HER ekranda bu sayıya takılıyor, genişliğe hiç takılmıyor —
 * yani metin boyutunu fiilen bu değer belirliyor. Eskiden 1215'ti ve 1080p'de
 * 13 px metin 10 px'e iniyordu. Kategoriler üst banttan sol sütuna geçince
 * yüksekliği sahne değil EN UZUN YAN SÜTUN belirlemeye başladı — kaset bu
 * yüzden bütçeye neredeyse dokunmadan geri gelebildi.
 *
 * ⚠️ Değer TAHMİN EDİLMEZ, ölçülür: ölçek 1'e sabitlenip `.nk-scale`
 * çocuklarının doğal yükseklikleri toplanır. `min-height: 100vh/ölçek` ve
 * ortadaki `flex: 1` footer'ı her hâlükârda pencerenin dibine ittiği için
 * "footer altı" ölçümü PENCERE yüksekliğini verir, içeriği değil — bu hataya
 * iki kez düşüldü.
 *
 * ⚠️ İki oyunda TEK DEĞER. Her kabuk kendi bütçesini bildirdiğinde oyun
 * değiştirmek sayfanın tamamını %4 büyütüp küçültüyordu.
 *
 * Ölçüm (ölçek 1, 1920 genişlik, istatistik kartı DOLU — en uzun hâl):
 *   üst bant 147 (marka + oyun seçici) + orta 900 + footer 35 = 1082
 * Orta = sahne kutusu 830 (`.nk-stage` min-height, globals.css) + ızgara
 * dolgusu 36 + üst pay 34. Sütunlar: şarkı sol 808 / sağ 827, ünlü 616 / 699;
 * kasetli şarkı sahnesi 815.
 */
const TASARIM_Y = 1087

/**
 * En fazla büyütme.
 *
 * ⚠️ Eskiden 1 idi: 2K'da sahne, genişliğin %42'si boş bir ekranın ortasında
 * 13 px metinle duruyordu. 1,3 üstünde ince çizgiler ve kart çerçeveleri
 * kabalaşıyor.
 */
const EN_BUYUK = 1.3

/** Bu genişliğin altında ölçeklemiyoruz; mobil düzen devralıyor. */
const MOBIL_ESIK = 900

/**
 * En fazla küçültme.
 *
 * ⚠️ Alt sınır ŞART. 900px'te 0,47'ye inen bir ölçek 13px'lik metni 6px yapar.
 * Bu bir GÜVENLİK EŞİĞİ, tasarım değeri değil: sınıra dayanınca sayfa yine
 * kaydırılabilir kalıyor, yani içerik erişilemez olmuyor.
 */
const EN_KUCUK = 0.58

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
      const ham = Math.min(EN_BUYUK, g / TASARIM_G, window.innerHeight / TASARIM_Y)
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
