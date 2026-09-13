'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useKaydirilabilir } from './Chrome'

/**
 * Oyun seçici — sayfanın en altında, footer'ın hemen üstünde.
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
 * ⚠️ FOOTER SATIRININ İÇİNDE duruyor, kendi satırında değil.
 *
 * Önce ayrı bir şerit olarak yazıldı ve ölçüm şunu gösterdi: 38px'lik kendi
 * satırı `TASARIM_Y`'yi 1155'ten 1195'e çıkarıyor, bu da 1280×800 ve
 * 1366×768'de ölçeği alt sınıra dayayıp sahneyi taşırıyordu — yani bir
 * gezinme şeridi uğruna bütün oyun küçülüyordu. Footer'la aynı satırı
 * paylaşınca eklenen yükseklik ~0.
 *
 * Kullanıcının isteği "en altta" idi; burası hâlâ en alt.
 */

export const OYUNLAR = [
  { id: 'sarki', yol: '/', etiket: 'Şarkı' },
  { id: 'unlu', yol: '/unlu', etiket: 'Ünlü' },
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
            gap: 8,
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
                style={{
                  display: 'block',
                  padding: '5px 13px',
                  borderRadius: 6,
                  border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.09)'}`,
                  background: on ? 'oklch(0.81 0.12 var(--hue) / 0.1)' : 'transparent',
                  color: on ? 'var(--acc)' : '#7b8186',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.etiket}
              </Link>
            )
          })}
        </div>
      </nav>

      <style>{`.nk-oyun:hover { border-color: rgba(255,255,255,0.22) !important; color: #b6bbbf !important; }`}</style>
    </>
  )
}
