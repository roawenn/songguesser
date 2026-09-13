'use client'

import { govdeOku } from './govde'
import { useCallback, useEffect, useState } from 'react'
import type { MessageRow } from '@/app/api/yonetim/mesajlar/route'

/** Ziyaretçi mesajları — `/hakkinda` sayfasındaki formdan gelir. */
export function Messages({ onCount }: { onCount: (okunmamis: number) => void }) {
  const [rows, setRows] = useState<MessageRow[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    try {
      const res = await fetch('/api/yonetim/mesajlar')
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Mesajlar yüklenemedi.')
      const list = d.rows as MessageRow[]
      setRows(list)
      onCount(list.filter((m) => !m.read).length)
    } catch (e) {
      setHata((e as Error).message)
    }
  }, [onCount])

  useEffect(() => {
    void yukle()
  }, [yukle])

  async function isaretle(m: MessageRow) {
    // İyimser: arayüz ağı beklemesin.
    setRows((p) => p?.map((x) => (x.id === m.id ? { ...x, read: !x.read } : x)) ?? p)
    onCount((rows ?? []).filter((x) => (x.id === m.id ? x.read : !x.read)).length)
    await fetch('/api/yonetim/mesajlar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, read: !m.read }),
    })
    void yukle()
  }

  async function sil(m: MessageRow) {
    if (!confirm(`Silinsin mi?\n\n${m.name} ${m.surname}\n\nBu geri alınamaz.`)) return
    setRows((p) => p?.filter((x) => x.id !== m.id) ?? p)
    await fetch(`/api/yonetim/mesajlar?id=${m.id}`, { method: 'DELETE' })
    void yukle()
  }

  if (hata) return <div style={S.hata}>{hata}</div>
  if (!rows) return <div style={S.dim}>Yükleniyor…</div>
  if (rows.length === 0) return <div style={S.dim}>Henüz mesaj yok.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((m) => (
        <article key={m.id} style={S.kart(m.read)}>
          <header style={S.baslik}>
            <strong style={{ fontSize: 14, color: '#e6e8ea' }}>
              {m.name} {m.surname}
            </strong>
            <span style={S.tarih}>
              {new Date(m.created_at).toLocaleString('tr-TR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            {!m.read && <span style={S.rozet}>yeni</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => void isaretle(m)} style={S.dugme}>
                {m.read ? 'okunmadı yap' : 'okundu yap'}
              </button>
              <button type="button" onClick={() => void sil(m)} style={S.sil}>
                sil
              </button>
            </div>
          </header>
          {/* ⚠️ Ziyaretçi metni: `whiteSpace` ile satır sonları korunur, HTML olarak
              ASLA yorumlanmaz (React zaten kaçırır). */}
          <p style={S.govde}>{m.body}</p>
        </article>
      ))}
    </div>
  )
}

const S = {
  kart: (read: boolean) =>
    ({
      border: '1px solid ' + (read ? 'rgba(255,255,255,0.07)' : 'rgba(125,211,252,0.3)'),
      background: read ? 'rgba(255,255,255,0.015)' : 'rgba(125,211,252,0.05)',
      borderRadius: 6,
      padding: 14,
    }) as const,
  baslik: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 8,
  } as const,
  tarih: { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' } as const,
  rozet: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: '#cdeaf6',
    border: '1px solid rgba(125,211,252,0.4)',
    borderRadius: 3,
    padding: '2px 6px',
  } as const,
  govde: {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.6,
    color: '#b6bbbf',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  } as const,
  dugme: {
    padding: '5px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent',
    color: '#b6bbbf',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
  } as const,
  sil: {
    padding: '5px 10px',
    borderRadius: 4,
    border: '1px solid rgba(160,90,90,0.3)',
    background: 'transparent',
    color: '#a05a5a',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
  } as const,
  dim: { color: '#6a7075', fontSize: 12.5 } as const,
  hata: { color: '#d09a9a', fontSize: 12.5 } as const,
}
