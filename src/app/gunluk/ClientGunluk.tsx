'use client'

import dynamic from 'next/dynamic'

/**
 * ⚠️ `ssr: false` — oturum cihaz anahtarıyla (`localStorage`) bulunuyor;
 * sunucuda okunamadığı için HTML her zaman "Başla" ekranıyla basılır ve
 * devam eden oyuncuda JS gelince tura atlardı.
 */
const GunlukShell = dynamic(() => import('@/components/GunlukShell').then((m) => m.GunlukShell), {
  ssr: false,
  loading: () => <Iskelet />,
})

function Iskelet() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    />
  )
}

export function ClientGunluk({ arsivGun }: { arsivGun: string | null }) {
  // `key`: bugünden arşive (ya da günler arası) geçişte hook durumu sıfırdan kurulsun.
  return <GunlukShell key={arsivGun ?? 'bugun'} arsivGun={arsivGun} />
}
