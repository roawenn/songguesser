'use client'

import dynamic from 'next/dynamic'
import { kapakHavuzuIsit } from '@/data/loadKapakPool'
import { hazirKabuk, kabukYukle } from '@/lib/kabukKayit'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * ⚠️ `ssr: false` — `ClientGame.tsx`'teki gerekçenin aynısı: seçili seçki
 * `localStorage`'ta yaşıyor, sunucuda okunamadığı için HTML her zaman
 * varsayılanla basılır ve JS gelince gerçek seçkiye atlardı.
 */
const KapakShellDinamik = dynamic(() => kabukYukle('kapak'), {
  ssr: false,
  loading: () => <Iskelet />,
})

function Iskelet() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    />
  )
}

export function ClientKapak() {
  // Havuzu, kabuk parçası inmeden indirmeye başlat.
  if (typeof window !== 'undefined') kapakHavuzuIsit(useSettingsStore.getState().kapakCategory)
  // Kayıtta hazırsa askıya almadan doğrudan çiz (bkz. `lib/kabukKayit`).
  const KapakShell = hazirKabuk('kapak') ?? KapakShellDinamik
  return <KapakShell />
}
