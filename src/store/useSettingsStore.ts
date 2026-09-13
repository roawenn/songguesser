import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { guvenliDepo } from './guvenliDepo'
import {
  CHIPS, TIERS, UNLU_CHIPS, type ChipId, type Difficulty, type UnluChipId,
} from '@/data/categories'

export interface Settings {
  category: ChipId
  /** Şarkı zorluk kademesi (1 Kolay … 5 İmkansız). */
  tier: Difficulty
  /**
   * Ünlü oyununun seçkisi ve kademesi.
   *
   * ⚠️ AYRI alanlar, ayrı depo DEĞİL. Sürüm anahtarını değiştirmek
   * (`v3` → `v4`) mevcut oyuncunun seçkisini, kademesini ve ses düzeyini
   * sessizce sıfırlardı: `persist` yalnızca kendi adını okur. `sanitize`
   * eksik alanları zaten varsayılana düşürdüğü için yeni alanlar geriye dönük
   * uyumlu — sıfır göç kodu, sıfır risk.
   *
   * Şarkıda "Uzman" olan biri ünlüye "Kolay"dan başlasın diye kademeler ayrı.
   * `easySearch`, `reduce` ve `volume` ORTAK kalıyor (`volume` yalnızca
   * şarkıda kullanılıyor ama oyuna özgü bir tercih değil).
   */
  unluCategory: UnluChipId
  unluTier: Difficulty
  /** Açıkken yazarken öneri listesi çıkar. */
  easySearch: boolean
  volume: number
  /** Spot takibini, makara dönüşünü ve titreşimi durdurur. */
  reduce: boolean

  setCategory: (c: ChipId) => void
  setTier: (t: Difficulty) => void
  setUnluCategory: (c: UnluChipId) => void
  setUnluTier: (t: Difficulty) => void
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
  if (UNLU_CHIPS.some((c) => c.id === raw.unluCategory)) {
    out.unluCategory = raw.unluCategory as UnluChipId
  }
  if (TIERS.some((t) => t.id === raw.unluTier)) out.unluTier = raw.unluTier as Difficulty
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
      unluCategory: 'unlu-karisik',
      unluTier: 1,
      easySearch: true,
      volume: 0.7,
      reduce: false,

      setCategory: (category) => set({ category }),
      setTier: (tier) => set({ tier }),
      setUnluCategory: (unluCategory) => set({ unluCategory }),
      setUnluTier: (unluTier) => set({ unluTier }),
      setEasySearch: (easySearch) => set({ easySearch }),
      setVolume: (volume) => set({ volume }),
      setReduce: (reduce) => set({ reduce }),
    }),
    {
      // v3: seviye (giriş biçimi) yerine zorluk kademesi + kolay arama.
      name: 'tahmin:ayarlar:v3',
      storage: guvenliDepo,
      partialize: (s) => ({
        category: s.category,
        tier: s.tier,
        unluCategory: s.unluCategory,
        unluTier: s.unluTier,
        easySearch: s.easySearch,
        volume: s.volume,
        reduce: s.reduce,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)
