'use client'

import { useEffect, useState } from 'react'
import { GUNLUK_SIRASI, type GunlukOyun } from '@/game/gunluk'
import type { GunlukGorunum } from '@/game/gunlukGorunum'
import { KOVA_GENISLIGI, kovaIndeksi, kovala, type DagilimSatiri } from '@/game/dagilim'
import { EN_YUKSEK_PUAN } from '@/game/gunlukPuan'

/**
 * Günlük modun küçük, durumsuz parçaları.
 *
 * ⚠️ Kart çerçevesi `KapakPanels.tsx` / `SidePanels.tsx` ile AYNI değerler —
 * proje deseni kopya (bkz. `KapakPanels` başlığı); ortak modüle taşımak
 * çalışan üç oyunun kartlarına dokunmak demekti.
 */

export const CAPTION = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  color: '#5c6267',
}

export const CARD = {
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.018)',
  padding: '20px 20px 22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 20,
}

export const GHOST = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '11px 18px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#a9aeb3',
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}

/** Sahnenin ana eylemi — "Başla", "Sıradaki tur". */
export const ANA_DUGME = {
  ...GHOST,
  padding: '14px 26px',
  fontSize: 11.5,
  border: '1px solid var(--acc)',
  color: 'var(--acc)',
  background: 'oklch(0.81 0.12 var(--hue) / 0.10)',
}

export function Baslik({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...CAPTION, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

export const OYUN_ADI: Record<GunlukOyun, string> = {
  sarki: 'Şarkı',
  unlu: 'Ünlü',
  kapak: 'Kapak',
}

/** "16 Eylül Çarşamba" — gün dizesinden, saat diliminden bağımsız. */
export function gunEtiketi(gun: string, haftaGunu = true): string {
  const d = new Date(`${gun}T12:00:00Z`)
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(haftaGunu ? { weekday: 'long' as const } : {}),
    timeZone: 'UTC',
  }).format(d)
}

/** Hedefe kalan süre (ms), saniyede bir güncellenir. Sunucu saatine göre. */
export function useGeriSayim(hedef: number | null, saatFarki: number): number | null {
  const [kalan, setKalan] = useState<number | null>(null)
  useEffect(() => {
    if (hedef === null) {
      setKalan(null)
      return
    }
    const guncelle = () => setKalan(Math.max(0, hedef - (Date.now() + saatFarki)))
    guncelle()
    const t = setInterval(guncelle, 1000)
    return () => clearInterval(t)
  }, [hedef, saatFarki])
  return kalan
}

export function sureYaz(ms: number): string {
  const s = Math.floor(ms / 1000)
  const iki = (n: number) => String(n).padStart(2, '0')
  return `${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`
}

/**
 * Altı turun şeridi: tür harfi, durum rengi, alınan puan.
 *
 * Sahnenin tepesinde duruyor (telefonda yan kartlar menüde, ilerleme yine
 * görünsün diye).
 */
export function TurSeridi({ gorunum, aktifIndex }: { gorunum: GunlukGorunum | null; aktifIndex: number }) {
  return (
    <ol
      aria-label="Turlar"
      style={{ display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0, justifyContent: 'center' }}
    >
      {GUNLUK_SIRASI.map((s, i) => {
        const t = gorunum?.turlar[i]
        const renk =
          t?.durum === 'kazandi' ? 'oklch(0.78 0.13 150)'
          : t?.durum === 'kaybetti' ? 'oklch(0.66 0.13 25)'
          : i === aktifIndex ? 'var(--acc)'
          : 'rgba(255,255,255,0.14)'
        const etiket = `${i + 1}. tur, ${OYUN_ADI[s.oyun]} (${s.zorluk})${
          t?.sonuc ? `, ${t.sonuc.puan} puan` : t?.durum === 'oynaniyor' ? ', oynanıyor' : ''
        }`
        return (
          <li
            key={i}
            aria-label={etiket}
            aria-current={i === aktifIndex && t?.durum === 'oynaniyor' ? 'step' : undefined}
            style={{
              width: 44,
              padding: '6px 0 5px',
              borderRadius: 6,
              border: `1px solid ${renk}`,
              background: t?.durum === 'kazandi' ? 'oklch(0.78 0.13 150 / 0.10)' : 'transparent',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#a9aeb3' }}>
              {OYUN_ADI[s.oyun][0]}
              <span style={{ color: '#5c6267' }}>{s.zorluk === 'kolay' ? '·' : '··'}</span>
            </div>
            <div style={{ fontSize: 10.5, color: t?.sonuc ? '#e6e8ea' : '#4a4f53', marginTop: 2 }}>
              {t?.sonuc ? t.sonuc.puan : '—'}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Günün puan dağılımı — 60'lık kovalar, oyuncunun kovası vurgulu. */
export function PuanDagilimi({ dagilim, puan }: { dagilim: readonly DagilimSatiri[]; puan: number | null }) {
  const kovalar = kovala(dagilim)
  const enCok = Math.max(1, ...kovalar)
  const benim = puan === null ? -1 : kovaIndeksi(puan)
  return (
    <figure style={{ margin: 0, width: '100%' }}>
      <div
        role="img"
        aria-label={`Puan dağılımı: ${kovalar.map((n, i) => `${i * KOVA_GENISLIGI} ile ${Math.min(EN_YUKSEK_PUAN, (i + 1) * KOVA_GENISLIGI - 1)} arası ${n} oyuncu`).join('; ')}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}
      >
        {kovalar.map((n, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(n > 0 ? 6 : 2, (n / enCok) * 100)}%`,
              borderRadius: 2,
              background: i === benim ? 'var(--acc)' : 'rgba(255,255,255,0.13)',
            }}
          />
        ))}
      </div>
      <figcaption
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          color: '#5c6267',
        }}
      >
        <span>0</span>
        <span>{EN_YUKSEK_PUAN / 2}</span>
        <span>{EN_YUKSEK_PUAN}</span>
      </figcaption>
    </figure>
  )
}
