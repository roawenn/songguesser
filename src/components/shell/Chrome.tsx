'use client'

import { useEffect, useRef } from 'react'

import { CHIPS, TIERS, type ChipId, type Difficulty } from '@/data/categories'

const MONO_CAPTION = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  color: '#5c6267',
}

/** Kategori başlığı: şeridin ne olduğunu söyler, o yüzden biraz daha okunur. */
const STRIP_TITLE = { ...MONO_CAPTION, fontSize: 10, color: '#767c81' }

/**
 * Marka.
 *
 * Hamburger kaldırıldı: ayarlar ve kurallar artık sahnenin iki yanında kalıcı
 * kartlar olarak duruyor (bkz. SidePanels). Menü arkasına saklanacak bir şey
 * kalmadı.
 */
export function Header() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px 4px',
        width: '100%',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: '.01em',
          color: '#f2f4f5',
          textShadow: '0 0 28px var(--accSoft)',
          margin: 0,
        }}
      >
        tahmin
      </h1>
    </header>
  )
}

/** Şerit başlıkları — hepsi aynı mono büyük harf dili. */
function StripCaption({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...STRIP_TITLE,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      {children}
      <span style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  )
}

interface CategoryProps {
  category: ChipId
  onCategory: (c: ChipId) => void
}

/**
 * Seçki şeridi — sayfanın en üstündeki ana seçim.
 *
 * Başlıklı ve belirgin: oyuncunun ilk yaptığı iş burada, dolayısıyla en görünür
 * eleman olmalı. Seçili çip sahne rengini alır, böylece kasetin ve vurguların
 * rengiyle aynı şeyi anlattığı anlaşılır.
 *
 * ⚠️ Tasarımda 8 çip vardı ve zorlukla aynı satıra sığıyordu. Bizde 11 çip var;
 * aynı satırda kalsalar sondaki üçü sessizce kırpılıyordu — bu yüzden kendi
 * satırında ve dar ekranda yatay kayıyor.
 */
export function CategoryStrip({ category, onCategory }: CategoryProps) {
  const stripRef = useRef<HTMLElement>(null)

  // Kenar soluklaşması YALNIZCA gerçekten kaydırılabilirken görünmeli.
  // Koşulsuz uygulandığında, şerit tam sığdığı hâlde sondaki çip kırpılmış
  // gibi duruyordu.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const update = () => {
      el.dataset.scrollable = el.scrollWidth > el.clientWidth + 1 ? 'true' : 'false'
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      style={{
        width: '100%',
        padding: '2px 20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 13,
      }}
    >
      <StripCaption>Kategoriler</StripCaption>

      <nav
        ref={stripRef}
        className="no-scrollbar nk-strip"
        style={{ maxWidth: '100%', overflowX: 'auto' }}
        aria-label="Seçki"
      >
        <div
          style={{
            display: 'flex',
            gap: 9,
            padding: '4px 2px 6px',
            minWidth: 'max-content',
            justifyContent: 'center',
          }}
        >
          {CHIPS.map((c) => {
            const on = c.id === category
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategory(c.id)}
                aria-pressed={on}
                className="nk-chip"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '11px 19px',
                  border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 5,
                  background: on
                    ? 'oklch(0.81 0.12 var(--hue) / 0.13)'
                    : 'rgba(255,255,255,0.02)',
                  color: on ? 'var(--acc)' : '#8d9398',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  letterSpacing: '.03em',
                  boxShadow: on ? '0 0 30px -8px var(--accSoft)' : 'none',
                  transition: 'color .15s ease, border-color .15s ease, background .15s ease',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </nav>

      <style>{`
        .nk-chip:hover[aria-pressed='false'] {
          border-color: rgba(255,255,255,0.24) !important;
          color: #cfd3d6 !important;
        }
      `}</style>
    </div>
  )
}

interface TierProps {
  tier: Difficulty
  onTier: (t: Difficulty) => void
}

/**
 * Zorluk kademesi — kasetle ilerleme çubuğu arasında.
 *
 * Kategoriyle birlikte üst bantta dururken iki seçim aynı blokta eziliyordu.
 * Zorluk aslında "şu an ne çalınacak" sorusunun parçası, o yüzden sahnenin
 * içinde: kaset neyi çaldığını, hemen altındaki kademe de ne kadar zor
 * olduğunu söylüyor.
 *
 * ⚠️ Her kademe kendi rengini taşır ama bu renk SAHNEYİ sürmez — sahne rengi
 * kategoriden gelir. İki bilgi de renkle okunur, çakışmaz.
 */
export function TierStrip({ tier, onTier }: TierProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <span style={MONO_CAPTION}>zorluk</span>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {TIERS.map((t) => {
          const on = t.id === tier
          const color = `oklch(0.81 0.13 ${t.hue})`
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTier(t.id)}
              aria-pressed={on}
              title={t.hint}
              style={{
                padding: '7px 13px',
                border: 0,
                borderRadius: 999,
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                background: on ? `oklch(0.81 0.13 ${t.hue} / 0.16)` : 'transparent',
                color: on ? color : `oklch(0.62 0.07 ${t.hue})`,
                boxShadow: on ? `inset 0 0 0 1px oklch(0.81 0.13 ${t.hue} / 0.4)` : 'none',
                whiteSpace: 'nowrap',
                transition: 'color .15s ease, background .15s ease',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface FooterProps {
  categoryLabel: string
  tierLabel: string
}

/**
 * İnce künye şeridi.
 *
 * "Nasıl oynanır" bağlantısı kaldırıldı: kurallar artık sahnenin sağındaki
 * kalıcı kartta duruyor, aynı şeyi iki yere koymanın anlamı yok.
 */
export function Footer({ categoryLabel, tierLabel }: FooterProps) {
  return (
    <footer
      style={{
        padding: '0 20px 26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        color: '#4e5459',
      }}
    >
      <span>
        Seçki: <span style={{ color: '#7b8186' }}>{categoryLabel}</span>
      </span>
      <span style={{ color: '#2b3034' }}>/</span>
      <span>
        Zorluk: <span style={{ color: '#7b8186' }}>{tierLabel}</span>
      </span>
    </footer>
  )
}
