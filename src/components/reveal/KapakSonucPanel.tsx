'use client'

import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { artworkAt } from '@/data/schema'
import { KAPAK_ADIM, KAPAK_BOYUTLARI } from '@/data/kapak'
import { useKapakStatsStore } from '@/store/useKapakStatsStore'
import { Confetti } from './Confetti'
import { useSonrakiKilit } from './sonrakiKilit'

/**
 * Kapak turunun sonuç kartı — `UnluSonucPanel`'in kardeşi.
 *
 * ⚠️ Apple Music bağlantısı ZORUNLU: kapak Apple'dan geliyor ve şarkı
 * oyunundaki sonuç kartıyla aynı gerekçe (ToS — içeriğe doğrudan mağaza
 * bağlantısı). Bağlantı albümün değil temsilci şarkının; albüm sayfası da
 * oradan açılıyor.
 */

interface Props {
  album: string
  sanatci: string
  yil: number
  ar: string
  /** Apple Music bağlantısı — çekilemediyse boş. */
  magaza: string
  kazandi: boolean
  adim: number
  reduce: boolean
  onSonraki: () => void
}

export function KapakSonucPanel({
  album, sanatci, yil, ar, magaza, kazandi, adim, reduce, onSonraki,
}: Props) {
  const sonraki = useSonrakiKilit(onSonraki)
  const kaynak = useRef<HTMLDivElement>(null)
  const { oynanan, kazanilan, seri } = useKapakStatsStore(
    useShallow((s) => ({ oynanan: s.oynanan, kazanilan: s.kazanilan, seri: s.seri })),
  )
  const isabet = oynanan === 0 ? 0 : Math.round((kazanilan / oynanan) * 100)
  const ilkBoyut = KAPAK_BOYUTLARI[0]

  return (
    <div
      ref={kaynak}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {kazandi && (
        <Confetti
          intensity={1 - Math.min(adim - 1, KAPAK_ADIM) / KAPAK_ADIM}
          reduce={reduce}
          originRef={kaynak}
        />
      )}

      <div
        className="nk-sonuc-kart"
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          width: '100%',
          maxWidth: 460,
          padding: 14,
          borderRadius: 10,
          border: `1px solid ${kazandi ? 'var(--acc)' : 'rgba(255,255,255,0.08)'}`,
          background: kazandi ? 'oklch(0.81 0.12 var(--hue) / 0.05)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artworkAt(ar, 300)}
          alt=""
          width={96}
          height={96}
          decoding="async"
          style={{ width: 96, height: 96, borderRadius: 6, objectFit: 'cover', flex: 'none', background: '#111' }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...MONO, color: kazandi ? 'var(--acc)' : '#c08a8a' }}>
            {kazandi ? 'Bildin' : 'Bilemedin'}
          </div>
          <div
            className="nk-sonuc-baslik"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 26,
              marginTop: 4,
              color: '#f1f3f4',
              lineHeight: 1.15,
            }}
          >
            {album}
          </div>
          <div style={{ fontSize: 14, color: '#8c9297', marginTop: 3 }}>
            {sanatci} · {yil}
          </div>
          <div style={{ ...MONO, marginTop: 8, color: '#7b8186' }}>
            {kazandi
              ? adim === 1
                ? `${ilkBoyut}×${ilkBoyut} pikselden`
                : `${adim}. adımda`
              : 'kapak açıldı'}
          </div>
        </div>
      </div>

      <div style={{ ...MONO, marginTop: 16, color: '#6a7075', display: 'flex', gap: 14 }}>
        <span>%{isabet} isabet</span>
        <span>·</span>
        <span>{oynanan} tur</span>
        <span>·</span>
        <span>{seri} seri</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          autoFocus
          className="nk-sonraki"
          {...sonraki.ozellikler}
          style={{ ...SONRAKI, minWidth: 176, opacity: sonraki.basildi ? 0.72 : 1 }}
        >
          {sonraki.basildi ? 'yükleniyor…' : 'Sıradaki albüm'}
        </button>
        {magaza && (
          <a
            href={magaza}
            target="_blank"
            rel="noreferrer"
            className="nk-magaza"
            style={{
              ...MONO,
              padding: '12px 16px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#b9bec2',
              textDecoration: 'none',
            }}
          >
            Apple Music&apos;te aç
          </a>
        )}
      </div>

      <style>{`
        .nk-sonraki:hover { background: oklch(0.81 0.12 var(--hue) / 0.18) !important; }
        .nk-magaza:hover { border-color: var(--acc) !important; color: var(--acc) !important; }
      `}</style>
    </div>
  )
}

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  letterSpacing: '.18em',
  textTransform: 'uppercase' as const,
}

const SONRAKI = {
  padding: '12px 26px',
  borderRadius: 6,
  border: '1px solid var(--acc)',
  background: 'oklch(0.81 0.12 var(--hue) / 0.1)',
  color: 'var(--acc)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.16em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}
