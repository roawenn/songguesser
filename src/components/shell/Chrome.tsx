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

/** Hamburger + ortada marka. */
export function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 20px 12px',
        maxWidth: 1180,
        width: '100%',
        margin: '0 auto',
      }}
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menü"
        className="nk-burger"
        style={{
          display: 'grid',
          gap: 4,
          width: 38,
          height: 38,
          placeContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.03)',
          color: '#cfd3d6',
        }}
      >
        <span style={{ display: 'block', width: 15, height: 1.5, background: 'currentColor' }} />
        <span style={{ display: 'block', width: 15, height: 1.5, background: 'currentColor' }} />
        <span style={{ display: 'block', width: 9, height: 1.5, background: 'currentColor' }} />
      </button>

      <div style={{ flex: 1, textAlign: 'center' }}>
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
          nakarat
        </h1>
      </div>

      <div style={{ width: 38, flex: 'none' }} />

      <style>{`
        .nk-burger:hover {
          border-color: rgba(255,255,255,0.24) !important;
          background: rgba(255,255,255,0.06) !important;
        }
      `}</style>
    </header>
  )
}

interface StripProps {
  category: ChipId
  tier: Difficulty
  onCategory: (c: ChipId) => void
  onTier: (t: Difficulty) => void
}

/**
 * İki ortalanmış satır: üstte seçki çipleri, altında zorluk kademesi.
 *
 * Tasarımda 8 çip vardı ve zorluk grubuyla aynı satıra sığıyordu. Bizde 11 çip
 * var; aynı satırda kalsalar sondaki üçü sessizce kırpılıyordu. Ayrıca zorluk
 * artık şarkının kendi kademesini filtrelediği için kendi satırını hak ediyor.
 */
export function ControlStrip({ category, tier, onCategory, onTier }: StripProps) {
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
        maxWidth: 1180,
        width: '100%',
        margin: '0 auto',
        padding: '4px 20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}
    >
      {/* Dar ekranda yatay kayar; kenardaki soluklaşma devamı olduğunu gösterir. */}
      <nav
        ref={stripRef}
        className="no-scrollbar nk-strip"
        style={{ maxWidth: '100%', overflowX: 'auto' }}
        aria-label="Seçki"
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 2px 4px',
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
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 15px',
                  border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 4,
                  background: on ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.015)',
                  color: on ? '#f0f2f3' : '#7b8186',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '.04em',
                  boxShadow: on ? '0 0 22px -6px var(--accSoft)' : 'none',
                  transition: 'color .15s ease, border-color .15s ease',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 10,
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
            // Her kademe kendi rengini taşır; seçili olan dolu, diğerleri soluk.
            const color = `oklch(0.81 0.13 ${t.hue})`
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTier(t.id)}
                aria-pressed={on}
                title={t.hint}
                style={{
                  padding: '7px 12px',
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
    </div>
  )
}

interface FooterProps {
  categoryLabel: string
  tierLabel: string
  onHow: () => void
}

export function Footer({ categoryLabel, tierLabel, onHow }: FooterProps) {
  return (
    <footer
      style={{
        padding: '0 20px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: '#5e6469',
      }}
    >
      <span>
        Seçki: <span style={{ color: '#9aa0a5' }}>{categoryLabel}</span>
      </span>
      <span style={{ color: '#34393d' }}>/</span>
      <span>
        Zorluk: <span style={{ color: '#9aa0a5' }}>{tierLabel}</span>
      </span>
      <span style={{ color: '#34393d' }}>/</span>
      <button
        type="button"
        onClick={onHow}
        className="nk-footlink"
        style={{
          border: 0,
          background: 'transparent',
          padding: 0,
          color: '#5e6469',
          font: 'inherit',
          borderBottom: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        Nasıl oynanır
      </button>

      <style>{`.nk-footlink:hover { color: #cfd3d6 !important; }`}</style>
    </footer>
  )
}
