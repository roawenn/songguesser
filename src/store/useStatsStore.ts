import { create } from 'zustand'
import { BOS, uygula, type Istatistik, type TurSonucu } from '@/game/stats'

/**
 * Kişisel istatistik deposu — BELLEKTE, kalıcılık HESAPTA.
 *
 * ⚠️ `persist` KALDIRILDI ve bu bilinçli bir geri adım. Sayaçlar
 * `localStorage`'da tutuluyordu ve orası güvenilmez bir yer olduğunu pratikte
 * gösterdi: özel sekme, site verisi temizliği, kota dolması ve alan adı
 * değişikliği (tahmin.net → tahmin.in) sayıları habire sıfırlıyordu. Oyuncu
 * için "istatistiğim yine gitti" demek olan bu davranış, kaydın kendisinden
 * daha kötüydü.
 *
 * Artık tek kalıcı yer hesap: girişli oyuncuda tur bitince sunucuya yazılıyor
 * ve sayfa açılışında oradan okunuyor (bkz. `hooks/useIstatistikSenkron`).
 * Bu depo yalnızca o okumanın BELLEKTEKİ kopyası; sayfa yenilenince boşalması
 * beklenen davranış, çünkü hemen ardından hesaptan doluyor.
 *
 * ⚠️ MİSAFİRDE SAYAÇ GÖSTERİLMEZ. Girişsiz oyuncuda burası yine doluyor (tur
 * bitiyor, `kaydet` çalışıyor) ama kart çizilmiyor: yarım kalacak, sayfa
 * yenilenince kaybolacak bir sayıyı göstermek, hiç göstermemekten daha çok
 * yanıltıyor (bkz. `components/hesap/IstatistikParcalari`).
 *
 * Sayma mantığı `@/game/stats`'ta, testli; burada yalnızca çift kayıt koruması.
 */

interface StatsStore extends Istatistik {
  /**
   * Bu oturumda en son kaydedilen turun kimliği.
   *
   * ⚠️ React StrictMode geliştirmede efektleri iki kez çalıştırıyor;
   * bileşenin içindeki bir `ref` yeniden bağlanmada sıfırlandığı için tur iki
   * kez sayılıyordu. Depo bileşenden uzun yaşadığı için koruma burada.
   */
  sonTur: string | null

  /**
   * Sayaçların hangi hesaptan geldiği.
   *
   * ⚠️ Artık DİSKE YAZILMIYOR: sayfa her açıldığında `null` başlıyor ve ilk
   * okumada doluyor. Bellek her yüklemede boş başladığı için "hesaptakiyle
   * topla" adımı aynı turları ikinci kez sayamaz.
   */
  hesapId: string | null

  kaydet: (turId: string, t: TurSonucu) => void
  /** Sunucudan gelen (ya da onunla birleştirilmiş) sayaçları yerleştirir. */
  yerlestir: (veri: Istatistik, hesapId: string) => void
  sifirla: () => void
}

export const useStatsStore = create<StatsStore>()((set, get) => ({
  ...BOS,
  sonTur: null,
  hesapId: null,

  kaydet: (turId, t) => {
    if (get().sonTur === turId) return
    set({ ...uygula(get(), t), sonTur: turId })
  },

  yerlestir: (veri, hesapId) => set({ ...veri, hesapId }),

  sifirla: () => set({ ...BOS, sonTur: null }),
}))
