import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { guvenliDepo } from './guvenliDepo'
import {
  UNLU_BOS, unluSanitize, unluUygula, type UnluIstatistik, type UnluTurSonucu,
} from '@/game/unluStats'

/**
 * Kapaktan Albüm oyununun kişisel istatistiği.
 *
 * ⚠️ Mantık `unluStats.ts`'ten PAYLAŞILIYOR: iki oyunun kuralı aynı (beş adım,
 * en az adımla bilmek rekor) ve sayma/süzme orada testli. `enIyiSerit` alanı
 * burada "en az adımla bilinen albüm" anlamına geliyor; ad tarihsel.
 *
 * ⚠️ AYRI ANAHTAR: şarkı ve ünlü istatistiklerine dokunulmuyor, yüzdeler
 * karışmıyor.
 */

interface KapakStatsStore extends UnluIstatistik {
  /**
   * ⚠️ KALICI DEĞİL: StrictMode çift etki koruması (bkz. `useUnluStatsStore`).
   */
  sonTur: string | null
  kaydet: (turId: string, t: UnluTurSonucu) => void
  sifirla: () => void
}

export const useKapakStatsStore = create<KapakStatsStore>()(
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
      name: 'tahmin:kapak-istatistik:v1',
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
