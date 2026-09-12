import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOS, sanitize, uygula, type Istatistik, type TurSonucu } from '@/game/stats'

/**
 * Kişisel istatistik deposu.
 *
 * ⚠️ `tahmin:ayarlar:v3`'ün İÇİNE eklenmedi, kendi anahtarında duruyor.
 * Oradaki `sanitize` ayar alanlarına göre yazılmış; istatistik karışsaydı
 * hem sürüm yükseltmesi hem doğrulama iki farklı işi aynı anda taşırdı.
 * Ayrıca kullanıcı istatistiğini silmek isteyince ayarları kaybetmemeli.
 *
 * Sayma ve süzme mantığı `@/game/stats`'ta, testli; burada yalnızca kalıcılık
 * ve çift kayıt koruması var.
 */

interface StatsStore extends Istatistik {
  /**
   * Bu oturumda en son kaydedilen turun kimliği.
   *
   * ⚠️ KALICI DEĞİL (`partialize` dışında). React StrictMode geliştirmede
   * efektleri iki kez çalıştırıyor; bileşenin içindeki bir `ref` yeniden
   * bağlanmada sıfırlandığı için tur iki kez sayılıyordu. Depo bileşenden
   * uzun yaşadığı için koruma burada duruyor. Diske yazılsaydı, aynı şarkıyı
   * günler sonra tekrar kazanan oyuncunun turu sessizce yutulurdu.
   */
  sonTur: string | null

  kaydet: (turId: string, t: TurSonucu) => void
  sifirla: () => void
}

export const useStatsStore = create<StatsStore>()(
  persist(
    (set, get) => ({
      ...BOS,
      sonTur: null,

      kaydet: (turId, t) => {
        if (get().sonTur === turId) return
        set({ ...uygula(get(), t), sonTur: turId })
      },

      sifirla: () => set({ ...BOS, sonTur: null }),
    }),
    {
      name: 'tahmin:istatistik:v1',
      partialize: (s) => ({
        oynanan: s.oynanan,
        kazanilan: s.kazanilan,
        kademeDagilimi: s.kademeDagilimi,
        enIyiSaniye: s.enIyiSaniye,
        toplamDinleme: s.toplamDinleme,
        seri: s.seri,
        enIyiSeri: s.enIyiSeri,
        sonOynama: s.sonOynama,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)
