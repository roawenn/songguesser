'use client'

import dynamic from 'next/dynamic'

/**
 * ⚠️ `ssr: false` — ses motoru, soketler ve kurulum ayarları (`localStorage`)
 * yalnızca tarayıcıda var; sunucuda basılan HTML ilk karede yanlış ayarı gösterirdi.
 */
const YayinShell = dynamic(() => import('@/components/YayinShell').then((m) => m.YayinShell), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    />
  ),
})

export function ClientYayin() {
  return <YayinShell />
}
