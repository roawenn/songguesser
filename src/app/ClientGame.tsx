'use client'

import dynamic from 'next/dynamic'

/**
 * Oyunu yalnızca tarayıcıda kur.
 *
 * ⚠️ `ssr: false` burada bir kaçamak değil, doğru çözüm. Seçili kategori
 * `localStorage`'ta yaşıyor; sunucuda okunamadığı için HTML her zaman
 * varsayılanla ("Karışık", --hue 205) basılıyordu. Tarayıcı önce onu boyuyor,
 * JS gelince gerçek kategoriye atlıyordu — F5'te görülen sıçrama buydu.
 * Üstelik çip durumu, kaset etiketi ve kök --hue hidrasyonda uyuşmadığı için
 * React kökü zaten istemcide baştan render ediyordu.
 *
 * ⚠️ `skipHydration` ile ÇÖZÜLMEZ, kötüleşir: zustand persist senkron çalışır,
 * yani ilk istemci render'ında kategori zaten doğrudur ve tek bir havuz isteği
 * atılır. Hidrasyonu mount sonrasına ertelemek o isteği önce "karisik" için
 * yapar, sonra gerçek kategori için bir kez daha.
 */
const GameShell = dynamic(() => import('@/components/GameShell').then((m) => m.GameShell), {
  ssr: false,
  loading: () => <GameSkeleton />,
})

/** Kabuk ölçülerinde sessiz bir iskelet — düzen kaymasın. */
function GameSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    />
  )
}

export function ClientGame() {
  return <GameShell />
}
