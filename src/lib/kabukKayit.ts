'use client'

import type { ComponentType } from 'react'

/**
 * Oyun kabuklarının yükleyicisi ve "yüklendi mi" kaydı.
 *
 * ⚠️ NEDEN: `next/dynamic` bileşeni modül ÇOKTAN inmiş olsa bile İLK render'da
 * askıya alınıyor (React.lazy'nin durumu ancak kendi yükleyicisi çağrılınca
 * "çözüldü" oluyor). Oyunlar arası geçiş `router.push` ile bir React
 * geçişinde yapıldığından React bu askıya almayı ~300 ms'lik "fallback
 * throttling" ile bekletiyordu. Ölçüm (üretim, 4x CPU): ilk Ünlü geçişinde URL
 * değişimi → yeni kabuk ~330 ms, ikincide ~30 ms. Kabuk kodunu boşta önden
 * yüklemek TEK BAŞINA hiçbir şey değiştirmedi.
 *
 * Çözüm: yükleyici tek yerde; modül inince bileşen buraya yazılıyor. Sayfa
 * bileşenleri (`Client*`) kayıtta hazır bileşen varsa onu DOĞRUDAN çiziyor —
 * askıya alma yok. İlk tam yüklemede kayıt boş, `next/dynamic` yolu değişmedi.
 */

export type KabukId = 'sarki' | 'unlu' | 'kapak' | 'gunluk'

// Kabukların prop tipleri farklı; kayıt yalnızca bileşeni taşıyor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kabuk = ComponentType<any>

const YUKLEYICI: Record<KabukId, () => Promise<Kabuk>> = {
  sarki: () => import('@/components/GameShell').then((m) => m.GameShell),
  unlu: () => import('@/components/UnluShell').then((m) => m.UnluShell),
  kapak: () => import('@/components/KapakShell').then((m) => m.KapakShell),
  gunluk: () => import('@/components/GunlukShell').then((m) => m.GunlukSayfasi),
}

const hazir = new Map<KabukId, Kabuk>()
const ucusta = new Map<KabukId, Promise<Kabuk>>()

export function kabukYukle(id: KabukId): Promise<Kabuk> {
  const h = hazir.get(id)
  if (h) return Promise.resolve(h)
  let soz = ucusta.get(id)
  if (!soz) {
    soz = YUKLEYICI[id]().then((k) => {
      hazir.set(id, k)
      return k
    })
    soz.catch(() => ucusta.delete(id))
    ucusta.set(id, soz)
  }
  return soz
}

/** Modül inmiş ve değerlendirilmişse bileşen; değilse null. */
export function hazirKabuk(id: KabukId): Kabuk | null {
  return hazir.get(id) ?? null
}
