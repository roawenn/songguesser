'use client'

import { useRef } from 'react'
import { STEPS, tr } from '@/game/ladder'

/**
 * Sahnenin iki yanındaki kartlar.
 *
 * Eskiden ikisi de hamburger arkasındaki bir modaldaydı. Masaüstünde sayfanın
 * alt yarısı bomboş dururken ayarları bir menünün arkasına saklamak yer
 * kazandırmıyor, sadece tıklama ekliyordu; artık ikisi de görünür ve sahneyi
 * ortalıyor. Dar ekranda ızgara tek sütuna düşer ve kartlar sahnenin altına
 * geçer (bkz. `.nk-stage-grid`, globals.css).
 */

const CAPTION = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  color: '#5c6267',
}

const CARD = {
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.018)',
  padding: 18,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 18,
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...CAPTION,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  )
}

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
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#d5d9dc' }}>{title}</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1.5,
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
          width: 42,
          height: 23,
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
            left: on ? 21 : 2,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: '#f0f2f3',
            transition: 'left .18s ease',
          }}
        />
      </button>
    </div>
  )
}

interface SettingsProps {
  volume: number
  reduce: boolean
  easySearch: boolean
  onVolume: (v: number) => void
  onReduce: (b: boolean) => void
  onEasySearch: (b: boolean) => void
}

export function SettingsCard({
  volume, reduce, easySearch, onVolume, onReduce, onEasySearch,
}: SettingsProps) {
  const volRef = useRef<HTMLDivElement>(null)
  const pct = `${Math.round(volume * 100)}%`

  function setVolFromEvent(clientX: number) {
    const el = volRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onVolume(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  return (
    <section style={CARD} aria-label="Ayarlar">
      <CardTitle>Ayarlar</CardTitle>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...CAPTION }}>
          <span>Ses</span>
          <span style={{ color: '#8d9398' }}>{pct}</span>
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
                inset: '0 auto 0 0',
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
    </section>
  )
}

export function HowToCard() {
  return (
    <section style={CARD} aria-label="Nasıl oynanır">
      <CardTitle>Nasıl oynanır</CardTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {[
          { n: '1', t: 'Çal', d: 'Bulunduğun kademeyi istediğin kadar dinle — dinlemek bedava.' },
          { n: '2', t: 'Yaz', d: 'Şarkı adı yeterli, sanatçıyı eklemen gerekmez.' },
          { n: '3', t: 'Geç', d: 'Bilemediysen pas geç; klip uzar, bir hakkın gider.' },
        ].map((s) => (
          <div key={s.n} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span
              style={{
                flex: 'none',
                width: 20,
                height: 20,
                borderRadius: 4,
                display: 'grid',
                placeContent: 'center',
                border: '1px solid var(--acc)',
                color: 'var(--acc)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
              }}
            >
              {s.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#d5d9dc' }}>{s.t}</div>
              <div
                style={{ fontSize: 12, lineHeight: 1.55, color: '#7b8186', marginTop: 2 }}
              >
                {s.d}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={CAPTION}>Merdiven</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            marginTop: 9,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#8d9398',
          }}
        >
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: 'flex', gap: 5 }}>
              {i > 0 && <span style={{ color: '#4e5459' }}>→</span>}
              <span>{tr(s)}s</span>
            </span>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#7b8186' }}>
        Türkçe karakter şart değil — &ldquo;gulpembe&rdquo; yazsan da
        &ldquo;Gülpembe&rdquo; kabul edilir. Küçük yazım hataları da affedilir.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 13,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        <a href="/nasil-oynanir" style={{ color: '#8d9398' }}>
          Tüm kurallar →
        </a>
        <a href="/hakkinda" style={{ color: '#6a7075' }}>
          Hakkında
        </a>
      </div>

      {/* Apple ToS: atıf zorunlu. */}
      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, color: '#5c6267' }}>
        Ses önizlemeleri Apple Music / iTunes aracılığıyla sağlanmaktadır.
      </p>
    </section>
  )
}
