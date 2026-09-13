'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useKaydirilabilir } from './Chrome'

/**
 * Oyun seçici — footer yazısının hemen ÜSTÜNDE, kendi satırında.
 *
 * ⚠️ Yatay kaydırılabilir, ama BUGÜN iki oyun var ve hiçbir ekranda kaymıyor.
 * Kaydırma altyapısı yine de kuruldu çünkü üçüncü oyun eklendiğinde şeridin
 * kırpılması sessiz bir hata olurdu — kategori şeridinde tam bu yaşandı
 * (tasarımda 8 çip vardı, bizde 11 oldu ve sondaki üçü kırpıldı).
 *
 * Kenar soluklaşması `useKaydirilabilir` ile yalnızca gerçekten kaydırılabilir
 * olduğunda çıkıyor; koşulsuz uygulandığında şerit tam sığdığı hâlde sondaki
 * madde kırpılmış gibi duruyordu.
 *
 * ⚠️ YÜKSEKLİĞİ ÖLÇEK BÜTÇESİNE GİRİYOR (`useOlcek.ts`).
 *
 * Şerit bir ara footer'ın İÇİNE, atıf yazısıyla aynı satıra alınmıştı: o zaman
 * yalnızca bir etiket taşıyordu ("Şarkı" / "Ünlü") ve kendi satırı 38 px'e mal
 * oluyordu. Artık ikon + ad + açıklama taşıyor ve kendi satırında; eklediği
 * yükseklik `TASARIM_Y`'ye ÖLÇÜLEREK yansıtıldı. Bu dosyadaki dolgu/yazı
 * boyutları değişirse `TASARIM_Y` yeniden ölçülmeli, yoksa 1366x768'de sahne
 * sessizce taşar.
 */

/** İki oyunun ikonu — dışarıdan ikon paketi çekmemek için elde çizildi. */
function NotaIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
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
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
      {/* Saç — oyunun ilk açılan şeridi. */}
      <path
        d="M5 11a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.6 11v3.2a6.4 6.4 0 0 0 12.8 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 13.4h.01M14.5 13.4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 21c1.8-2.4 4.6-3.6 8-3.6s6.2 1.2 8 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '0 2px',
            minWidth: 'max-content',
            justifyContent: 'center',
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
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.09)'}`,
                  background: on ? 'oklch(0.81 0.12 var(--hue) / 0.09)' : 'transparent',
                  textDecoration: 'none',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {/*
                  İkon adın SOLUNDA ve iki satırın ortasında. Kendi kutusu var:
                  kutu olmadan çizim, ad ve açıklamanın oluşturduğu bloğun
                  tepesine yapışıyordu.
                */}
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    display: 'grid',
                    placeContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.1)'}`,
                    background: on ? 'oklch(0.81 0.12 var(--hue) / 0.12)' : 'rgba(255,255,255,0.02)',
                    color: on ? 'var(--acc)' : '#7b8186',
                  }}
                >
                  <o.Ikon />
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
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
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 10.5,
                      letterSpacing: 0,
                      textTransform: 'none',
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
        .nk-oyun:not([data-on]):hover { border-color: rgba(255,255,255,0.2) !important; }
        .nk-oyun:not([data-on]):hover span { color: #b6bbbf !important; }
      `}</style>
    </>
  )
}
