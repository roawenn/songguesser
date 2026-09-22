import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { guvenliDepo } from './guvenliDepo'
import {
  CHIPS, TIERS, UNLU_CHIPS, VARSAYILAN_YIL, YILLAR,
  type ChipId, type Difficulty, type UnluChipId, type YilId,
} from '@/data/categories'

export interface Settings {
  category: ChipId
  /**
   * Yıl eşiği — şarkı ve kapak oyunlarında ORTAK.
   *
   * ⚠️ Kategoriler oyun başına ayrı (`category` / `kapakCategory`) ama yıl
   * ortak: "2020 sonrasını oynamak istiyorum" oyuna değil oyuncuya ait bir
   * tercih, iki yerde ayrı ayrı ayarlatmanın karşılığı yok.
   */
  yil: YilId
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
  /**
   * Kapaktan Albüm oyununun seçkisi, kademesi ve KOLAY MODU.
   *
   * Seçkiler şarkı çipleri (havuz şarkı tablosundan geliyor) ama şarkıdaki
   * seçimden AYRI tutuluyor — ünlüdeki gerekçenin aynısı.
   *
   * `kapakKolay`: açıkken sanatçı adı da kabul edilir, kapalıyken yalnızca albüm
   * adı (kullanıcı kararı). `easySearch`'ten AYRI: öneri listesi ortak bir
   * tercih, kabul kuralı bu oyuna özgü.
   */
  kapakCategory: ChipId
  kapakTier: Difficulty
  kapakKolay: boolean
  /** Açıkken yazarken öneri listesi çıkar. */
  easySearch: boolean
  volume: number
  /** Spot takibini, makara dönüşünü ve titreşimi durdurur. */
  reduce: boolean

  setCategory: (c: ChipId) => void
  setYil: (y: YilId) => void
  setTier: (t: Difficulty) => void
  setUnluCategory: (c: UnluChipId) => void
  setUnluTier: (t: Difficulty) => void
  setKapakCategory: (c: ChipId) => void
  setKapakTier: (t: Difficulty) => void
  setKapakKolay: (b: boolean) => void
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

  /*
   * ⚠️ Sürüm anahtarı ARTMADI, artmasına gerek de yok. Dönem çipleri
   * (`eskiler`, `doksanlar`, `iki-binler`) `CHIPS`'ten kalktığı için diskte o
   * değerleri taşıyan eski oyuncular bu süzgeçten geçemiyor ve varsayılan
   * `karisik`'e iniyor — göç kodu yazmadan kendiliğinden iyileşiyor.
   */
  if (CHIPS.some((c) => c.id === raw.category)) out.category = raw.category as ChipId
  if (YILLAR.some((y) => y.id === raw.yil)) out.yil = raw.yil as YilId
  if (TIERS.some((t) => t.id === raw.tier)) out.tier = raw.tier as Difficulty
  if (UNLU_CHIPS.some((c) => c.id === raw.unluCategory)) {
    out.unluCategory = raw.unluCategory as UnluChipId
  }
  if (TIERS.some((t) => t.id === raw.unluTier)) out.unluTier = raw.unluTier as Difficulty
  if (CHIPS.some((c) => c.id === raw.kapakCategory)) out.kapakCategory = raw.kapakCategory as ChipId
  if (TIERS.some((t) => t.id === raw.kapakTier)) out.kapakTier = raw.kapakTier as Difficulty
  if (typeof raw.kapakKolay === 'boolean') out.kapakKolay = raw.kapakKolay
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
      yil: VARSAYILAN_YIL,
      tier: 1,
      unluCategory: 'unlu-karisik',
      unluTier: 1,
      kapakCategory: 'karisik',
      kapakTier: 1,
      kapakKolay: true,
      easySearch: true,
      volume: 0.7,
      reduce: false,

      setCategory: (category) => set({ category }),
      setYil: (yil) => set({ yil }),
      setTier: (tier) => set({ tier }),
      setUnluCategory: (unluCategory) => set({ unluCategory }),
      setUnluTier: (unluTier) => set({ unluTier }),
      setKapakCategory: (kapakCategory) => set({ kapakCategory }),
      setKapakTier: (kapakTier) => set({ kapakTier }),
      setKapakKolay: (kapakKolay) => set({ kapakKolay }),
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
        yil: s.yil,
        tier: s.tier,
        unluCategory: s.unluCategory,
        unluTier: s.unluTier,
        kapakCategory: s.kapakCategory,
        kapakTier: s.kapakTier,
        kapakKolay: s.kapakKolay,
        easySearch: s.easySearch,
        volume: s.volume,
        reduce: s.reduce,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)
