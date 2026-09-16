'use client'

import dynamic from 'next/dynamic'
import { hazirKabuk, kabukYukle } from '@/lib/kabukKayit'

/**
 * ⚠️ `ssr: false` — oturum cihaz anahtarıyla (`localStorage`) bulunuyor;
 * sunucuda okunamadığı için HTML her zaman "Başla" ekranıyla basılır ve
 * devam eden oyuncuda JS gelince tura atlardı.
 */
const GunlukSayfasiDinamik = dynamic(() => kabukYukle('gunluk'), {
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

export function ClientGunluk() {
  // Kayıtta hazırsa askıya almadan doğrudan çiz (bkz. `lib/kabukKayit`).
  const GunlukSayfasi = hazirKabuk('gunluk') ?? GunlukSayfasiDinamik
  return <GunlukSayfasi />
}
