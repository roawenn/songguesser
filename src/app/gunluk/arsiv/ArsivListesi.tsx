'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { EN_YUKSEK_PUAN } from '@/game/gunlukPuan'
import { gunEtiketi } from '@/components/gunluk/GunlukParcalar'
import { useGunlukStore } from '@/store/useGunlukStore'

/**
 * Arşiv günleri ve bu cihazdaki sonuçlar.
 *
 * Sonuç yerel geçmişten: o gün sıralamalı oynandıysa o puan, yalnızca arşivden
 * oynandıysa "arşiv" etiketiyle.
 */
export function ArsivListesi() {
  const [gunler, setGunler] = useState<string[] | null>(null)
  const [hata, setHata] = useState(false)
  const gecmis = useGunlukStore((s) => s.gecmis)

  useEffect(() => {
    void fetch('/api/gunluk/arsiv')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((v: { gunler: string[] }) => setGunler(v.gunler))
      .catch(() => setHata(true))
  }, [])

  const sonuc = useMemo(() => {
    const m = new Map<string, { puan: number; arsiv: boolean }>()
    for (const k of gecmis) {
      const var_ = m.get(k.gun)
      // Sıralamalı sonuç arşiv sonucundan öncelikli.
      if (!var_ || (var_.arsiv && !k.arsiv)) m.set(k.gun, { puan: k.puan, arsiv: k.arsiv })
    }
    return m
  }, [gecmis])

  if (hata) return <p className="mt-8 text-[#d09a9a]">Arşiv yüklenemedi.</p>
  if (!gunler) return <p className="mt-8 text-ink-3">Yükleniyor…</p>
  if (gunler.length === 0) return <p className="mt-8 text-ink-3">Arşivde henüz gün yok.</p>

  return (
    <ul className="mt-8 flex flex-col gap-2">
      {gunler.map((g) => {
        const s = sonuc.get(g)
        return (
          <li key={g}>
            <Link
              href={`/gunluk?gun=${g}`}
              className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-white/25"
            >
              <span className="flex-1 text-ink-1">{gunEtiketi(g)}</span>
              {s ? (
                <span className="font-mono text-sm text-ink-2">
                  {s.puan}
                  <span className="text-ink-4"> / {EN_YUKSEK_PUAN}</span>
                  {s.arsiv && <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-ink-3">arşiv</span>}
                </span>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d5b477]">oyna →</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
