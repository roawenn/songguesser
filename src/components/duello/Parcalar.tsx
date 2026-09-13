'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DUELLO_TUR, type DuelloSkor } from '@/game/duel'
import type { DuelloApi } from '@/hooks/useDuello'

/**
 * İki düellonun paylaştığı ekranlar.
 *
 * ⚠️ Bunların hiçbiri OYUNA BAĞLI değil: lobi kodu, geri sayım, skor şeridi,
 * bekleme ve bitiş tablosu protokolün parçası. `DuelloShell`'de kalsalardı
 * ünlü düellosu 300 satır kopya isterdi ve iki kopya zamanla ayrışırdı.
 *
 * Oyuna bağlı KALAN tek şey, bitiş ekranındaki listenin nasıl yazıldığı ve
 * maliyetin nasıl okunduğu — ikisi de prop.
 */

export const M = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
}

export const KART = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
  padding: 26,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.02)',
  width: '100%',
}

/** Lobi ve bekleme ekranlarının üstündeki marka. */
export function Marka() {
  return (
    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 30,
        lineHeight: 1,
        color: '#f2f4f5',
        textShadow: '0 0 28px var(--accSoft)',
      }}
    >
      tahmin
    </div>
  )
}

export function Lobi({ kod }: { kod: string }) {
  const [kopyalandi, setKopyalandi] = useState(false)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/duello/${kod}`

  useEffect(() => {
    if (!kopyalandi) return
    const id = setTimeout(() => setKopyalandi(false), 2200)
    return () => clearTimeout(id)
  }, [kopyalandi])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        width: '100%',
        maxWidth: 460,
      }}
    >
      <Marka />

      <div style={{ ...KART, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ ...M, color: '#6a7075' }}>Lobi kodu</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 46,
            letterSpacing: '.22em',
            color: 'var(--acc)',
            textShadow: '0 0 30px var(--accSoft)',
          }}
        >
          {kod}
        </div>

        <p style={{ margin: 0, fontSize: 14, color: '#b6bbbf', lineHeight: 1.6 }}>
          Bu bağlantıyı arkadaşına gönder. O girdiği anda ikiniz aynı beş turu
          kolaydan zora oynamaya başlayacaksınız.
        </p>

        {/*
          ⚠️ Panoya kopyalama BURADA zorunlu. Düellonun tek işe yarama yolu linki
          birine göndermek; paylaşım düğmeleri kaldırıldığı için başka çıkış yok.
        */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(link)
              .then(() => setKopyalandi(true))
              .catch(() => setKopyalandi(false))
          }}
          style={{
            ...M,
            padding: '12px 22px',
            borderRadius: 5,
            border: '1px solid var(--acc)',
            background: 'oklch(0.81 0.12 var(--hue) / 0.12)',
            color: 'var(--acc)',
          }}
        >
          {kopyalandi ? 'kopyalandı ✓' : 'bağlantıyı kopyala'}
        </button>

        <div style={{ ...M, color: '#6a7075', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--acc)',
              animation: 'nk-flick 1.4s ease-in-out infinite',
            }}
          />
          arkadaşın bekleniyor
        </div>
      </div>
    </div>
  )
}

export function GeriSayim({ n }: { n: number }) {
  return (
    <div
      role="status"
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 96,
        color: 'var(--acc)',
        textShadow: '0 0 40px var(--accSoft)',
        animation: 'nk-pop .4s cubic-bezier(.34,1.56,.64,1) both',
      }}
      key={n}
    >
      {n}
    </div>
  )
}

export function Kutu({ tone, children }: { tone: 'bad' | 'warn'; children: React.ReactNode }) {
  const c = tone === 'bad' ? '160,90,90' : '201,162,94'
  return (
    <div
      role="status"
      style={{
        padding: '14px 20px',
        borderRadius: 8,
        border: `1px solid rgba(${c},0.35)`,
        background: `rgba(${c},0.07)`,
        color: tone === 'bad' ? '#d09a9a' : '#d5b477',
        fontSize: 13.5,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

/** Tek turun sonucu: bildi · bilemedi · hiç cevaplamadı. */
export function Im({ ok }: { ok: boolean | null }) {
  const [im, renk, ad] =
    ok === null
      ? ['·', '#4e5459', 'cevaplamadı']
      : ok
        ? ['✓', '#5fb87f', 'bildi']
        : ['✕', '#a05a5a', 'bilemedi']
  return (
    <span title={ad} aria-label={ad} style={{ color: renk }}>
      {im}
    </span>
  )
}

export function Skor<T>({ d }: { d: DuelloApi<T> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, ...M }}>
      <span style={{ color: 'var(--acc)' }}>Sen {d.benim.dogru}</span>
      <span style={{ color: '#34393d' }}>—</span>
      <span style={{ color: '#b6bbbf' }}>{d.rakip.dogru} Rakip</span>
      <span style={{ color: '#4e5459' }}>
        {Math.min(d.aktif + 1, DUELLO_TUR)}/{DUELLO_TUR}
      </span>
    </div>
  )
}

/**
 * Beş turu bitirip rakibi bekleme ekranı — düellodaki TEK bekleme noktası.
 *
 * ⚠️ Liste ve kazanan BURADA GÖSTERİLMEZ. İki oyuncu sonucu aynı anda görmeli;
 * erken bitiren kişi cevapları görürse onları dışarıdan (WhatsApp vb.)
 * söyleyebilir. Yalnızca kendi doğru sayısı ve rakibin ilerlemesi var.
 */
export function SonBekleme<T>({ d, birim }: { d: DuelloApi<T>; birim: string }) {
  return (
    <div style={{ ...KART, alignItems: 'center', textAlign: 'center', maxWidth: 420, gap: 18 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: '#e6e8ea' }}>
        Sen bitirdin
      </div>

      <div style={{ ...M, color: '#8c9297' }}>
        {d.benim.dogru}/{DUELLO_TUR} doğru
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, ...M, color: '#6a7075' }}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--acc)',
            animation: 'nk-flick 1.4s ease-in-out infinite',
          }}
        />
        rakibin {d.rakipIlerleme}/{DUELLO_TUR} bitirdi
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6a7075' }}>
        {birim === 'ünlü' ? 'Ünlüler' : 'Şarkılar'} ve kazanan, ikiniz de bitirince
        aynı anda açılacak.
      </p>
    </div>
  )
}

function Satir({
  ad,
  s,
  vurgu,
  maliyetMetni,
}: {
  ad: string
  s: DuelloSkor
  vurgu: boolean
  maliyetMetni: (n: number) => string
}) {
  return (
    <tr style={{ color: vurgu ? 'var(--acc)' : '#b6bbbf' }}>
      <td style={{ textAlign: 'left', padding: '7px 0', ...M }}>{ad}</td>
      <td style={{ textAlign: 'right', padding: '7px 0' }}>
        {s.dogru}/{DUELLO_TUR} doğru
      </td>
      <td style={{ textAlign: 'right', padding: '7px 0', color: '#757b80' }}>
        {maliyetMetni(s.maliyet)}
      </td>
    </tr>
  )
}

export function Bitis<T extends { id: string }>({
  d,
  satir,
  maliyetMetni,
  tekBasinaYol,
  birim = 'şarkılar',
}: {
  d: DuelloApi<T>
  /** Listedeki bir satır nasıl yazılır. */
  satir: (oge: T) => { ust: string; alt?: string }
  maliyetMetni: (n: number) => string
  tekBasinaYol: string
  birim?: string
}) {
  const baslik =
    d.sonuc === 'sen' ? 'Kazandın' : d.sonuc === 'rakip' ? 'Rakibin kazandı' : 'Berabere'

  return (
    <div style={{ ...KART, alignItems: 'center', textAlign: 'center', maxWidth: 460 }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 40,
          color: d.sonuc === 'sen' ? 'var(--acc)' : '#e6e8ea',
        }}
      >
        {baslik}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <tbody>
          <Satir ad="Sen" s={d.benim} vurgu={d.sonuc === 'sen'} maliyetMetni={maliyetMetni} />
          <Satir ad="Rakip" s={d.rakip} vurgu={d.sonuc === 'rakip'} maliyetMetni={maliyetMetni} />
        </tbody>
      </table>

      {d.rakip.eksik > 0 && (
        <p style={{ margin: 0, ...M, color: '#8a7448' }}>
          rakibin {d.rakip.eksik} turu bitirmedi
        </p>
      )}

      {/* Liste ancak tur bitince açılıyor; oyuncu ne çıktığını burada görür. */}
      {d.songs.length === DUELLO_TUR && (
        <div
          style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}
        >
          <div style={{ ...M, color: '#6a7075', marginBottom: 10 }}>{birim} · sen / rakip</div>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            {d.songs.map((s, i) => {
              const r = satir(s)
              return (
                <li
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left' }}
                >
                  <span style={{ ...M, color: '#4e5459', width: 14, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: '#d7dadd', lineHeight: 1.4 }}>
                    {r.ust}
                    {r.alt && <span style={{ color: '#757b80' }}> · {r.alt}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 13, display: 'inline-flex', gap: 9 }}>
                    <Im ok={d.sonuclar[i]?.benim ?? null} />
                    <Im ok={d.sonuclar[i]?.rakip ?? null} />
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <Link
        href={tekBasinaYol}
        style={{
          padding: '13px 26px',
          borderRadius: 5,
          border: '1px solid var(--acc)',
          background: 'var(--acc)',
          color: '#0a0c0e',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Tek başına oyna
      </Link>
    </div>
  )
}
