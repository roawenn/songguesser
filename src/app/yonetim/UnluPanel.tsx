'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TIERS, UNLU_CATEGORY_IDS, UNLU_CATEGORY_LABELS,
  type Difficulty, type UnluCategoryId,
} from '@/data/categories'
import { storagePublicUrlIstemci } from '@/lib/storageIstemci'
import { cleanKey } from '@/text/keys'
import type { UnluRow } from '@/app/api/yonetim/unlu/route'
import { govdeOku } from './govde'
import { UnluKirpici } from './UnluKirpici'

/**
 * Ünlü havuzu paneli.
 *
 * `Messages.tsx`'in sözleşmesini izler: kendi verisini kendi çeker, hata ve
 * başarı mesajlarını ebeveyne bildirir. `AdminPanel`'in `rows`/`cat`/`patch`
 * altyapısı şarkı biçimine göre kurulmuş; ünlüyü oradan geçirmek 897 satırlık
 * dosyayı 1400'e çıkarırdı.
 */

interface Props {
  onAdded: (mesaj: string) => void
  onError: (mesaj: string) => void
}

type Yol = 'dosya' | 'url'

export function UnluPanel({ onAdded, onError }: Props) {
  const [rows, setRows] = useState<UnluRow[] | null>(null)
  const [cat, setCat] = useState<UnluCategoryId>('sarkici')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<Set<string>>(new Set())

  // --- ekleme durumu ---
  const [gorsel, setGorsel] = useState<HTMLImageElement | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [onizleme, setOnizleme] = useState<string | null>(null)
  const [ad, setAd] = useState('')
  const [takmalar, setTakmalar] = useState('')
  const [kademe, setKademe] = useState<Difficulty>(1)
  const [not, setNot] = useState('')
  const [url, setUrl] = useState('')
  const [yol, setYol] = useState<Yol>('dosya')
  const [suruklu, setSuruklu] = useState(false)
  const [kaydediyor, setKaydediyor] = useState(false)
  const dosyaRef = useRef<HTMLInputElement>(null)

  const yukle = useCallback(async () => {
    try {
      const res = await fetch('/api/yonetim/unlu', { cache: 'no-store' })
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Liste alınamadı.')
      setRows((d.rows as UnluRow[]) ?? [])
    } catch (e) {
      onError((e as Error).message)
      setRows([])
    }
  }, [onError])

  useEffect(() => {
    void yukle()
  }, [yukle])

  // --- üç giriş yolu, tek hedef: yüklenmiş bir HTMLImageElement ---

  const gorseliAl = useCallback(
    (kaynak: Blob | string) => {
      const img = new Image()
      img.onload = () => setGorsel(img)
      img.onerror = () => onError('Görsel okunamadı.')
      img.src = typeof kaynak === 'string' ? kaynak : URL.createObjectURL(kaynak)
    },
    [onError],
  )

  const urldenGetir = useCallback(
    async (adres: string) => {
      try {
        const res = await fetch('/api/yonetim/unlu/getir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: adres }),
        })
        const d = await govdeOku(res)
        if (!res.ok) throw new Error(d.error ?? 'Görsel alınamadı.')
        gorseliAl(String(d.veri))
      } catch (e) {
        onError((e as Error).message)
      }
    },
    [gorseliAl, onError],
  )

  /**
   * Pano.
   *
   * ⚠️ "Görsel adresini kopyala" panoya DOSYA değil düz METİN bırakır. O yol
   * ele alınmazsa küratör Ctrl+V yapar, hiçbir şey olmaz ve "çalışmıyor" der.
   */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (items) {
        for (const it of items) {
          if (it.type.startsWith('image/')) {
            const f = it.getAsFile()
            if (f) {
              gorseliAl(f)
              return
            }
          }
        }
      }
      const metin = e.clipboardData?.getData('text/plain')?.trim()
      if (metin && /^https:\/\//i.test(metin)) void urldenGetir(metin)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [gorseliAl, urldenGetir])

  const sifirla = () => {
    setGorsel(null)
    setBlob(null)
    if (onizleme) URL.revokeObjectURL(onizleme)
    setOnizleme(null)
    setAd('')
    setTakmalar('')
    setNot('')
    setUrl('')
    if (dosyaRef.current) dosyaRef.current.value = ''
  }

  const kaydet = async () => {
    if (!blob) return onError('Önce görseli kırp.')
    setKaydediyor(true)
    try {
      const f = new FormData()
      f.set('ad', ad)
      f.set('kategori', cat)
      f.set('kademe', String(kademe))
      f.set('takmalar', takmalar)
      f.set('not', not)
      f.set('gorsel', blob, 'unlu.webp')
      const res = await fetch('/api/yonetim/unlu', { method: 'POST', body: f })
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Kaydedilemedi.')
      onAdded(`${ad} eklendi.`)
      sifirla()
      void yukle()
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setKaydediyor(false)
    }
  }

  /** İyimser güncelleme — yalnızca DOKUNULAN satır geri alınır. */
  const patch = async (id: string, degisiklik: Record<string, unknown>) => {
    setBusy((s) => new Set(s).add(id))
    const onceki = rows?.find((r) => r.id === id)
    setRows((p) => p?.map((r) => (r.id === id ? { ...r, ...cevir(degisiklik) } : r)) ?? p)
    try {
      const res = await fetch('/api/yonetim/unlu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...degisiklik }),
      })
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Kaydedilemedi.')
      const taze = (d.rows as UnluRow[])?.[0]
      if (taze) setRows((p) => p?.map((r) => (r.id === id ? taze : r)) ?? p)
    } catch (e) {
      onError((e as Error).message)
      if (onceki) setRows((p) => p?.map((r) => (r.id === id ? onceki : r)) ?? p)
    } finally {
      setBusy((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    }
  }

  const sil = async (r: UnluRow) => {
    if (!confirm(`"${r.name}" silinsin mi? Görseli de gider.`)) return
    setBusy((s) => new Set(s).add(r.id))
    try {
      const res = await fetch(`/api/yonetim/unlu?id=${encodeURIComponent(r.id)}`, {
        method: 'DELETE',
      })
      const d = await govdeOku(res)
      if (!res.ok) throw new Error(d.error ?? 'Silinemedi.')
      setRows((p) => p?.filter((x) => x.id !== r.id) ?? p)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
    }
  }

  // ⚠️ Arama `cleanKey` üzerinden: `toLowerCase()` Türkçe'de "İ"yi bozar ve
  // proje kuralı onu `src/text/` dışında yasaklıyor.
  const aranan = cleanKey(q)
  const liste = (rows ?? [])
    .filter((r) => r.category === cat)
    .filter((r) => !aranan || r.norm_name.includes(aranan))

  const sayim = (k: UnluCategoryId) => (rows ?? []).filter((r) => r.category === k).length

  return (
    <>
      {/* --- Kategori sekmeleri --- */}
      <div style={S.tabs}>
        {UNLU_CATEGORY_IDS.map((k) => (
          <button key={k} type="button" onClick={() => setCat(k)} style={S.tab(k === cat)}>
            {UNLU_CATEGORY_LABELS[k]} <span style={S.count}>{sayim(k)}</span>
          </button>
        ))}
      </div>

      {/* --- Ekleme --- */}
      <section style={S.kart}>
        <div style={S.baslik}>{UNLU_CATEGORY_LABELS[cat]} kategorisine ekle</div>

        {!gorsel && !onizleme && (
          <>
            <div style={S.yolSecim}>
              <button type="button" onClick={() => setYol('dosya')} style={S.tab(yol === 'dosya')}>
                Dosya
              </button>
              <button type="button" onClick={() => setYol('url')} style={S.tab(yol === 'url')}>
                Adres
              </button>
              <span style={S.ipucu}>…ya da herhangi bir yerde Ctrl+V</span>
            </div>

            {yol === 'dosya' ? (
              <div
                onDragOver={(e) => {
                  // ⚠️ `preventDefault` şart: yoksa tarayıcı dosyayı sekmede
                  // açar ve küratör panelden çıkar.
                  e.preventDefault()
                  setSuruklu(true)
                }}
                onDragLeave={() => setSuruklu(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setSuruklu(false)
                  const f = e.dataTransfer.files[0]
                  if (f) gorseliAl(f)
                }}
                onClick={() => dosyaRef.current?.click()}
                style={{
                  ...S.birakma,
                  borderColor: suruklu ? '#7dd3fc' : 'rgba(255,255,255,0.14)',
                  background: suruklu ? 'rgba(125,211,252,0.06)' : 'transparent',
                }}
              >
                Görseli buraya sürükle ya da tıkla, seç
                <input
                  ref={dosyaRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) gorseliAl(f)
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  style={S.input}
                />
                <button type="button" onClick={() => void urldenGetir(url)} style={S.ghost}>
                  Getir
                </button>
              </div>
            )}
          </>
        )}

        {gorsel && !onizleme && (
          <UnluKirpici
            gorsel={gorsel}
            onHazir={(b, u) => {
              setBlob(b)
              setOnizleme(u)
            }}
            onIptal={sifirla}
          />
        )}

        {onizleme && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={onizleme} alt="" width={120} height={200} style={S.onizleme} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 260px' }}>
              <input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="Ünlünün adı"
                style={S.input}
                autoFocus
              />
              <input
                value={takmalar}
                onChange={(e) => setTakmalar(e.target.value)}
                placeholder="Takma adlar (virgülle) — örn. Megastar"
                style={S.input}
              />
              <input
                value={not}
                onChange={(e) => setNot(e.target.value)}
                placeholder="Küratör notu (oyunda görünmez)"
                style={S.input}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={S.ipucu}>Zorluk</span>
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setKademe(t.id)}
                    style={S.tier(t.id === kademe, t.hue)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={kaydet} disabled={kaydediyor} style={S.primary}>
                  {kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBlob(null)
                    if (onizleme) URL.revokeObjectURL(onizleme)
                    setOnizleme(null)
                  }}
                  style={S.ghost}
                >
                  Yeniden kırp
                </button>
                <button type="button" onClick={sifirla} style={S.ghost}>
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Liste --- */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '18px 0 10px' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara…"
          style={{ ...S.input, maxWidth: 260 }}
        />
        <span style={S.ipucu}>{liste.length} kayıt</span>
      </div>

      {rows === null ? (
        <div style={S.ipucu}>Yükleniyor…</div>
      ) : liste.length === 0 ? (
        <div style={S.ipucu}>Bu kategoride henüz kimse yok.</div>
      ) : (
        <div style={S.grid}>
          {liste.map((r) => (
            <div key={r.id} style={{ ...S.satir, opacity: busy.has(r.id) ? 0.5 : 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storagePublicUrlIstemci(`${r.id.slice(5)}.webp?v=${r.image_ver}`)}
                alt=""
                width={44}
                height={73}
                style={S.kucuk}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={S.ad}>{r.name}</div>
                <div style={S.ipucu}>
                  {r.aliases.length > 0 ? r.aliases.join(', ') : '—'}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {TIERS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void patch(r.id, { kademe: t.id })}
                      style={S.tier(t.id === r.tier, t.hue)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => void patch(r.id, { acik: !r.enabled })}
                  style={S.ghost}
                  title={r.enabled ? 'Oyunda görünüyor' : 'Kapalı'}
                >
                  {r.enabled ? 'Açık' : 'Kapalı'}
                </button>
                <button type="button" onClick={() => void sil(r)} style={S.del}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** PATCH gövdesindeki Türkçe alan adlarını satır biçimine çevirir. */
function cevir(d: Record<string, unknown>): Partial<UnluRow> {
  const out: Partial<UnluRow> = {}
  if ('kademe' in d) out.tier = d.kademe as Difficulty
  if ('acik' in d) out.enabled = d.acik as boolean
  if ('kategori' in d) out.category = d.kategori as UnluCategoryId
  if ('ad' in d) out.name = d.ad as string
  return out
}

const S = {
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 },
  tab: (on: boolean) => ({
    padding: '7px 12px',
    borderRadius: 6,
    border: `1px solid ${on ? '#7dd3fc' : 'rgba(255,255,255,0.1)'}`,
    background: on ? 'rgba(125,211,252,0.1)' : 'transparent',
    color: on ? '#7dd3fc' : '#8c9297',
    fontSize: 12.5,
    cursor: 'pointer',
  }),
  count: { color: '#5c6267', fontFamily: 'var(--font-mono)', fontSize: 10.5 },
  kart: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 18,
    background: 'rgba(255,255,255,0.015)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  baslik: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    letterSpacing: '.2em',
    textTransform: 'uppercase' as const,
    color: '#6a7075',
  },
  yolSecim: { display: 'flex', gap: 6, alignItems: 'center' },
  ipucu: { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#6a7075' },
  birakma: {
    padding: '34px 20px',
    border: '1px dashed rgba(255,255,255,0.14)',
    borderRadius: 8,
    textAlign: 'center' as const,
    color: '#8c9297',
    fontSize: 13,
    cursor: 'pointer',
  },
  input: {
    flex: 1,
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#111417',
    color: '#e6e8ea',
    fontSize: 13,
  },
  primary: {
    padding: '9px 16px',
    borderRadius: 6,
    border: '1px solid #7dd3fc',
    background: 'rgba(125,211,252,0.12)',
    color: '#7dd3fc',
    fontSize: 12.5,
    cursor: 'pointer',
  },
  ghost: {
    padding: '7px 12px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: '#a9aeb3',
    fontSize: 11.5,
    cursor: 'pointer',
  },
  del: {
    padding: '7px 12px',
    borderRadius: 6,
    border: '1px solid rgba(160,90,90,0.4)',
    background: 'transparent',
    color: '#d09a9a',
    fontSize: 11.5,
    cursor: 'pointer',
  },
  tier: (on: boolean, hue: number) => ({
    padding: '3px 8px',
    borderRadius: 4,
    border: `1px solid ${on ? `oklch(0.75 0.13 ${hue})` : 'rgba(255,255,255,0.08)'}`,
    background: on ? `oklch(0.75 0.13 ${hue} / 0.14)` : 'transparent',
    color: on ? `oklch(0.85 0.1 ${hue})` : '#5c6267',
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    cursor: 'pointer',
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 10,
    maxHeight: 520,
    overflowY: 'auto' as const,
  },
  satir: {
    display: 'flex',
    gap: 12,
    padding: 10,
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.015)',
  },
  kucuk: { borderRadius: 4, objectFit: 'cover' as const, flex: 'none' as const, background: '#111' },
  ad: { fontSize: 13.5, color: '#e6e8ea' },
  onizleme: {
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    objectFit: 'cover' as const,
  },
} as const
