import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { guvenliDepo } from './guvenliDepo'
import { gecmisSanitize, gecmiseEkle, type GunlukGecmisKaydi } from '@/game/gunlukGecmis'

/**
 * Günlük modun YEREL geçmişi — girişsiz oyuncunun serisi ve başlık rozeti.
 *
 * ⚠️ AYRI ANAHTAR: diğer oyunların istatistiklerine dokunulmuyor. Mantık
 * `game/gunlukGecmis.ts`'te saf ve testli; girişli oyuncunun sunucu geçmişi de
 * aynı seri kuralını kullanıyor.
 *
 * ⚠️ Bu kayıt GÖSTERİM İÇİN. Sıralamaya giden puan sunucuda; buradaki değeri
 * değiştirmek hiçbir şeyi değiştirmez.
 */

interface GunlukStore {
  gecmis: GunlukGecmisKaydi[]
  kaydet: (k: GunlukGecmisKaydi) => void
}

export const useGunlukStore = create<GunlukStore>()(
  persist(
    (set, get) => ({
      gecmis: [],
      kaydet: (k) => {
        const yeni = gecmiseEkle(get().gecmis, k)
        if (yeni.length !== get().gecmis.length) set({ gecmis: yeni })
      },
    }),
    {
      name: 'tahmin:gunluk:v1',
      storage: guvenliDepo,
      partialize: (s) => ({ gecmis: s.gecmis }),
      merge: (persisted, current) => ({
        ...current,
        gecmis: gecmisSanitize((persisted as { gecmis?: unknown } | undefined)?.gecmis),
      }),
    },
  ),
)
