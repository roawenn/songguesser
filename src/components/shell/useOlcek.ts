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
 * ⚠️ FOOTER de bu bütçenin içinde. Değilken sayfa, içerik sığsa bile footer
 * kadar kayıyor ve kaydırma çubuğu çıkıyordu.
 *
 * ⚠️ Değer TAHMİN EDİLMEDİ, ölçüldü — ve ölçmek göründüğünden zor.
 *
 * İlk iki deneme yanlış sonuç verdi: `.nk-scale`'in `min-height: 100vh/ölçek`
 * kuralı ve ortadaki `flex: 1` bloğu footer'ı her hâlükârda pencerenin dibine
 * itiyor, dolayısıyla "footer altı" ölçümü içeriğin doğal yüksekliğini değil
 * PENCERE yüksekliğini veriyor. Doğrusu, ölçek 1'e sabitlenip dört parçanın
 * doğal yüksekliğini toplamak:
 *
 *   üst bant 178 + orta 921 + footer 51 = 1150
 *
 * Beş genişlikte ölçüldü (1366/1440/1600/1920/2560), en büyüğü alındı, üstüne
 * biraz nefes bırakıldı.
 *
 * Oyun seçici şeridi bu bütçenin İÇİNDE. Footer satırının içindeyken yükseklik
 * eklemiyordu; ikon + ad + açıklama taşıyan kartlara dönüşüp kendi satırına
 * çıkınca footer 51 → 95 px oldu ve fark buraya yansıtıldı.
 *
 * ⚠️ TEK DEĞER, İKİ OYUN — ve değer İKİ SAHNENİN MAKSİMUMU.
 *
 * Bir ara her kabuk kendi bütçesini bildiriyordu (şarkı 1160, ünlü 1205).
 * Matematiği doğruydu, sonucu şuydu: 1920x1080'de şarkı 0,931, ünlü 0,896
 * ölçekle çiziliyordu. Yani oyuncu alt şeritten oyun değiştirdiğinde marka,
 * kategori çipleri, yan kartlar — SAYFANIN TAMAMI %4 büyüyüp küçülüyordu.
 * "Genel tasarımda kayma" denen şey buydu; iki bütçe, iki ölçek demek.
 *
 * Diğer yön (ünlü sahnesini şarkınınkine sığdırmak) 49 px istiyordu ve o 49 px
 * görselin kendisinden gelirdi: 285 px genişlik → 256. Fotoğraftan tanıma
 * oyununda fotoğrafı %10 küçültmek, iki sayfanın aynı ölçekte olmasından daha
 * pahalı. Bu yüzden bütçe ünlünün ihtiyacı; şarkı sahnesi 1194 px'lik doğal
 * yüksekliğiyle bunun içinde 54 px payla duruyor.
 *
 * ⚠️ İKİ SAHNEDEN BİRİNE BİR ŞEY EKLENİNCE yeniden ölçülmeli. "Arkadaşınla
 * oyna" düğmesi eklendiğinde ünlü 1180 → 1242 olmuştu; ara ölçüm yapılmasaydı
 * BÜTÜN masaüstü boyutlarında 37-51 px taşıyacaktı.
 *
 * Ölçüm (ölçek 1'e sabitlenip `.nk-scale` çocukları toplanarak, 1920 genişlik):
 *   şarkı  178 + 921 + 95 = 1194
 *   ünlü   178 + 970 + 95 = 1243
 */
const TASARIM_Y = 1248
/** Bu genişliğin altında artık ölçeklemiyoruz; mobil düzen devralıyor. */
const MOBIL_ESIK = 900
/**
 * En fazla küçültme.
 *
 * ⚠️ Alt sınır ŞART. 900px'te 0,47'ye inen bir ölçek 13px'lik metni 6px yapar;
 * "aynı görünsün" isteği okunamayan bir sahneye dönüşür. Alt sınırın altında
 * kalan genişlikler mobil düzene düşüyor.
 *
 * ⚠️ Bu bir GÜVENLİK EŞİĞİ, tasarım değeri değil. 0,62'yken 1366x768'lik bir
 * pencerede sahne 6 px taşıyordu (gereken 0,608): son düğme ekranın altında
 * kalıyordu. Sınıra dayanınca sayfa yine kaydırılabilir kalıyor, yani en
 * kötü durumda içerik erişilemez olmuyor.
 *
 * 0,60 → 0,59: oyun seçici eklenince 1280x800'de gereken ölçek 0,5948'e düştü
 * ve 4 px taşma çıktı. Metin farkı %1,7 — taşmaya değmez.
 *
 * 0,59 → 0,58: ünlü sahnesi şarkıdan uzun (1180'e karşı 1150) ve 1280x800
 * küçültülmüş pencerede 0,585 istiyordu.
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
