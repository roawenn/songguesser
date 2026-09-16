'use client'

import Link from 'next/link'
import { istanbulGunu } from '@/game/gun'
import { useGunlukStore } from '@/store/useGunlukStore'

/**
 * Logonun yanındaki "bugünün günlüğü seni bekliyor" rozeti.
 *
 * ⚠️ YEREL BİLGİYLE: bu cihazda bugünün günlüğü bitmediyse görünür. Sunucuya
 * sormak her sayfa açılışında bir istek demekti; rozet için yanılma payı
 * (başka cihazda oynamış olmak) kabul edilebilir.
 */
export function GunlukRozeti() {
  const bugun = istanbulGunu(new Date())
  const oynadi = useGunlukStore((s) => s.gecmis.some((k) => k.gun === bugun && !k.arsiv))
  if (oynadi) return null

  return (
    <Link
      href="/gunluk"
      className="nk-gunluk-rozet"
      aria-label="Bugünün günlük soruları seni bekliyor"
      style={{
        position: 'absolute',
        left: 'calc(100% + 10px)',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 9px 4px 7px',
        borderRadius: 999,
        border: '1px solid oklch(0.82 0.13 62 / 0.45)',
        background: 'oklch(0.82 0.13 62 / 0.10)',
        color: 'oklch(0.86 0.12 62)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9.5,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'oklch(0.86 0.12 62)', animation: 'nk-nabiz 2.4s ease-in-out infinite' }}
      />
      Günlük
      <style>{`
        @keyframes nk-nabiz { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
        :root[data-motion='reduced'] .nk-gunluk-rozet span { animation: none !important; }
        .nk-gunluk-rozet:hover { background: oklch(0.82 0.13 62 / 0.18) !important; }
      `}</style>
    </Link>
  )
}
