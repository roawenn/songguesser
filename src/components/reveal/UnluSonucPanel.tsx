'use client'

import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { SERIT } from '@/data/unlu'
import { useUnluStatsStore } from '@/store/useUnluStatsStore'
import { useHesap } from '@/hooks/useHesap'
import { Confetti } from './Confetti'
import { useSonrakiKilit } from './sonrakiKilit'

/**
 * Ünlü turunun sonuç kartı.
 *
 * ⚠️ `ResultPanel` yeniden kullanılmadı: o `Song`'a (kapak URL'i, Apple ve
 * Spotify bağlantıları, `encodeShare`) sıkı bağlı ve kartın yarısı o
 * bağlantılardan ibaret. `Confetti` ise oyundan tamamen bağımsız, aynen
 * paylaşılıyor.
 *
 * ⚠️ Paylaşım kodu (`share.ts`) ünlüye UYGULANMADI: şema `ChipId` ile başlıyor
 * ve `decodeShare` onu `CHIPS`'e karşı doğruluyor; ünlü kodları mevcut
 * çözücüyü düşürürdü. Ayrı bir tur işi.
 */

interface Props {
  ad: string
  gorselUrl: string
  kazandi: boolean
  acilan: number
  reduce: boolean
  onSonraki: () => void
}

export function UnluSonucPanel({ ad, gorselUrl, kazandi, acilan, reduce, onSonraki }: Props) {
  const sonraki = useSonrakiKilit(onSonraki)
  const kaynak = useRef<HTMLDivElement>(null)
  const { oynanan, kazanilan, seri } = useUnluStatsStore(
    useShallow((s) => ({ oynanan: s.oynanan, kazanilan: s.kazanilan, seri: s.seri })),
  )
  const isabet = oynanan === 0 ? 0 : Math.round((kazanilan / oynanan) * 100)
  /*
   * ⚠️ Şerit YALNIZCA GİRİŞLİYE. Girişsiz oyuncunun sayaçları hiçbir yere
   * yazılmıyor; sayfa yenilenince sıfırlanacak bir "12 tur"u göstermek tam da
   * tarayıcı deposundan vazgeçme sebebimizdi (bkz. `store/useStatsStore`).
   */
  const { kullanici } = useHesap()

  return (
    <div
      ref={kaynak}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {kazandi && (
        <Confetti
          intensity={1 - Math.min(acilan - 1, SERIT) / SERIT}
          reduce={reduce}
          originRef={kaynak}
        />
      )}

      {/* Kart: tam görsel + ad */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          width: '100%',
          maxWidth: 430,
          padding: 14,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gorselUrl}
          alt=""
          width={72}
          height={120}
          decoding="async"
          style={{ borderRadius: 6, objectFit: 'cover', flex: 'none', background: '#111' }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...MONO, color: kazandi ? 'var(--acc)' : '#c08a8a' }}>
            {kazandi ? 'Bildin' : 'Bilemedin'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif, var(--font-instrument-serif))',
              fontSize: 26,
              marginTop: 4,
              color: '#e6e8ea',
              lineHeight: 1.15,
            }}
          >
            {ad}
          </div>
          <div style={{ ...MONO, marginTop: 8, color: '#7b8186' }}>
            {kazandi
              ? acilan === 1
                ? 'yalnızca saçtan'
                : `${acilan} şeritle`
              : `${SERIT} şerit açıldı`}
          </div>
        </div>
      </div>

      {/* İstatistik şeridi — hesabı olana. */}
      {kullanici && (
        <div style={{ ...MONO, marginTop: 16, color: '#6a7075', display: 'flex', gap: 14 }}>
          <span>%{isabet} isabet</span>
          <span>·</span>
          <span>{oynanan} tur</span>
          <span>·</span>
          <span>{seri} seri</span>
        </div>
      )}

      <button
        type="button"
        autoFocus
        className="nk-sonraki"
        {...sonraki.ozellikler}
        style={{ ...SONRAKI, minWidth: 170, opacity: sonraki.basildi ? 0.72 : 1 }}
      >
        {sonraki.basildi ? 'yükleniyor…' : 'Sıradaki ünlü'}
      </button>

      <style>{`
        .nk-sonraki:hover { background: oklch(0.81 0.12 var(--hue) / 0.18) !important; }
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
  marginTop: 22,
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
