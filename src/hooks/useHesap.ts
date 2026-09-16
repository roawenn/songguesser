'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Oturum durumu — sayfa ömrü boyunca TEK istek.
 *
 * Başlıktaki hesap düğmesi, Günlük özeti ve hesap sayfası aynı bilgiyi
 * okuyor; her biri ayrı istek atsaydı bir sayfa açılışında üç `/api/hesap`
 * giderdi. Değişiklikten sonra (ad kaydı, çıkış) `yenile` herkesi günceller.
 */

export interface HesapKullanici {
  ad: string | null
  email: string
  adGerekli: boolean
  /** Ad bu tarihe kadar değiştirilemez (ISO); değişebiliyorsa null. */
  adDegisebilir: string | null
}

export interface HesapDurumu {
  yuklendi: boolean
  girisAcik: boolean
  kullanici: HesapKullanici | null
}

const BOS: HesapDurumu = { yuklendi: false, girisAcik: false, kullanici: null }

let durum: HesapDurumu = BOS
let ucusta: Promise<void> | null = null
const dinleyiciler = new Set<(d: HesapDurumu) => void>()

function yay(d: HesapDurumu) {
  durum = d
  for (const f of dinleyiciler) f(d)
}

function oku(): Promise<void> {
  ucusta ??= fetch('/api/hesap', { cache: 'no-store' })
    .then((r) => r.json())
    .then((v: { girisAcik?: boolean; kullanici?: HesapKullanici | null }) =>
      yay({ yuklendi: true, girisAcik: v.girisAcik === true, kullanici: v.kullanici ?? null }),
    )
    .catch(() => yay({ ...durum, yuklendi: true }))
    .finally(() => {
      ucusta = null
    })
  return ucusta
}

export function useHesap(): HesapDurumu & { yenile: () => Promise<void> } {
  const [d, setD] = useState(durum)
  useEffect(() => {
    dinleyiciler.add(setD)
    if (!durum.yuklendi) void oku()
    else setD(durum)
    return () => {
      dinleyiciler.delete(setD)
    }
  }, [])
  const yenile = useCallback(() => oku(), [])
  return { ...d, yenile }
}

/** Girişi başlatan adres — bulunulan sayfaya geri döner. */
export function girisAdresi(): string {
  if (typeof window === 'undefined') return '/api/giris/google'
  const yol = window.location.pathname + window.location.search
  return `/api/giris/google?donus=${encodeURIComponent(yol)}`
}
