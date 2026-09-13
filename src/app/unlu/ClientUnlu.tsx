'use client'

import dynamic from 'next/dynamic'
import { unluHavuzuIsit } from '@/data/loadUnluPool'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * ⚠️ `ssr: false` — `ClientGame.tsx`'teki gerekçenin aynısı: seçili seçki
 * `localStorage`'ta yaşıyor, sunucuda okunamadığı için HTML her zaman
 * varsayılanla basılır ve JS gelince gerçek seçkiye atlardı.
 */
const UnluShell = dynamic(() => import('@/components/UnluShell').then((m) => m.UnluShell), {
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

export function ClientUnlu() {
  // Havuzu, kabuk parçası inmeden indirmeye başlat.
  unluHavuzuIsit(useSettingsStore.getState().unluCategory)
  return <UnluShell />
}
