'use client'

import { useEffect, useState } from 'react'
import type { LiderlikDonemi } from '@/game/liderlik'
import { girisAdresi, useHesap } from '@/hooks/useHesap'
import { Baslik, CAPTION, CARD } from './GunlukParcalar'

/**
 * Günlük sıralaması — YALNIZCA KENDİ SIRAN.
 *
 * ⚠️ BAŞKA OYUNCULARIN ADI HİÇBİR YERDE ÇİZİLMEZ. Burada ilk 10'un (ve ayrı
 * sayfada 50'nin) adı ve puanı listeleniyordu; ad artık Google profilinden
 * geldiği için o liste gerçek ad soyadların herkese açık listesi olurdu.
 * Listeyi besleyen `/api/liderlik` ve `/gunluk/liderlik` sayfası da kaldırıldı
 * — uç nokta dursaydı arayüz çizmese bile adlar tek istekle okunabilirdi.
 *
 * Geriye yarışın ölçülebilir kısmı kalıyor: kaçıncı sıradasın ve kaç kişi
 * arasında. Bu bilgi `liderlik_benim` RPC'sinden geliyor ve tek satır.
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
  const { kullanici, girisAcik, yuklendi } = useHesap()
  const [siram, setSiram] = useState<Siram | null>(null)
  const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor')

  useEffect(() => {
    if (!yuklendi) return
    if (!kullanici) {
      setSiram(null)
      setDurum('hazir')
      return
    }
    let iptal = false
    setDurum('yukleniyor')
    void fetch(`/api/liderlik/benim?mod=gunluk&donem=${donem}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('istek'))))
      .then((v: { siram: Siram | null }) => {
        if (iptal) return
        setSiram(v.siram ?? null)
        setDurum('hazir')
      })
      .catch(() => !iptal && setDurum('hata'))
    return () => {
      iptal = true
    }
  }, [donem, tazele, yuklendi, kullanici])

  return { siram, durum, girisli: Boolean(kullanici), girisAcik, yuklendi }
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

const BILGI = { margin: 0, fontSize: 12.5, color: '#8c9297', lineHeight: 1.6 } as const

/** Sıranın kendisi: büyük rakam, altında kaç kişi arasında olduğun. */
function Sira({ siram, donem }: { siram: Siram; donem: LiderlikDonemi }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, lineHeight: 1.1, color: 'var(--acc)' }}>
        {siram.sira}.
      </div>
      <div style={{ ...CAPTION, marginTop: 4 }}>{siram.oyuncu} oyuncu arasında</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#c3c8cc' }}>
        {siram.toplam} puan
        {donem === 'hafta' && ` · ${siram.gunSayisi} gün`}
      </div>
    </div>
  )
}

export function SiraPaneli({ tazele, donemBaslangic = 'gun' }: { tazele?: unknown; donemBaslangic?: LiderlikDonemi }) {
  const [donem, setDonem] = useState<LiderlikDonemi>(donemBaslangic)
  const { siram, durum, girisli, girisAcik, yuklendi } = useLiderlik(donem, tazele)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Sekmeler donem={donem} setDonem={setDonem} />
      {!yuklendi ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' }}>Yükleniyor…</p>
      ) : !girisli ? (
        <p style={BILGI}>
          Sıralamaya girmek için{' '}
          {girisAcik ? (
            <a href={girisAdresi()} style={{ color: 'var(--acc)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Google ile giriş yap
            </a>
          ) : (
            'giriş yap'
          )}
          . Sıran yalnızca sana gösterilir.
        </p>
      ) : durum === 'hata' ? (
        <p style={{ margin: 0, fontSize: 12.5, color: '#d09a9a' }}>Sıralama yüklenemedi.</p>
      ) : durum === 'yukleniyor' ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' }}>Yükleniyor…</p>
      ) : !siram ? (
        <p style={BILGI}>
          {donem === 'gun' ? 'Bugün henüz sıralamaya girmedin.' : 'Bu hafta henüz sıralamaya girmedin.'}
        </p>
      ) : (
        <Sira siram={siram} donem={donem} />
      )}
    </div>
  )
}

/** Sol sütun kartı. */
export function LiderlikKarti({ tazele }: { tazele?: unknown }) {
  return (
    <section style={CARD} aria-label="Sıralamadaki yerin">
      <Baslik>Senin sıran</Baslik>
      <SiraPaneli tazele={tazele} />
    </section>
  )
}

/** Özetteki tek satır: "Bugün 12. sıradasın". */
export function SiraSatiri({ tazele }: { tazele?: unknown }) {
  const { siram } = useLiderlik('gun', tazele)
  if (!siram) return null
  return (
    <p style={{ margin: 0, fontSize: 14.5, color: '#d5d9dc', textAlign: 'center' }}>
      Bugün <strong style={{ color: 'var(--acc)' }}>{siram.sira}.</strong> sıradasın · {siram.oyuncu} oyuncu
    </p>
  )
}
