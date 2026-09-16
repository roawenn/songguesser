'use client'

import { LiderlikListesi } from '@/components/gunluk/Liderlik'

/**
 * ⚠️ `themed` sarmalayıcı: liste `--acc`/`--hue` değişkenlerini kullanıyor,
 * içerik sayfalarında `SahneCercevesi` yok. Ton Günlük kabuğuyla aynı.
 */
export function LiderlikSayfasi() {
  return (
    <div className="themed mt-8" style={{ ['--hue' as string]: '62' }}>
      <LiderlikListesi sinir={50} />
    </div>
  )
}
