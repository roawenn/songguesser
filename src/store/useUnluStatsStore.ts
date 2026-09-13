import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { guvenliDepo } from './guvenliDepo'
import {
  UNLU_BOS, unluSanitize, unluUygula, type UnluIstatistik, type UnluTurSonucu,
} from '@/game/unluStats'

/**
 * Ünlü oyununun kişisel istatistiği.
 *
 * ⚠️ Şarkı istatistiğine (`tahmin:istatistik:v1`) HİÇ DOKUNULMUYOR — ayrı
 * anahtar, sıfır göç, sıfır veri kaybı. Aynı depoda tutmak "en iyi saniye" ve
 * "toplam dinleme" gibi ses alanlarını ünlü turlarında anlamsız bırakır,
 * yüzdeleri de karıştırırdı.
 *
 * `guvenliDepo` paylaşılıyor: tek kuyruk, tek `pagehide` boşaltması.
 */

interface UnluStatsStore extends UnluIstatistik {
  /**
   * ⚠️ KALICI DEĞİL (`partialize` dışında). React StrictMode efektleri iki kez
   * çalıştırıyor; bileşen içindeki bir `ref` yeniden bağlanmada sıfırlandığı
   * için tur iki kez sayılıyordu. Depo bileşenden uzun yaşadığı için koruma
   * burada. Diske yazılsaydı aynı kişiyi günler sonra tekrar bilen oyuncunun
   * turu sessizce yutulurdu.
   */
  sonTur: string | null

  kaydet: (turId: string, t: UnluTurSonucu) => void
  sifirla: () => void
}

export const useUnluStatsStore = create<UnluStatsStore>()(
  persist(
    (set, get) => ({
      ...UNLU_BOS,
      sonTur: null,

      kaydet: (turId, t) => {
        if (get().sonTur === turId) return
        set({ ...unluUygula(get(), t), sonTur: turId })
      },

      sifirla: () => set({ ...UNLU_BOS, sonTur: null }),
    }),
    {
      name: 'tahmin:unlu-istatistik:v1',
      storage: guvenliDepo,
      partialize: (s) => ({
        oynanan: s.oynanan,
        kazanilan: s.kazanilan,
        kademeDagilimi: s.kademeDagilimi,
        enIyiSerit: s.enIyiSerit,
        seri: s.seri,
        enIyiSeri: s.enIyiSeri,
        sonOynama: s.sonOynama,
      }),
      merge: (persisted, current) => ({ ...current, ...unluSanitize(persisted) }),
    },
  ),
)
