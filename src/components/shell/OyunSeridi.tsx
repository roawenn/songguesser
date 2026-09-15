'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useKaydirilabilir } from './Chrome'

/**
 * Oyun seçici — segmentli bir anahtar.
 *
 * İKİ yerde çiziliyor, görünürlüğü CSS seçiyor (bkz. `SahneCercevesi`):
 *   - masaüstünde logonun altında, markayla birlikte ("tahmin" → hangi tahmin)
 *   - telefonda footer'da, yatay kaydırılabilir — üst bantta ilk ekranı
 *     oyundan çalıyordu
 *
 * ⚠️ Kaydırma altyapısı (`useKaydirilabilir` + kenar soluklaşması) telefonda
 * gerçekten iş görüyor: iki segment açıklamalarıyla dar ekrana sığmıyor.
 *
 * ⚠️ Masaüstündeki kopyanın YÜKSEKLİĞİ ÖLÇEK BÜTÇESİNE GİRİYOR
 * (`useOlcek.ts`). Dolgu ya da yazı boyutu değişirse `TASARIM_Y` yeniden
 * ölçülmeli.
 */

/** İki oyunun ikonu — dışarıdan ikon paketi çekmemek için elde çizildi. */
function NotaIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M9 18V5.5l10-2V16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function YuzIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      {/* Saç — oyunun ilk açılan şeridi. */}
      <path d="M5 11a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5.6 11v3.2a6.4 6.4 0 0 0 12.8 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 13.4h.01M14.5 13.4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M4 21c1.8-2.4 4.6-3.6 8-3.6s6.2 1.2 8 3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const OYUNLAR = [
  {
    id: 'sarki',
    yol: '/',
    ad: 'Şarkı Tahmini',
    aciklama: 'Yarım saniyelik klipten başla',
    Ikon: NotaIkonu,
  },
  {
    id: 'unlu',
    yol: '/unlu',
    ad: 'Ünlü Bilmece',
    aciklama: 'Yalnızca saçından tanı',
    Ikon: YuzIkonu,
  },
] as const

export type OyunId = (typeof OYUNLAR)[number]['id']

export function OyunSeridi({ aktif }: { aktif: OyunId }) {
  const ref = useRef<HTMLElement>(null)
  useKaydirilabilir(ref)

  return (
    <>
      <nav
        ref={ref}
        className="no-scrollbar nk-strip"
        style={{ maxWidth: '100%', overflowX: 'auto', flex: 'none' }}
        aria-label="Oyunlar"
      >
        {/*
          Tek çerçeve içinde iki segment: iki ayrı kart değil, TEK bir seçimin
          iki seçeneği olduğu görünsün. Seçili segment sahne renginde dolu.
        */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            minWidth: 'max-content',
            margin: '0 auto',
            width: 'max-content',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {OYUNLAR.map((o) => {
            const on = o.id === aktif
            return (
              <Link
                key={o.id}
                href={o.yol}
                aria-current={on ? 'page' : undefined}
                className="nk-oyun"
                data-on={on ? '1' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 16px 6px 6px',
                  borderRadius: 9,
                  background: on ? 'oklch(0.81 0.12 var(--hue) / 0.11)' : 'transparent',
                  boxShadow: on ? 'inset 0 0 0 1px oklch(0.81 0.12 var(--hue) / 0.5)' : 'none',
                  textDecoration: 'none',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  transition: 'background .15s ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    display: 'grid',
                    placeContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: on ? 'oklch(0.81 0.12 var(--hue) / 0.16)' : 'rgba(255,255,255,0.04)',
                    color: on ? 'var(--acc)' : '#7b8186',
                  }}
                >
                  <o.Ikon />
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    className="nk-oyun-ad"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: on ? 'var(--acc)' : '#a9aeb3',
                      lineHeight: 1.1,
                    }}
                  >
                    {o.ad}
                  </span>
                  {/*
                    Açıklama BÜYÜK HARF DEĞİL: iki satır da versal olsaydı
                    hangisinin ad hangisinin açıklama olduğu okunmuyordu.
                  */}
                  <span
                    className="nk-oyun-aciklama"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 10.5,
                      color: '#6a7075',
                      lineHeight: 1.25,
                    }}
                  >
                    {o.aciklama}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <style>{`
        .nk-oyun:not([data-on]):hover { background: rgba(255,255,255,0.04) !important; }
        .nk-oyun:not([data-on]):hover .nk-oyun-ad { color: #cfd3d6 !important; }
      `}</style>
    </>
  )
}
