import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHIPS, TIERS, type ChipId, type Difficulty } from '@/data/categories'

export interface Settings {
  category: ChipId
  /** Şarkı zorluk kademesi (1 Kolay … 5 İmkansız). */
  tier: Difficulty
  /** Açıkken yazarken öneri listesi çıkar. */
  easySearch: boolean
  volume: number
  /** Spot takibini, makara dönüşünü ve titreşimi durdurur. */
  reduce: boolean

  setCategory: (c: ChipId) => void
  setTier: (t: Difficulty) => void
  setEasySearch: (b: boolean) => void
  setVolume: (n: number) => void
  setReduce: (b: boolean) => void
}

/**
 * localStorage'dan gelen değer güvenilmez: eski sürümden kalmış, elle
 * kurcalanmış ya da bozulmuş olabilir. Geçersiz bir alan doğrudan çökmeye
 * yol açabilir, o yüzden okurken süzülür.
 */
function sanitize(v: unknown): Partial<Settings> {
  const raw = (v ?? {}) as Record<string, unknown>
  const out: Partial<Settings> = {}

  if (CHIPS.some((c) => c.id === raw.category)) out.category = raw.category as ChipId
  if (TIERS.some((t) => t.id === raw.tier)) out.tier = raw.tier as Difficulty
  if (typeof raw.easySearch === 'boolean') out.easySearch = raw.easySearch
  if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) {
    out.volume = raw.volume
  }
  if (typeof raw.reduce === 'boolean') out.reduce = raw.reduce

  return out
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      category: 'karisik',
      tier: 1,
      easySearch: true,
      volume: 0.7,
      reduce: false,

      setCategory: (category) => set({ category }),
      setTier: (tier) => set({ tier }),
      setEasySearch: (easySearch) => set({ easySearch }),
      setVolume: (volume) => set({ volume }),
      setReduce: (reduce) => set({ reduce }),
    }),
    {
      // v3: seviye (giriş biçimi) yerine zorluk kademesi + kolay arama.
      name: 'nakarat:ayarlar:v3',
      partialize: (s) => ({
        category: s.category,
        tier: s.tier,
        easySearch: s.easySearch,
        volume: s.volume,
        reduce: s.reduce,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)
