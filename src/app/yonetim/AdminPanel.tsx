'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_IDS, CHIPS, TIERS, type CategoryId, type Difficulty } from '@/data/categories'
import { artworkAt } from '@/data/schema'
import { cleanKey } from '@/text/keys'
import type { SongRow } from '@/lib/supabase'
import { AddPanel } from './AddPanel'
import { Messages } from './Messages'

const labelOf = (cat: CategoryId) => CHIPS.find((c) => c.id === cat)?.label ?? cat

const PAGE = 60

type Filter = 'hepsi' | 'kapali' | 'yeni'
/** Panelin üst düzey görünümü. */
type View = 'sarkilar' | 'mesajlar'

export function AdminPanel({ configured }: { configured: boolean }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<SongRow[] | null>(null)
  const [cat, setCat] = useState<CategoryId>('pop')
  const [q, setQ] = useState('')
  const [tierFilter, setTierFilter] = useState<Difficulty | 0>(0)
  const [filter, setFilter] = useState<Filter>('hepsi')
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<View>('sarkilar')
  const [unread, setUnread] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/yonetim')
    if (res.status === 401) {
      setAuthed(false)
      return
    }
    const d = await res.json()
    if (!res.ok) {
      setErr(d.error ?? 'Liste yüklenemedi.')
      return
    }
    setAuthed(true)
    setRows(d.rows as SongRow[])
  }, [])

  useEffect(() => {
    if (configured) void load()
    else setAuthed(false)
  }, [configured, load])

  useEffect(() => () => audioRef.current?.pause(), [])

  // Durum mesajı kalıcı olmasın — bir sonraki işleme kadar ekranda durursa
  // hangi işlemi anlattığı belirsizleşir.
  useEffect(() => {
    if (!status) return
    const id = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(id)
  }, [status])

  // Kategori ya da süzgeç değişince sayfa ve seçim anlamını yitirir.
  useEffect(() => {
    setPage(0)
    setSelected(new Set())
  }, [cat, q, tierFilter, filter])

  const catRows = useMemo(
    () => (rows ?? []).filter((r) => r.category === cat),
    [rows, cat],
  )

  /**
   * ⚠️ Arama Türkçe-normalize edilir.
   *
   * Ham `includes` ile "gulpembe" yazan "Gülpembe"yi bulamıyordu; `toLowerCase`
   * ise "ILGIN"i "ilgin" yapıp yine ıskalıyordu. `cleanKey` oyunun eşleştirme
   * katmanıyla aynı kuralı uygular.
   */
  const filtered = useMemo(() => {
    const needle = cleanKey(q.trim())
    return catRows.filter((r) => {
      if (tierFilter && r.tier !== tierFilter) return false
      if (filter === 'kapali' && r.enabled) return false
      if (!needle) return true
      return (
        cleanKey(r.artist).includes(needle) ||
        cleanKey(r.title).includes(needle) ||
        String(r.year).includes(needle)
      )
    })
  }, [catRows, q, tierFilter, filter])

  const ordered = useMemo(() => {
    if (filter !== 'yeni') return filtered
    return [...filtered].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  }, [filtered, filter])

  const pageRows = useMemo(() => ordered.slice(page * PAGE, page * PAGE + PAGE), [ordered, page])
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE))

  const stats = useMemo(() => {
    const on = catRows.filter((r) => r.enabled)
    return {
      toplam: catRows.length,
      acik: on.length,
      tiers: [1, 2, 3, 4, 5].map((t) => on.filter((r) => r.tier === t).length),
    }
  }, [catRows])

  /** AddPanel'in "zaten havuzda" elemesi için: hem id hem normalize ad. */
  const existing = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows ?? []) {
      s.add(r.id)
      if (r.category === cat) s.add(`${cleanKey(r.artist)}|${cleanKey(r.title)}`)
    }
    return s
  }, [rows, cat])

  function markBusy(ids: string[], on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) if (on) next.add(id)
        else next.delete(id)
      return next
    })
  }

  /** Tek ya da çok satırı günceller — arayüz ağı beklemez. */
  async function patch(ids: string[], change: Partial<SongRow>, label?: string) {
    if (ids.length === 0) return
    markBusy(ids, true)
    setErr(null)
    const touched = new Set(ids)
    const snapshot = rows
    setRows((prev) => prev?.map((r) => (touched.has(r.id) ? { ...r, ...change } : r)) ?? prev)
    try {
      const res = await fetch('/api/yonetim', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids.length === 1 ? { id: ids[0], ...change } : { ids, ...change }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Kaydedilemedi')
      setStatus(label ?? 'Kaydedildi · oyunda anında geçerli')
      // Sunucu dönemi yeniden hesaplamış olabilir; onun satırları geçerli olsun.
      const fresh = (d.rows as SongRow[] | undefined) ?? []
      if (fresh.length > 0) {
        const byId = new Map(fresh.map((r) => [r.id, r]))
        setRows((prev) => prev?.map((r) => byId.get(r.id) ?? r) ?? prev)
      }
    } catch (e) {
      setErr((e as Error).message)
      // İyimser güncelleme tutmadı: sunucunun bildiğine geri dön.
      setRows(snapshot)
    } finally {
      markBusy(ids, false)
    }
  }

  async function remove(ids: string[]) {
    if (ids.length === 0) return
    const first = (rows ?? []).find((r) => r.id === ids[0])
    const what =
      ids.length === 1 && first
        ? `${first.artist} — ${first.title}`
        : `${ids.length} şarkı`
    if (!confirm(`Silinsin mi?\n\n${what}\n\nBu geri alınamaz.`)) return

    markBusy(ids, true)
    try {
      const res = await fetch(`/api/yonetim?ids=${ids.map(encodeURIComponent).join(',')}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Silinemedi')
      }
      const gone = new Set(ids)
      setRows((prev) => prev?.filter((r) => !gone.has(r.id)) ?? prev)
      setSelected(new Set())
      setStatus(`Silindi: ${what}`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      markBusy(ids, false)
    }
  }

  function preview(row: SongRow) {
    if (playingId === row.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const el = new Audio(row.preview)
    el.volume = 0.7
    el.currentTime = 0.3
    void el.play().catch(() => setPlayingId(null))
    el.addEventListener('ended', () => setPlayingId(null))
    audioRef.current = el
    setPlayingId(row.id)
  }

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  const ids = [...selected]

  if (!configured) {
    return (
      <main style={S.page}>
        <h1 style={S.h1}>Panel yapılandırılmamış</h1>
        <p style={S.sub}>
          <code>SUPABASE_SECRET_KEY</code> tanımlı olmalı ve yönetici şifresi
          kurulmalı: <code>npm run admin:parola -- &lt;yeni-parola&gt;</code>
        </p>
      </main>
    )
  }

  if (authed === false) return <Login onDone={() => void load()} />
  if (authed === null || !rows) return <main style={S.page}>Yükleniyor…</main>

  return (
    <main style={S.page}>
      <header style={S.head}>
        <div>
          <h1 style={S.h1}>{view === 'sarkilar' ? 'Şarkı havuzu' : 'Mesajlar'}</h1>
          <p style={S.sub}>
            {view === 'sarkilar' ? (
              <>
                Kaynak: Supabase · Her değişiklik <strong>anında</strong> oyuna yansır.
              </>
            ) : (
              <>Hakkında sayfasındaki formdan gelen mesajlar.</>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button type="button" onClick={() => setView('sarkilar')} style={S.tab(view === 'sarkilar')}>
            Şarkılar
          </button>
          <button type="button" onClick={() => setView('mesajlar')} style={S.tab(view === 'mesajlar')}>
            Mesajlar {unread > 0 && <span style={S.count}>{unread}</span>}
          </button>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch('/api/yonetim/giris', { method: 'DELETE' })
            setAuthed(false)
          }}
          style={S.ghost}
        >
          Çıkış
        </button>
      </header>

      <div style={S.msgs} role="status" aria-live="polite">
        {status && <div style={S.status}>{status}</div>}
        {err && <div style={S.errBox}>{err}</div>}
      </div>

      {view === 'mesajlar' ? (
        <Messages onCount={setUnread} />
      ) : (
      <>
      <div style={S.tabs}>
        {CATEGORY_IDS.map((c) => {
          const n = (rows ?? []).filter((r) => r.category === c && r.enabled).length
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCat(c)
                setQ('')
              }}
              style={S.tab(c === cat)}
            >
              {labelOf(c)} <span style={S.count}>{n}</span>
            </button>
          )
        })}
      </div>

      <AddPanel
        cat={cat}
        existing={existing}
        onAdded={(mesaj) => {
          setStatus(mesaj)
          void load()
        }}
        onError={setErr}
      />

      <div style={S.toolbar}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Listede ara — gulpembe yazsan da bulur…"
          style={S.search}
        />
        <div style={S.filterRow}>
          <button
            type="button"
            onClick={() => setTierFilter(0)}
            style={S.chip(tierFilter === 0)}
          >
            tüm kademeler
          </button>
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierFilter(tierFilter === t.id ? 0 : t.id)}
              style={S.tier(tierFilter === t.id, t.hue)}
            >
              {t.label}
            </button>
          ))}
          <span style={S.sep} />
          {(['hepsi', 'kapali', 'yeni'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={S.chip(filter === f)}
            >
              {f === 'hepsi' ? 'hepsi' : f === 'kapali' ? 'kapalılar' : 'son eklenenler'}
            </button>
          ))}
        </div>
        <div style={S.stats}>
          <span>
            {stats.acik} açık / {stats.toplam}
          </span>
          <span style={S.dim}>kademeler {stats.tiers.join('·')}</span>
        </div>
      </div>

      {selected.size > 0 && (
        <div style={S.bulk}>
          <strong style={{ fontSize: 13 }}>{selected.size} şarkı seçili</strong>
          <span style={S.bulkLabel}>kademe</span>
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => void patch(ids, { tier: t.id }, `${ids.length} şarkı → ${t.label}`)}
              style={S.tier(false, t.hue)}
            >
              {t.label}
            </button>
          ))}
          <span style={S.sep} />
          <button
            type="button"
            onClick={() => void patch(ids, { enabled: true }, `${ids.length} şarkı açıldı`)}
            style={S.bulkBtn}
          >
            aç
          </button>
          <button
            type="button"
            onClick={() => void patch(ids, { enabled: false }, `${ids.length} şarkı kapatıldı`)}
            style={S.bulkBtn}
          >
            kapat
          </button>
          <select
            value=""
            onChange={(e) => {
              const target = e.target.value as CategoryId
              if (!target) return
              void patch(ids, { category: target }, `${ids.length} şarkı → ${labelOf(target)}`)
            }}
            style={S.select}
          >
            <option value="">kategoriye taşı…</option>
            {CATEGORY_IDS.filter((c) => c !== cat).map((c) => (
              <option key={c} value={c}>
                {labelOf(c)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void remove(ids)} style={S.bulkDel}>
            sil
          </button>
          <button type="button" onClick={() => setSelected(new Set())} style={S.bulkBtn}>
            seçimi bırak
          </button>
        </div>
      )}

      <div style={S.scroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th(34)}>
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      for (const r of pageRows) {
                        if (allOnPage) next.delete(r.id)
                        else next.add(r.id)
                      }
                      return next
                    })
                  }
                  aria-label="Sayfadakileri seç"
                />
              </th>
              <th style={S.th(40)}>Açık</th>
              <th style={S.th(44)} />
              <th style={S.th()}>Sanatçı</th>
              <th style={S.th()}>Şarkı</th>
              <th style={S.th(230)}>Zorluk</th>
              <th style={S.th(80)}>Yıl</th>
              <th style={S.th(70)} />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr
                key={r.id}
                style={{
                  opacity: busyIds.has(r.id) ? 0.5 : r.enabled ? 1 : 0.42,
                  background: selected.has(r.id) ? 'rgba(125,211,252,0.07)' : undefined,
                }}
              >
                <td style={S.td}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSel(r.id)}
                    aria-label={`Seç: ${r.artist} — ${r.title}`}
                  />
                </td>
                <td style={S.td}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => void patch([r.id], { enabled: e.target.checked })}
                    aria-label="Havuzda kullan"
                  />
                </td>
                <td style={S.td}>
                  <button type="button" onClick={() => preview(r)} title="Dinle" style={S.art}>
                    <img
                      src={artworkAt(r.artwork, 100)}
                      alt=""
                      width={34}
                      height={34}
                      style={S.img}
                    />
                    <span style={S.playDot}>{playingId === r.id ? '❚❚' : '▶'}</span>
                  </button>
                </td>
                <td style={S.tdText}>{r.artist}</td>
                <td style={S.tdText}>{r.title}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {TIERS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        title={t.hint}
                        onClick={() => void patch([r.id], { tier: t.id })}
                        style={S.tier(r.tier === t.id, t.hue)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </td>
                <td style={S.td}>
                  <YearCell row={r} onSave={(y) => void patch([r.id], { year: y })} />
                </td>
                <td style={S.td}>
                  <button type="button" onClick={() => void remove([r.id])} style={S.del}>
                    sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ordered.length === 0 && <p style={S.dim}>Eşleşen şarkı yok.</p>}

      {pages > 1 && (
        <div style={S.pager}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={S.ghost}
          >
            ← önceki
          </button>
          <span style={S.dim}>
            {page * PAGE + 1}–{Math.min(ordered.length, (page + 1) * PAGE)} / {ordered.length}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            style={S.ghost}
          >
            sonraki →
          </button>
        </div>
      )}

      <p style={{ ...S.dim, marginTop: 28, lineHeight: 1.7 }}>
        Yedek anlık görüntüyü tazelemek için: <code>npm run pool:snapshot</code> —
        Supabase&apos;e ulaşılamazsa oyun o dosyadan devam eder.
      </p>
      </>
      )}
    </main>
  )
}

/**
 * Yıl hücresi.
 *
 * ⚠️ Kontrollü input: önceden `defaultValue` + `onBlur` kullanılıyordu, yani
 * iyimser güncelleme geri alındığında hücre eski (yanlış) değeri göstermeye
 * devam ediyordu. Enter da kaydeder, Escape vazgeçer.
 */
function YearCell({ row, onSave }: { row: SongRow; onSave: (year: number) => void }) {
  const [value, setValue] = useState(String(row.year))
  useEffect(() => setValue(String(row.year)), [row.year])

  function commit() {
    const y = Number(value)
    if (y === row.year) return
    if (y >= 1900 && y <= 2100) onSave(y)
    else setValue(String(row.year))
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setValue(String(row.year))
          e.currentTarget.blur()
        }
      }}
      inputMode="numeric"
      aria-label="Çıkış yılı"
      style={{ ...S.cell, width: 62 }}
    />
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/yonetim/giris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? 'Giriş başarısız')
      }
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ ...S.page, maxWidth: 380, paddingTop: 120 }}>
      <h1 style={S.h1}>Yönetim</h1>
      <p style={S.sub}>Devam etmek için şifreyi gir.</p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Şifre"
          autoFocus
          style={{ ...S.search, flex: 1 }}
        />
        <button type="submit" disabled={busy || !pw} style={S.primary}>
          {busy ? '…' : 'Gir'}
        </button>
      </form>
      {err && <div style={{ ...S.errBox, marginTop: 12 }}>{err}</div>}
    </main>
  )
}

const S = {
  page: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '28px 20px 80px',
    fontFamily: 'var(--font-sans)',
    color: '#e6e8ea',
  } as const,
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 18,
  } as const,
  h1: { margin: 0, fontSize: 22, fontWeight: 600 } as const,
  sub: { margin: '6px 0 0', fontSize: 13, color: '#8c9297' } as const,
  msgs: { minHeight: 0 } as const,
  primary: {
    padding: '10px 22px',
    borderRadius: 6,
    border: '1px solid #7dd3fc',
    background: '#7dd3fc',
    color: '#0a0c0e',
    fontWeight: 600,
  } as const,
  ghost: {
    padding: '9px 16px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent',
    color: '#b6bbbf',
    fontSize: 13,
    whiteSpace: 'nowrap',
  } as const,
  status: {
    margin: '0 0 12px',
    padding: '9px 13px',
    borderRadius: 6,
    border: '1px solid rgba(125,211,252,0.28)',
    background: 'rgba(125,211,252,0.07)',
    fontSize: 12.5,
    fontFamily: 'var(--font-mono)',
  } as const,
  errBox: {
    margin: '0 0 12px',
    padding: '9px 13px',
    borderRadius: 6,
    border: '1px solid rgba(160,90,90,0.4)',
    background: 'rgba(160,90,90,0.08)',
    color: '#d09a9a',
    fontSize: 12.5,
    fontFamily: 'var(--font-mono)',
  } as const,
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 } as const,
  tab: (on: boolean) =>
    ({
      padding: '9px 14px',
      borderRadius: 5,
      border: '1px solid ' + (on ? '#7dd3fc' : 'rgba(255,255,255,0.1)'),
      background: on ? 'rgba(125,211,252,0.1)' : 'transparent',
      color: on ? '#cdeaf6' : '#8c9297',
      fontSize: 13,
    }) as const,
  count: { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' } as const,
  toolbar: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  } as const,
  search: {
    flex: 1,
    minWidth: 200,
    padding: '9px 12px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6e8ea',
    outline: 'none',
  } as const,
  filterRow: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' } as const,
  chip: (on: boolean) =>
    ({
      padding: '6px 10px',
      borderRadius: 4,
      border: '1px solid ' + (on ? 'rgba(125,211,252,0.45)' : 'rgba(255,255,255,0.08)'),
      background: on ? 'rgba(125,211,252,0.1)' : 'transparent',
      color: on ? '#cdeaf6' : '#71777c',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }) as const,
  sep: {
    width: 1,
    alignSelf: 'stretch',
    background: 'rgba(255,255,255,0.1)',
    margin: '0 4px',
  } as const,
  bulk: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    padding: '10px 12px',
    marginBottom: 12,
    borderRadius: 6,
    border: '1px solid rgba(125,211,252,0.3)',
    background: 'rgba(125,211,252,0.07)',
  } as const,
  bulkLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#6a7075',
    marginLeft: 8,
  } as const,
  bulkBtn: {
    padding: '6px 11px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent',
    color: '#b6bbbf',
    fontSize: 12,
  } as const,
  bulkDel: {
    padding: '6px 11px',
    borderRadius: 4,
    border: '1px solid rgba(160,90,90,0.4)',
    background: 'transparent',
    color: '#d09a9a',
    fontSize: 12,
  } as const,
  select: {
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.14)',
    background: '#13161a',
    color: '#b6bbbf',
    fontSize: 12,
  } as const,
  stats: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: 11.5,
    color: '#8c9297',
  } as const,
  // Dar ekranda tablo daralmak yerine yatay kaysın: hücreler okunaklı kalır.
  scroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as const,
  table: { width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 13.5 } as const,
  th: (w?: number) =>
    ({
      textAlign: 'left',
      padding: '8px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: '#6a7075',
      fontWeight: 400,
      width: w,
    }) as const,
  td: {
    padding: '8px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  } as const,
  tdText: {
    padding: '8px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
    color: '#dfe2e4',
  } as const,
  cell: {
    padding: '6px 8px',
    borderRadius: 4,
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6e8ea',
    outline: 'none',
  } as const,
  tier: (on: boolean, hue: number) =>
    ({
      padding: '6px 8px',
      borderRadius: 4,
      border: `1px solid ${on ? `oklch(0.81 0.13 ${hue} / 0.5)` : 'rgba(255,255,255,0.08)'}`,
      background: on ? `oklch(0.81 0.13 ${hue} / 0.16)` : 'transparent',
      color: on ? `oklch(0.81 0.13 ${hue})` : '#71777c',
      fontFamily: 'var(--font-mono)',
      fontSize: 9.5,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }) as const,
  art: {
    position: 'relative',
    width: 34,
    height: 34,
    padding: 0,
    border: 0,
    background: 'transparent',
    borderRadius: 4,
    overflow: 'hidden',
    display: 'block',
  } as const,
  img: { borderRadius: 4, objectFit: 'cover', display: 'block' } as const,
  playDot: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    color: '#fff',
    fontSize: 10,
  } as const,
  del: {
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid rgba(160,90,90,0.3)',
    background: 'transparent',
    color: '#a05a5a',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
  } as const,
  pager: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    justifyContent: 'center',
    marginTop: 16,
  } as const,
  dim: { color: '#6a7075', fontSize: 12.5 } as const,
}
