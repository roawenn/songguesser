'use client'

import { useCallback, useEffect, useState } from 'react'
import type { KullaniciSatiri } from '@/app/api/yonetim/kullanicilar/route'
import { govdeOku } from './govde'

/**
 * Kullanıcılar: arama, ban / ban kaldır, ad sıfırlama, şüphe bayrağını temizleme.
 *
 * ⚠️ Ad sıfırlama eski adı KALICI yasaklar ve kullanıcıyı yeni ad seçmeye
 * zorlar; ban oturumlarını da siler. İkisi de onay istiyor.
 */

type Filtre = 'hepsi' | 'banli' | 'supheli'

interface OturumOzeti {
  gun: string
  puan: number | null
  basladi: string
  bitti: string | null
  supheli: boolean
  zaman_asimi: boolean
}

const tarih = (s: string | null) =>
  s ? new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export function KullanicilarPanel() {
  const [q, setQ] = useState('')
  const [aranan, setAranan] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('hepsi')
  const [sayfa, setSayfa] = useState(0)
  const [rows, setRows] = useState<KullaniciSatiri[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [acik, setAcik] = useState<string | null>(null)
  const [sonuclar, setSonuclar] = useState<OturumOzeti[] | null>(null)

  const yukle = useCallback(async () => {
    setHata(null)
    try {
      const p = new URLSearchParams({ filtre, sayfa: String(sayfa) })
      if (aranan) p.set('q', aranan)
      const res = await fetch(`/api/yonetim/kullanicilar?${p}`)
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Kullanıcılar yüklenemedi.')
      setRows(d.rows as KullaniciSatiri[])
    } catch (e) {
      setHata((e as Error).message)
    }
  }, [filtre, sayfa, aranan])

  useEffect(() => {
    void yukle()
  }, [yukle])

  async function islem(k: KullaniciSatiri, ad: 'banla' | 'ban-kaldir' | 'ad-sifirla' | 'supheli-temizle') {
    let sebep = ''
    if (ad === 'banla') {
      const s = prompt(`${k.kullanici_adi ?? k.email} banlansın mı?\n\nSebep (isteğe bağlı):`)
      if (s === null) return
      sebep = s
    } else if (ad === 'ad-sifirla') {
      if (!confirm(`"${k.kullanici_adi}" adı sıfırlansın mı?\n\nEski ad kalıcı olarak yasaklanır, kullanıcı yeni ad seçmek zorunda kalır.`)) return
      sebep = 'yönetim: uygunsuz ad'
    }
    setMesgul(k.id)
    try {
      const res = await fetch('/api/yonetim/kullanicilar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: k.id, islem: ad, sebep }),
      })
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'İşlem yapılamadı.')
      await yukle()
    } catch (e) {
      setHata((e as Error).message)
    } finally {
      setMesgul(null)
    }
  }

  async function sonuclariAc(id: string) {
    if (acik === id) {
      setAcik(null)
      return
    }
    setAcik(id)
    setSonuclar(null)
    const res = await fetch(`/api/yonetim/kullanicilar/sonuclar?id=${id}`)
    const d = await govdeOku(res)
    setSonuclar(res.ok ? (d.rows as OturumOzeti[]) : [])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSayfa(0)
          setAranan(q.trim())
        }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad ya da e-posta ara…" style={S.girdi} />
        <button type="submit" style={S.dugme}>Ara</button>
        {(['hepsi', 'banli', 'supheli'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setSayfa(0)
              setFiltre(f)
            }}
            style={{ ...S.dugme, ...(filtre === f ? S.secili : {}) }}
          >
            {f === 'hepsi' ? 'Hepsi' : f === 'banli' ? 'Banlılar' : 'Şüpheliler'}
          </button>
        ))}
      </form>

      {hata && <div style={S.hata}>{hata}</div>}
      {!rows ? (
        <div style={S.dim}>Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div style={S.dim}>Kullanıcı yok.</div>
      ) : (
        rows.map((k) => (
          <article key={k.id} style={S.kart(k.banli_at !== null)}>
            <header style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: k.kullanici_adi ? '#e6e8ea' : '#6a7075', fontSize: 14 }}>
                {k.kullanici_adi ?? '(ad yok)'}
              </strong>
              <span style={S.kucuk}>{k.email}</span>
              {k.banli_at && <span style={S.rozet('#d09a9a')}>banlı{k.ban_sebebi ? `: ${k.ban_sebebi}` : ''}</span>}
              {k.supheli > 0 && <span style={S.rozet('#d5b477')}>şüpheli ×{k.supheli}</span>}
              <span style={{ ...S.kucuk, marginLeft: 'auto' }}>
                {k.gun} gün · katıldı {tarih(k.olusturuldu)} · son {tarih(k.son_giris)}
              </span>
            </header>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void sonuclariAc(k.id)} style={S.dugme}>
                {acik === k.id ? 'sonuçları gizle' : 'sonuçlar'}
              </button>
              {k.kullanici_adi && (
                <button type="button" disabled={mesgul === k.id} onClick={() => void islem(k, 'ad-sifirla')} style={S.dugme}>
                  adı sıfırla
                </button>
              )}
              {k.supheli > 0 && (
                <button type="button" disabled={mesgul === k.id} onClick={() => void islem(k, 'supheli-temizle')} style={S.dugme}>
                  şüpheyi kaldır
                </button>
              )}
              {k.banli_at ? (
                <button type="button" disabled={mesgul === k.id} onClick={() => void islem(k, 'ban-kaldir')} style={S.dugme}>
                  banı kaldır
                </button>
              ) : (
                <button type="button" disabled={mesgul === k.id} onClick={() => void islem(k, 'banla')} style={S.sil}>
                  banla
                </button>
              )}
            </div>
            {acik === k.id && (
              <div style={{ marginTop: 10 }}>
                {!sonuclar ? (
                  <div style={S.dim}>Yükleniyor…</div>
                ) : sonuclar.length === 0 ? (
                  <div style={S.dim}>Günlük sonucu yok.</div>
                ) : (
                  <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#b6bbbf' }}>
                    <tbody>
                      {sonuclar.map((s) => (
                        <tr key={s.gun}>
                          <td style={S.td}>{s.gun}</td>
                          <td style={S.td}>{s.puan ?? '—'}</td>
                          <td style={S.td}>{tarih(s.basladi)} → {tarih(s.bitti)}</td>
                          <td style={S.td}>{s.supheli ? 'şüpheli' : ''}{s.zaman_asimi ? ' süre doldu' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </article>
        ))
      )}

      {rows && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={sayfa === 0} onClick={() => setSayfa((s) => s - 1)} style={S.dugme}>← önceki</button>
          <button type="button" disabled={rows.length < 50} onClick={() => setSayfa((s) => s + 1)} style={S.dugme}>sonraki →</button>
        </div>
      )}
    </div>
  )
}

const S = {
  kart: (banli: boolean) =>
    ({
      border: '1px solid ' + (banli ? 'rgba(208,154,154,0.35)' : 'rgba(255,255,255,0.07)'),
      background: banli ? 'rgba(208,154,154,0.05)' : 'rgba(255,255,255,0.015)',
      borderRadius: 6,
      padding: 14,
    }) as const,
  girdi: {
    minWidth: 240,
    padding: '7px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.3)',
    color: '#e6e8ea',
    fontSize: 13,
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
  secili: { borderColor: 'rgba(125,211,252,0.6)', color: '#cdeaf6' } as const,
  sil: {
    padding: '5px 10px',
    borderRadius: 4,
    border: '1px solid rgba(160,90,90,0.4)',
    background: 'transparent',
    color: '#d09a9a',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
  } as const,
  rozet: (renk: string) =>
    ({
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: renk,
      border: `1px solid ${renk}66`,
      borderRadius: 3,
      padding: '2px 6px',
    }) as const,
  kucuk: { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' } as const,
  td: { padding: '3px 12px 3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } as const,
  dim: { color: '#6a7075', fontSize: 12.5 } as const,
  hata: { color: '#d09a9a', fontSize: 12.5 } as const,
}
