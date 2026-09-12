'use client'

import { useEffect, useRef } from 'react'
import { STEPS, tr } from '@/game/ladder'

export type SheetTab = 'how' | 'set'

interface Props {
  tab: SheetTab
  volume: number
  reduce: boolean
  easySearch: boolean
  onTab: (t: SheetTab) => void
  onVolume: (v: number) => void
  onReduce: (b: boolean) => void
  onEasySearch: (b: boolean) => void
  onClose: () => void
}

/** Ayarlar sayfasındaki aç/kapa satırı. */
function Toggle({
  title, hint, on, onChange,
}: {
  title: string
  hint: string
  on: boolean
  onChange: (b: boolean) => void
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}
    >
      <div>
        <div style={{ fontSize: 13.5, color: '#d5d9dc' }}>{title}</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: '#6d7378',
            marginTop: 3,
          }}
        >
          {hint}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={title}
        style={{
          flex: 'none',
          width: 44,
          height: 24,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
          background: on ? 'var(--acc)' : 'rgba(255,255,255,0.06)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#f0f2f3',
            transition: 'left .18s ease',
          }}
        />
      </button>
    </div>
  )
}

export function Sheet({
  tab, volume, reduce, easySearch, onTab, onVolume, onReduce, onEasySearch, onClose,
}: Props) {
  const volRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  /**
   * Odak tuzağı ve odak iadesi.
   *
   * `aria-modal="true"` yalnızca bir BEYANDIR; tarayıcı Tab'ı kendiliğinden
   * kısıtlamaz. Tuzak olmadan Tab kullanıcıyı arkadaki oyun ekranına taşıyordu
   * — ekran okuyucu "menü açık" derken odak menüde olmuyordu. Kapanışta odak
   * menüyü açan düğmeye geri verilir, yoksa sayfanın başına düşer.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])

  function setVolFromEvent(clientX: number) {
    const el = volRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onVolume(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  const pct = `${Math.round(volume * 100)}%`
  const tabStyle = (active: boolean) => ({
    border: 0,
    background: 'transparent',
    padding: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '.14em',
    textTransform: 'uppercase' as const,
    color: active ? '#f0f2f3' : '#6d7378',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menü"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        background: 'rgba(6,7,9,0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: 18,
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          background: '#101316',
          boxShadow: '0 40px 90px -30px rgba(0,0,0,0.95)',
          animation: 'nk-rise .3s ease both',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <button type="button" onClick={() => onTab('how')} style={tabStyle(tab === 'how')}>
              Nasıl oynanır
            </button>
            <button type="button" onClick={() => onTab('set')} style={tabStyle(tab === 'set')}>
              Ayarlar
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              border: 0,
              background: 'transparent',
              color: '#7b8186',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {tab === 'how' ? (
          <div
            style={{
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              fontSize: 13.5,
              lineHeight: 1.65,
              color: '#b6bbbf',
            }}
          >
            <p style={{ margin: 0 }}>
              Nakarat sana bir şarkının başından kısa bir parça çalar. İlk denemede
              yarım saniye duyarsın; her yanlış tahmin ya da pas geçişte süre uzar.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: '#8d9398',
              }}
            >
              {STEPS.map((s, i) => (
                <span key={s} style={{ display: 'flex', gap: 6 }}>
                  {i > 0 && <span>→</span>}
                  <span>{tr(s)}s</span>
                </span>
              ))}
            </div>
            <p style={{ margin: 0 }}>
              Beş deneme hakkın var. Şarkı adını yazman yeterli, sanatçıyı da
              eklemen gerekmez.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#d5d9dc', fontWeight: 500 }}>Zorluk</strong>{' '}
              şarkının ne kadar bilindiğini belirler: <em>Kolay</em> herkesin bildiği
              parçaları getirir, <em>İmkansız</em> ise türü yakından takip edenlerin
              bileceği derin kesimi.
            </p>
            <p style={{ margin: 0 }}>
              Türkçe karakter yazmak zorunda değilsin — &ldquo;gulpembe&rdquo; yazsan da
              &ldquo;Gülpembe&rdquo; kabul edilir. Küçük yazım hataları da affedilir.
              Yardım istemiyorsan Ayarlar&apos;dan &ldquo;Kolay arama&rdquo;yı kapat.
            </p>
            <p style={{ margin: 0, color: '#7b8186' }}>
              Seçki değiştirdiğinde şarkı havuzu ve arayüz rengi birlikte değişir.
            </p>

            {/* Apple ToS: atıf zorunlu. */}
            <p
              style={{
                margin: 0,
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.07)',
                fontSize: 11.5,
                color: '#6a7075',
              }}
            >
              Ses önizlemeleri ve künye bilgileri Apple Music / iTunes aracılığıyla
              sağlanmaktadır.{' '}
              <a href="/hakkinda" style={{ borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
                Hakkında
              </a>
            </p>
          </div>
        ) : (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '.2em',
                  textTransform: 'uppercase',
                  color: '#6d7378',
                }}
              >
                <span>Ses</span>
                <span>{pct}</span>
              </div>
              <div
                ref={volRef}
                role="slider"
                tabIndex={0}
                aria-label="Ses seviyesi"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(volume * 100)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setVolFromEvent(e.clientX)
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) setVolFromEvent(e.clientX)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') onVolume(Math.max(0, volume - 0.05))
                  if (e.key === 'ArrowRight') onVolume(Math.min(1, volume + 0.05))
                }}
                style={{
                  marginTop: 11,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  touchAction: 'none',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.09)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: pct,
                      background: 'var(--acc)',
                      borderRadius: 2,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: pct,
                      width: 13,
                      height: 13,
                      marginLeft: -6.5,
                      marginTop: -6.5,
                      borderRadius: '50%',
                      background: '#f0f2f3',
                      boxShadow: '0 0 0 4px var(--accSoft)',
                    }}
                  />
                </div>
              </div>
            </div>

            <Toggle
              title="Kolay arama"
              hint={easySearch ? 'Yazarken öneri listesi çıkar' : 'Öneri yok, kendin yazarsın'}
              on={easySearch}
              onChange={onEasySearch}
            />

            <Toggle
              title="Azaltılmış animasyon"
              hint={reduce ? 'Makara, konfeti ve geçişler durdu' : 'Makara döner, bilince konfeti patlar'}
              on={reduce}
              onChange={onReduce}
            />
          </div>
        )}
      </div>
    </div>
  )
}
