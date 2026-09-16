'use client'

import { useCallback, useEffect, useState } from 'react'
import { artworkAt } from '@/data/schema'
import type { GunlukOge, GunlukSet } from '@/game/gunluk'
import { govdeOku } from './govde'

/**
 * Günün seti — CEVAPLAR DAHİL. Yönetici "bugün ne çıktı, medya ölmüş mü,
 * kaç kişi oynadı" sorularına buradan bakıyor.
 *
 * ⚠️ Set bu görünümle KURULMAZ; henüz kimse başlamadıysa "kurulmadı" yazar.
 */

function ogeAdi(o: GunlukOge): { ad: string; alt: string; gorsel: string } {
  switch (o.oyun) {
    case 'sarki':
      return { ad: o.sarki.t, alt: `${o.sarki.a} · ${o.sarki.y} · kademe ${o.sarki.d}`, gorsel: artworkAt(o.sarki.ar, 100) }
    case 'unlu':
      return { ad: o.unlu.ad, alt: `kademe ${o.unlu.d}`, gorsel: '' }
    case 'kapak':
      return { ad: o.kapak.al, alt: `${o.kapak.a} · ${o.kapak.y} · kademe ${o.kapak.d}`, gorsel: artworkAt(o.ar, 100) }
  }
}

const ADI = { sarki: 'Şarkı', unlu: 'Ünlü', kapak: 'Kapak' } as const

export function GunlukOnizleme() {
  const [gun, setGun] = useState('')
  const [veri, setVeri] = useState<{ gun: string; set: GunlukSet | null; oturum: { toplam: number; biten: number; supheli: number } } | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setHata(null)
    const res = await fetch(`/api/yonetim/gunluk${gun ? `?gun=${gun}` : ''}`)
    const d = await govdeOku(res)
    if (!res.ok) return setHata(d.error ?? 'Okunamadı.')
    setVeri(d as unknown as NonNullable<typeof veri>)
    if (!gun) setGun((d as { gun: string }).gun)
  }, [gun])

  useEffect(() => {
    void yukle()
  }, [yukle])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={gun}
          onChange={(e) => setGun(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.3)', color: '#e6e8ea' }}
        />
        {veri && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#8c9297' }}>
            {veri.oturum.toplam} başlayan · {veri.oturum.biten} bitiren · {veri.oturum.supheli} şüpheli
          </span>
        )}
      </div>
      {hata && <div style={{ color: '#d09a9a', fontSize: 12.5 }}>{hata}</div>}
      {veri && !veri.set && <div style={{ color: '#6a7075', fontSize: 12.5 }}>Bu günün seti kurulmadı (henüz kimse başlamadı).</div>}
      {veri?.set?.slotlar.map((s, i) => (
        <section key={i} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8c9297', marginBottom: 8 }}>
            {i + 1}. {ADI[s.oyun]} · {s.zorluk} · aktif aday {s.aktif + 1}/{s.adaylar.length}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.adaylar.map((o, j) => {
              const b = ogeAdi(o)
              return (
                <li key={j} style={{ color: j === s.aktif ? '#e6e8ea' : j < s.aktif ? '#6a7075' : '#8c9297', fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {b.gorsel && <img src={b.gorsel} alt="" width={28} height={28} style={{ borderRadius: 3 }} />}
                    <strong style={{ fontWeight: j === s.aktif ? 600 : 400, textDecoration: j < s.aktif ? 'line-through' : 'none' }}>{b.ad}</strong>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' }}>{b.alt}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
