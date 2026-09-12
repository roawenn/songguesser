'use client'

import { useState } from 'react'

/**
 * İletişim formu.
 *
 * E-posta adresi yerine geçer: adres sayfada yazılı durduğu sürece toplanır ve
 * spam'e döner. Mesaj doğrudan yönetim paneline düşer.
 */
export function ContactForm() {
  const [ad, setAd] = useState('')
  const [soyad, setSoyad] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'gitti'>('bos')
  const [hata, setHata] = useState<string | null>(null)
  // Bal küpü — ekranda görünmez, yalnızca botlar doldurur.
  const [website, setWebsite] = useState('')

  const eksik = !ad.trim() || !soyad.trim() || mesaj.trim().length < 3

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    if (eksik || durum === 'gonderiliyor') return
    setDurum('gonderiliyor')
    setHata(null)
    try {
      const res = await fetch('/api/iletisim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad, soyad, mesaj, website }),
      })
      const d = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Gönderilemedi.')
      setDurum('gitti')
      setAd('')
      setSoyad('')
      setMesaj('')
    } catch (err) {
      setHata((err as Error).message)
      setDurum('bos')
    }
  }

  if (durum === 'gitti') {
    return (
      <p role="status" style={{ margin: 0, color: '#8ecfe8' }}>
        Mesajın ulaştı, teşekkürler. En kısa sürede bakacağız.
      </p>
    )
  }

  return (
    <form onSubmit={gonder} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Ad"
          maxLength={80}
          aria-label="Ad"
          style={{ ...S.alan, flex: 1, minWidth: 140 }}
        />
        <input
          value={soyad}
          onChange={(e) => setSoyad(e.target.value)}
          placeholder="Soyad"
          maxLength={80}
          aria-label="Soyad"
          style={{ ...S.alan, flex: 1, minWidth: 140 }}
        />
      </div>

      <textarea
        value={mesaj}
        onChange={(e) => setMesaj(e.target.value)}
        placeholder="Mesajın…"
        rows={5}
        maxLength={4000}
        aria-label="Mesaj"
        style={{ ...S.alan, resize: 'vertical' }}
      />

      {/*
        Bal küpü. `display: none` yerine ekran dışına taşınıyor: bazı botlar
        gizli alanları atlar ama konumlandırılmış olanları doldurur.
        `tabIndex={-1}` ve `aria-hidden` klavye ve ekran okuyucuyu korur.
      */}
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        aria-hidden
        autoComplete="off"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      {hata && (
        <div role="alert" style={{ color: '#d09a9a', fontSize: 13 }}>
          {hata}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={eksik || durum === 'gonderiliyor'}
          style={{
            padding: '11px 22px',
            borderRadius: 5,
            border: '1px solid ' + (eksik ? 'rgba(255,255,255,0.12)' : '#7dd3fc'),
            background: eksik ? 'transparent' : '#7dd3fc',
            color: eksik ? '#5c6266' : '#0a0c0e',
            fontWeight: 600,
            fontSize: 14,
            cursor: eksik ? 'not-allowed' : 'pointer',
          }}
        >
          {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>
    </form>
  )
}

const S = {
  alan: {
    padding: '10px 13px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6e8ea',
    outline: 'none',
    font: 'inherit',
  },
} as const
