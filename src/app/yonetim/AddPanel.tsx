'use client'

import { govdeOku } from './govde'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TIERS, type CategoryId, type Difficulty } from '@/data/categories'
import { seedsFor } from '@/data/seeds'
import { artworkAt } from '@/data/schema'
import { cleanKey } from '@/text/keys'

export interface FoundTrack {
  trackId: number
  title: string
  artist: string
  artwork: string
  preview: string
  storeUrl: string
  year: number
  /** Aracın önerdiği kademe (sanatçı taramasında dolu). */
  onerilenKademe?: Difficulty
  /** Yıl daha erken bir basımdan düzeltildi mi? */
  yilDuzeltildi?: boolean
}

interface Props {
  cat: CategoryId
  /** Havuzda olanlar: `itunes:<id>` ve `normSanatçı|normŞarkı` anahtarları. */
  existing: Set<string>
  onAdded: (mesaj: string) => void
  onError: (mesaj: string) => void
}

type Mode = 'ara' | 'tara'

/** Sanatçı taraması sırasında iki istek arası bekleme. */
const SCAN_GAP_MS = 2600

const uid = (t: FoundTrack) => `itunes:${t.trackId}`

/**
 * Havuza şarkı ekleme.
 *
 * İki yol var ve ikisi de aynı seçim/ekleme mantığını paylaşır:
 *
 * - **Şarkı ara** — adını bildiğin tek parça için.
 * - **Sanatçı tara** — bir sanatçının Apple TR'deki kataloğunu döker; küratör
 *   hafızadan şarkı adı yazmaya çalışmaz, mevcut olanlar arasından tik atar.
 *
 * ⚠️ iTunes dakikada ~20 istek kabul ediyor ve aşılınca 429 değil **403**
 * dönüyor. Bu yüzden tarama sanatçıları paralel değil KUYRUKTA, aralarında
 * {@link SCAN_GAP_MS} bekleyerek çeker.
 */
export function AddPanel({ cat, existing, onAdded, onError }: Props) {
  const [mode, setMode] = useState<Mode>('ara')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundTrack[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  /** Toplu uygulama için seçilen kademe. */
  const [tier, setTier] = useState<Difficulty>(3)
  /**
   * Satır bazlı kademe geçersiz kılmaları.
   *
   * ⚠️ Varsayılan burada TUTULMAZ; `kademeFor` her satır için önce bu haritaya,
   * sonra aracın önerisine, en son sabit 3'e bakar. Böylece "hepsine uygula"
   * düğmesine basılmadıkça öneri korunur.
   */
  const [kademeler, setKademeler] = useState<Record<string, Difficulty>>({})
  const [playing, setPlaying] = useState<number | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  // Tarama kuyruğu.
  const [queue, setQueue] = useState<string[]>([])
  const [scanning, setScanning] = useState<string | null>(null)
  const cancelScan = useRef(false)
  /** Kuyruktaki bir sonraki sanatçıya geçiş zamanlayıcısı. */
  const taramaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const seeds = useMemo(() => seedsFor(cat), [cat])

  useEffect(() => () => audio.current?.pause(), [])

  // Kategori değişince biriken her şey anlamını yitirir.
  useEffect(() => {
    setResults([])
    setPicked(new Set())
    setQueue([])
    setNote(null)
    cancelScan.current = true
  }, [cat])

  /** Zaten havuzda olanı önermenin anlamı yok; hem id hem normalize ad ile ele. */
  const isKnown = useCallback(
    (t: FoundTrack) =>
      existing.has(uid(t)) || existing.has(`${cleanKey(t.artist)}|${cleanKey(t.title)}`),
    [existing],
  )

  const fresh = useMemo(() => results.filter((t) => !isKnown(t)), [results, isKnown])

  // --- şarkı arama ---
  useEffect(() => {
    if (mode !== 'ara') return
    const needle = q.trim()
    if (needle.length < 2) {
      setResults([])
      return
    }
    // iTunes'un ~20 istek/dk sınırı var; her tuşta sorgu atma.
    const id = setTimeout(() => {
      setBusy(true)
      fetch(`/api/yonetim/ara?q=${encodeURIComponent(needle)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) onError(d.error)
          else setResults((d.results ?? []) as FoundTrack[])
        })
        .catch(() => onError('Arama başarısız.'))
        .finally(() => setBusy(false))
    }, 550)
    return () => clearTimeout(id)
  }, [q, mode, onError])

  // --- sanatçı taraması: kuyruğu sırayla akıt ---
  useEffect(() => {
    if (mode !== 'tara' || queue.length === 0 || scanning) return
    cancelScan.current = false
    const artist = queue[0]!
    setScanning(artist)

    /**
     * ⚠️ Zamanlayıcı REF'te tutulur, yerel değişkende değil.
     *
     * `timer` aşağıdaki `finally` içinde atanıyordu ama temizleme işlevi aynı
     * yerel değişkeni yakalıyor ve istek HAVADAYKEN çalışıyordu — yani atama
     * temizlemeden SONRA oluyor ve zamanlayıcı iptalden sağ çıkıyordu.
     * Sonuç: "Durdur"a basıp yeni bir sanatçı kuyruğa alındığında, iptal
     * edilmiş taramanın öksüz zamanlayıcısı ~2,6 sn sonra `setScanning(null)`
     * yapıyor, efekt yeniden çalışıyor ve YENİ sanatçı İKİNCİ kez isteniyordu.
     * iTunes buna 403 ile cevap veriyor ve kalan kuyruk siliniyordu.
     */
    void (async () => {
      try {
        const res = await fetch(`/api/yonetim/oner?sanatci=${encodeURIComponent(artist)}`)
        const d = (await govdeOku(res)) as { results?: FoundTrack[]; error?: string }
        if (cancelScan.current) return
        if (!res.ok) {
          onError(d.error ?? 'Tarama başarısız.')
          setQueue([])
        } else {
          const found = (d.results ?? []) as FoundTrack[]
          setResults((prev) => {
            const seen = new Set(prev.map(uid))
            return [...prev, ...found.filter((t) => !seen.has(uid(t)))]
          })
          setNote(`${artist}: ${found.length} parça`)
          setQueue((prev) => prev.slice(1))
        }
      } catch {
        if (!cancelScan.current) {
          onError('Tarama başarısız.')
          setQueue([])
        }
      } finally {
        // Sınıra takılmamak için sonraki sanatçıyı hemen çekme.
        if (!cancelScan.current) {
          taramaTimer.current = setTimeout(() => {
            taramaTimer.current = null
            setScanning(null)
          }, SCAN_GAP_MS)
        }
      }
    })()

    return () => {
      if (taramaTimer.current) {
        clearTimeout(taramaTimer.current)
        taramaTimer.current = null
      }
    }
  }, [queue, scanning, mode, onError])

  function enqueue(artists: string[]) {
    setQueue((prev) => [...prev, ...artists.filter((a) => !prev.includes(a))])
  }

  function stopScan() {
    cancelScan.current = true
    // Havadaki geçiş zamanlayıcısı da iptal edilmeli; yoksa durdurulan tarama
    // saniyeler sonra kuyruğu yeniden uyandırıyor.
    if (taramaTimer.current) {
      clearTimeout(taramaTimer.current)
      taramaTimer.current = null
    }
    setQueue([])
    setScanning(null)
  }

  function preview(t: FoundTrack) {
    if (playing === t.trackId) {
      audio.current?.pause()
      setPlaying(null)
      return
    }
    audio.current?.pause()
    const el = new Audio(t.preview)
    el.volume = 0.7
    el.currentTime = 0.3
    void el.play().catch(() => setPlaying(null))
    el.addEventListener('ended', () => setPlaying(null))
    audio.current = el
    setPlaying(t.trackId)
  }

  function toggle(t: FoundTrack) {
    setPicked((prev) => {
      const next = new Set(prev)
      const k = uid(t)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const kademeFor = (t: FoundTrack): Difficulty =>
    kademeler[uid(t)] ?? t.onerilenKademe ?? 3

  const allPicked = fresh.length > 0 && fresh.every((t) => picked.has(uid(t)))

  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(fresh.map(uid)))
  }

  /** Seçili parçaların tamamı TEK istekte gider. */
  async function addPicked() {
    const chosen = fresh.filter((t) => picked.has(uid(t)))
    if (chosen.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/yonetim/ara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cat,
          tracks: chosen.map((t) => ({ track: t, tier: kademeFor(t), year: t.year })),
        }),
      })
      const d = (await res.json()) as {
        error?: string
        eklenen?: number
        guncellenen?: number
        atlanan?: string[]
        zatenVar?: string[]
        basarisiz?: string[]
      }
      if (!res.ok) throw new Error(d.error ?? 'Eklenemedi')

      const parts = [`${d.eklenen ?? 0} şarkı eklendi`]
      if (d.zatenVar?.length) parts.push(`${d.zatenVar.length} zaten havuzda`)
      if (d.atlanan?.length) parts.push(`${d.atlanan.length} kopya atlandı`)
      // Bir parça yazılamadıysa sessiz kalma: küratör hangisini kaybettiğini bilmeli.
      if (d.basarisiz?.length) parts.push(`${d.basarisiz.length} şarkı YAZILAMADI`)
      onAdded(`${parts.join(' · ')} · oyunda anında geçerli`)

      const added = new Set(chosen.map(uid))
      setResults((prev) => prev.filter((t) => !added.has(uid(t))))
      setPicked(new Set())
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const hidden = results.length - fresh.length

  return (
    <div style={S.wrap}>
      <div style={S.modes}>
        <button type="button" onClick={() => setMode('ara')} style={S.mode(mode === 'ara')}>
          Şarkı ara
        </button>
        <button type="button" onClick={() => setMode('tara')} style={S.mode(mode === 'tara')}>
          Sanatçı tara
        </button>
        <div style={S.tiers}>
          <span style={S.tierLabel}>hepsine uygula</span>
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => {
                setTier(t.id)
                // Görünen her satırı bu kademeye çek — öneriyi bilinçli olarak ezer.
                setKademeler((p) => {
                  const next = { ...p }
                  for (const x of fresh) next[uid(x)] = t.id
                  return next
                })
              }}
              style={S.tier(tier === t.id, t.hue)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'ara' ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="iTunes'da ara — sanatçı ve şarkı adı yaz…"
          style={S.input}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = q.trim()
              if (name.length >= 2) {
                enqueue([name])
                setQ('')
              }
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sanatçı adı yaz ve Enter'a bas…"
              style={S.input}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit" style={S.secondary} disabled={q.trim().length < 2}>
              Sıraya ekle
            </button>
          </form>

          {seeds.length > 0 && (
            <div style={S.seeds}>
              {seeds.map((a) => (
                <button key={a} type="button" onClick={() => enqueue([a])} style={S.seed}>
                  {a}
                </button>
              ))}
              <button type="button" onClick={() => enqueue(seeds)} style={S.seedAll}>
                hepsini tara ({seeds.length})
              </button>
            </div>
          )}

          {(scanning || queue.length > 0) && (
            <div style={S.queue}>
              <span>
                {scanning ? `taranıyor: ${scanning}` : 'sırada'} · kuyrukta {queue.length}
              </span>
              <button type="button" onClick={stopScan} style={S.stop}>
                durdur
              </button>
            </div>
          )}
        </div>
      )}

      {busy && <div style={S.dim}>aranıyor…</div>}
      {note && mode === 'tara' && <div style={S.dim}>{note}</div>}

      {fresh.length > 0 && (
        <>
          <div style={S.bar}>
            <label style={S.checkLabel}>
              <input type="checkbox" checked={allPicked} onChange={toggleAll} />
              {allPicked ? 'seçimi kaldır' : `tümünü seç (${fresh.length})`}
            </label>
            {hidden > 0 && <span style={S.dim}>{hidden} tanesi zaten havuzda</span>}
            <button
              type="button"
              onClick={() => void addPicked()}
              disabled={saving || picked.size === 0}
              style={S.add(picked.size > 0 && !saving)}
            >
              {saving ? 'ekleniyor…' : `Seçilenleri ekle (${picked.size})`}
            </button>
          </div>

          <div style={S.grid}>
            {fresh.map((t) => {
              const on = picked.has(uid(t))
              return (
                <label key={t.trackId} style={S.card(on)}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(t)}
                    style={{ flex: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      preview(t)
                    }}
                    title="Önizlemeyi dinle"
                    style={S.art}
                  >
                    <img
                      src={artworkAt(t.artwork, 100)}
                      alt=""
                      width={40}
                      height={40}
                      style={S.img}
                    />
                    <span style={S.play}>{playing === t.trackId ? '❚❚' : '▶'}</span>
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={S.title}>{t.title}</div>
                    <div style={S.meta}>
                      {t.artist} {t.year ? `· ${t.year}` : ''}
                      {t.yilDuzeltildi && (
                        <span title="Yıl, aynı şarkının daha erken bir basımından düzeltildi">
                          {' '}↩
                        </span>
                      )}
                    </div>
                    <div
                      style={{ display: 'flex', gap: 2, marginTop: 5 }}
                      onClick={(e) => e.preventDefault()}
                    >
                      {TIERS.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          title={k.hint}
                          onClick={() =>
                            setKademeler((p) => ({ ...p, [uid(t)]: k.id }))
                          }
                          style={S.nokta(kademeFor(t) === k.id, k.hue)}
                        >
                          {k.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </>
      )}

      {mode === 'ara' && q.trim().length >= 2 && !busy && fresh.length === 0 && (
        <div style={S.dim}>
          {hidden > 0 ? 'Bulunanların hepsi zaten havuzda.' : 'Sonuç yok. Sanatçı adıyla dene.'}
        </div>
      )}
    </div>
  )
}

const S = {
  wrap: {
    border: '1px solid rgba(125,211,252,0.2)',
    background: 'rgba(125,211,252,0.04)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  } as const,
  modes: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } as const,
  mode: (on: boolean) =>
    ({
      padding: '7px 14px',
      borderRadius: 5,
      border: '1px solid ' + (on ? '#7dd3fc' : 'rgba(255,255,255,0.1)'),
      background: on ? 'rgba(125,211,252,0.12)' : 'transparent',
      color: on ? '#cdeaf6' : '#8c9297',
      fontSize: 13,
    }) as const,
  tiers: { display: 'flex', gap: 3, alignItems: 'center', marginLeft: 'auto' } as const,
  tierLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9.5,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#6a7075',
    marginRight: 4,
  } as const,
  tier: (on: boolean, hue: number) =>
    ({
      padding: '6px 9px',
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
  input: {
    flex: 1,
    minWidth: 180,
    padding: '9px 12px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e6e8ea',
    outline: 'none',
  } as const,
  secondary: {
    flex: 'none',
    padding: '9px 14px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent',
    color: '#b6bbbf',
    fontSize: 13,
    whiteSpace: 'nowrap',
  } as const,
  seeds: { display: 'flex', flexWrap: 'wrap', gap: 4 } as const,
  seed: {
    padding: '4px 9px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'transparent',
    color: '#8c9297',
    fontSize: 11.5,
  } as const,
  seedAll: {
    padding: '4px 9px',
    borderRadius: 4,
    border: '1px solid rgba(125,211,252,0.3)',
    background: 'rgba(125,211,252,0.08)',
    color: '#cdeaf6',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
  } as const,
  queue: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-mono)',
    fontSize: 11.5,
    color: '#c9a25e',
  } as const,
  stop: {
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid rgba(201,162,94,0.35)',
    background: 'transparent',
    color: '#c9a25e',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
  } as const,
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    paddingTop: 4,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  } as const,
  checkLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 12.5,
    color: '#b6bbbf',
    cursor: 'pointer',
  } as const,
  add: (on: boolean) =>
    ({
      marginLeft: 'auto',
      padding: '9px 16px',
      borderRadius: 5,
      border: '1px solid ' + (on ? '#7dd3fc' : 'rgba(255,255,255,0.1)'),
      background: on ? '#7dd3fc' : 'transparent',
      color: on ? '#0a0c0e' : '#5c6266',
      fontWeight: 600,
      fontSize: 13,
      cursor: on ? 'pointer' : 'not-allowed',
    }) as const,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 6,
    maxHeight: 420,
    overflowY: 'auto',
  } as const,
  card: (on: boolean) =>
    ({
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: 7,
      borderRadius: 5,
      border: '1px solid ' + (on ? 'rgba(125,211,252,0.4)' : 'rgba(255,255,255,0.08)'),
      background: on ? 'rgba(125,211,252,0.08)' : 'rgba(255,255,255,0.02)',
      cursor: 'pointer',
    }) as const,
  art: {
    position: 'relative',
    width: 40,
    height: 40,
    flex: 'none',
    padding: 0,
    border: 0,
    background: 'transparent',
    borderRadius: 4,
    overflow: 'hidden',
  } as const,
  img: { borderRadius: 4, objectFit: 'cover', display: 'block' } as const,
  play: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    color: '#fff',
    fontSize: 10,
  } as const,
  title: {
    fontSize: 13,
    color: '#e6e8ea',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const,
  meta: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    color: '#757b80',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const,
  /** Satır içi kademe rozeti — kartlar dar, tam etiketler sığmaz. */
  nokta: (on: boolean, hue: number) =>
    ({
      width: 18,
      height: 18,
      borderRadius: 3,
      border: `1px solid ${on ? `oklch(0.81 0.13 ${hue} / 0.6)` : 'rgba(255,255,255,0.08)'}`,
      background: on ? `oklch(0.81 0.13 ${hue} / 0.2)` : 'transparent',
      color: on ? `oklch(0.81 0.13 ${hue})` : '#5c6266',
      fontFamily: 'var(--font-mono)',
      fontSize: 9.5,
      lineHeight: 1,
      padding: 0,
    }) as const,
  dim: { color: '#6a7075', fontSize: 12.5, fontFamily: 'var(--font-mono)' } as const,
}
