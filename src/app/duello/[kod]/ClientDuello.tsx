'use client'

import dynamic from 'next/dynamic'

/**
 * ⚠️ `ssr: false` bir İSTEMCİ bileşeninde olmak zorunda — Next 15'te sunucu
 * bileşeninden kullanılamıyor. Gerekçe `ClientGame.tsx`'tekiyle aynı: sahne
 * rengi `localStorage`'taki seçkiden geliyor, sunucuda okunamadığı için HTML
 * varsayılan tonla basılır ve JS gelince renk sıçrardı. Düelloda ayrıca gizli
 * anahtar ve yoklama da tamamen tarayıcı işi.
 */
const DuelloShell = dynamic(
  () => import('@/components/DuelloShell').then((m) => m.DuelloShell),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
        }}
      />
    ),
  },
)

export function ClientDuello({ kod }: { kod: string }) {
  return <DuelloShell kod={kod} />
}
