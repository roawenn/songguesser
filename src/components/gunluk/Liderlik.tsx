'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { LiderlikDonemi, LiderlikSatiri } from '@/game/liderlik'
import { useHesap } from '@/hooks/useHesap'
import { HarfAvatari } from '../hesap/HesapDugmesi'
import { Baslik, CAPTION, CARD } from './GunlukParcalar'

/**
 * Günlük sıralaması — Bugün / Bu hafta.
 *
 * Liste kenar önbellekli (60 sn) geliyor; oyuncunun KENDİ sırası ayrı ve
 * önbelleksiz. Yeni bitiren biri listede henüz görünmese de kendi sırasını
 * hemen görür; listede yoksa altta sabitlenir.
 *
 * `tazele`: değişince yeniden okunur (oyun bittiğinde kabuk artırıyor).
 */

interface Siram {
  sira: number
  toplam: number
  gunSayisi: number
  oyuncu: number
}

export function useLiderlik(donem: LiderlikDonemi, tazele: unknown) {
  const { kullanici, yuklendi } = useHesap()
  const [satirlar, setSatirlar] = useState<LiderlikSatiri[] | null>(null)
  const [siram, setSiram] = useState<Siram | null>(null)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    let iptal = false
    setHata(false)
    void fetch(`/api/liderlik?mod=gunluk&donem=${donem}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((v: { satirlar: LiderlikSatiri[] }) => !iptal && setSatirlar(v.satirlar))
      .catch(() => !iptal && setHata(true))
    return () => {
      iptal = true
    }
  }, [donem, tazele])

  useEffect(() => {
    if (!yuklendi || !kullanici) {
      setSiram(null)
      return
    }
    let iptal = false
    void fetch(`/api/liderlik/benim?mod=gunluk&donem=${donem}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((v: { siram: Siram | null }) => !iptal && setSiram(v.siram ?? null))
      .catch(() => undefined)
    return () => {
      iptal = true
    }
  }, [donem, tazele, yuklendi, kullanici])

  return { satirlar, siram, hata, benimAdim: kullanici?.ad ?? null }
}

function Sekmeler({ donem, setDonem }: { donem: LiderlikDonemi; setDonem: (d: LiderlikDonemi) => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4 }}>
      {(['gun', 'hafta'] as const).map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={donem === d}
          onClick={() => setDonem(d)}
          style={{
            flex: 1,
            padding: '6px 0',
            borderRadius: 5,
            border: `1px solid ${donem === d ? 'var(--acc)' : 'rgba(255,255,255,0.10)'}`,
            background: donem === d ? 'oklch(0.81 0.12 var(--hue) / 0.10)' : 'transparent',
            color: donem === d ? 'var(--acc)' : '#8c9297',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {d === 'gun' ? 'Bugün' : 'Bu hafta'}
        </button>
      ))}
    </div>
  )
}

function Satir({ s, benim, siraGenislik = 26 }: { s: Pick<LiderlikSatiri, 'sira' | 'ad' | 'toplam'>; benim: boolean; siraGenislik?: number }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '4px 6px',
        borderRadius: 5,
        background: benim ? 'oklch(0.81 0.12 var(--hue) / 0.10)' : 'transparent',
        fontSize: 13,
      }}
    >
      <span style={{ width: siraGenislik, flex: 'none', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: s.sira <= 3 ? 'var(--acc)' : '#6a7075' }}>
        {s.sira}
      </span>
      <HarfAvatari ad={s.ad} boyut={20} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: benim ? '#f2f4f5' : '#c3c8cc' }}>
        {s.ad}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e6e8ea' }}>{s.toplam}</span>
    </li>
  )
}

export function LiderlikListesi({ sinir, tazele, donemBaslangic = 'gun' }: { sinir: number; tazele?: unknown; donemBaslangic?: LiderlikDonemi }) {
  const [donem, setDonem] = useState<LiderlikDonemi>(donemBaslangic)
  const { satirlar, siram, hata, benimAdim } = useLiderlik(donem, tazele)
  const gorunen = satirlar?.slice(0, sinir) ?? null
  const listedeyim = benimAdim !== null && gorunen?.some((s) => s.ad === benimAdim)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Sekmeler donem={donem} setDonem={setDonem} />
      {hata ? (
        <p style={{ margin: 0, fontSize: 12.5, color: '#d09a9a' }}>Sıralama yüklenemedi.</p>
      ) : !gorunen ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' }}>Yükleniyor…</p>
      ) : gorunen.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: '#8c9297', lineHeight: 1.6 }}>
          {donem === 'gun' ? 'Bugün henüz sıralamaya giren yok.' : 'Bu hafta henüz sıralamaya giren yok.'}
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {gorunen.map((s) => (
            <Satir key={`${s.sira}:${s.ad}`} s={s} benim={s.ad === benimAdim} />
          ))}
        </ol>
      )}
      {siram && !listedeyim && benimAdim && (
        <ol style={{ listStyle: 'none', margin: 0, padding: '6px 0 0', borderTop: '1px dashed rgba(255,255,255,0.10)' }}>
          <Satir s={{ sira: siram.sira, ad: benimAdim, toplam: siram.toplam }} benim />
        </ol>
      )}
      {siram && (
        <div style={{ ...CAPTION, textAlign: 'center' }}>
          {siram.oyuncu} oyuncu arasında {siram.sira}.
        </div>
      )}
    </div>
  )
}

/** Sol sütun kartı: ilk 10. */
export function LiderlikKarti({ tazele }: { tazele?: unknown }) {
  return (
    <section style={CARD} aria-label="Sıralama">
      <Baslik>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          Sıralama
          <Link href="/gunluk/liderlik" style={{ color: '#8c9297', textDecoration: 'none' }}>
            tümü →
          </Link>
        </span>
      </Baslik>
      <LiderlikListesi sinir={10} tazele={tazele} />
    </section>
  )
}

/** Özetteki tek satır: "Bugün 12. sıradasın". */
export function SiraSatiri({ tazele }: { tazele?: unknown }) {
  const { siram } = useLiderlik('gun', tazele)
  if (!siram) return null
  return (
    <p style={{ margin: 0, fontSize: 14.5, color: '#d5d9dc', textAlign: 'center' }}>
      Bugün <strong style={{ color: 'var(--acc)' }}>{siram.sira}.</strong> sıradasın · {siram.oyuncu} oyuncu{' '}
      <Link href="/gunluk/liderlik" style={{ color: '#8c9297', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        sıralama →
      </Link>
    </p>
  )
}
