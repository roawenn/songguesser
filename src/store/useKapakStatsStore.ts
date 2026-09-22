import { create } from 'zustand'
import { UNLU_BOS, unluUygula, type UnluIstatistik, type UnluTurSonucu } from '@/game/unluStats'

/**
 * Kapaktan Albüm oyununun kişisel istatistiği — BELLEKTE, kalıcılık HESAPTA.
 *
 * ⚠️ `persist` KALDIRILDI: gerekçesi `useStatsStore`'da yazılı — tarayıcı
 * deposu sayaçları habire sıfırlıyordu. Tek kalıcı yer hesap.
 *
 * ⚠️ Mantık `unluStats.ts`'ten PAYLAŞILIYOR: iki oyunun kuralı aynı (beş adım,
 * en az adımla bilmek rekor) ve sayma orada testli.
 */

interface KapakStatsStore extends UnluIstatistik {
  /** StrictMode çift etki koruması (bkz. `useStatsStore`). */
  sonTur: string | null
  /** Sayaçların hangi hesaptan geldiği — diske YAZILMAZ. */
  hesapId: string | null

  kaydet: (turId: string, t: UnluTurSonucu) => void
  /** Sunucudan gelen (ya da onunla birleştirilmiş) sayaçları yerleştirir. */
  yerlestir: (veri: UnluIstatistik, hesapId: string) => void
  sifirla: () => void
}

export const useKapakStatsStore = create<KapakStatsStore>()((set, get) => ({
  ...UNLU_BOS,
  sonTur: null,
  hesapId: null,

  kaydet: (turId, t) => {
    if (get().sonTur === turId) return
    set({ ...unluUygula(get(), t), sonTur: turId })
  },

  yerlestir: (veri, hesapId) => set({ ...veri, hesapId }),

  sifirla: () => set({ ...UNLU_BOS, sonTur: null }),
}))
