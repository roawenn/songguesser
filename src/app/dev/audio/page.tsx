'use client'

/**
 * Ses motoru izole doğrulama sayfası.
 *
 * Arayüzün tek satırı yazılmadan önce burada doğrulanması gerekenler:
 *   1. 0,1 sn klip TIK SESİ OLMADAN çalıyor mu?
 *   2. Ölçülen süre hedeften ±10 ms'den fazla sapıyor mu?
 *   3. Gerçek bir iPhone'da AudioContext kilidi açılıyor mu?
 *
 * Zarf yanlışsa geri kalan hiçbir şeyin önemi yok.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { clipPlayer, type ArmTrack } from '@/audio/ClipPlayer'
import { installResumeHandlers } from '@/audio/context'
import { FADE_OUT, TAIL } from '@/audio/envelope'
import type { Pool, Song } from '@/data/schema'

const LADDER = [0.1, 0.2, 0.5, 1, 2, 5, 15]

export default function AudioDevPage() {
  const [pool, setPool] = useState<Song[]>([])
  const [index, setIndex] = useState(0)
  const [armState, setArmState] = useState<string>('—')
  const [log, setLog] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const snap = useSyncExternalStore(
    clipPlayer.subscribe,
    clipPlayer.getSnapshot,
    clipPlayer.getSnapshot,
  )

  useEffect(() => installResumeHandlers(), [])

  useEffect(() => {
    fetch('/data/pool/rap.json')
      .then((r) => r.json())
      .then((p: Pool) => setPool(p.songs))
      .catch(() => setLog((l) => ['havuz yüklenemedi', ...l]))
  }, [])

  const song = pool[index]

  // Dalga formu: tek rAF döngüsü, React state'e ASLA dokunmaz.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    let raf = 0
    let data: Uint8Array | null = null

    const draw = () => {
      const analyser = clipPlayer.analyser
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx2d.clearRect(0, 0, w, h)

      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>)
        const bars = 64
        const step = Math.floor(data.length / bars)
        ctx2d.fillStyle = '#f97316'
        for (let i = 0; i < bars; i++) {
          const v = data[i * step]! / 255
          const bh = Math.max(2, v * h)
          ctx2d.fillRect((i / bars) * w, h - bh, w / bars - 2, bh)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  async function arm(next = index) {
    const s = pool[next]
    if (!s?.p) return
    setArmState('hazırlanıyor…')
    const track: ArmTrack = { id: s.id, url: s.p, clipStart: s.cs, duration: s.du }
    const result = await clipPlayer.arm(track)
    setArmState(result)
  }

  async function play(len: number) {
    // Gesture içinden, senkron: iOS kilidi burada açılır.
    clipPlayer.unlockFromGesture()
    const result = await clipPlayer.play(len)
    const t = clipPlayer.lastTiming
    if (t) {
      const expected = t.requested + FADE_OUT + TAIL
      const driftMs = t.drift * 1000
      const ok = Math.abs(driftMs) <= 10
      setLog((l) =>
        [
          `${ok ? 'TAMAM' : 'SAPMA'} · istenen ${t.requested}s · ölçülen ${t.measured.toFixed(4)}s ` +
            `· beklenen ${expected.toFixed(4)}s · sapma ${driftMs.toFixed(1)}ms`,
          ...l,
        ].slice(0, 12),
      )
    } else {
      setLog((l) => [`sonuç: ${result}`, ...l].slice(0, 12))
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 font-mono text-sm">
      <h1 className="mb-1 text-xl font-bold text-orange-400">Ses motoru doğrulama</h1>
      <p className="mb-6 text-ink-300">
        Kulakla kontrol et: her kademede tık/patlama sesi olmamalı. Sapma ±10 ms içinde kalmalı.
      </p>

      <div className="mb-4 rounded-lg border border-ink-800 bg-ink-900 p-4">
        <div className="mb-2 text-ink-300">
          {pool.length > 0 ? (
            <>
              <span className="text-ink-100">{song?.a}</span> — {song?.t}{' '}
              <span className="text-ink-500">
                ({song?.y}, z{song?.d})
              </span>
            </>
          ) : (
            'havuz yükleniyor…'
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded bg-ink-800 px-3 py-1 hover:bg-ink-700"
            onClick={() => {
              const next = (index + 1) % Math.max(1, pool.length)
              setIndex(next)
              void arm(next)
            }}
          >
            sonraki şarkı
          </button>
          <button
            className="rounded bg-ink-800 px-3 py-1 hover:bg-ink-700"
            onClick={() => void arm()}
          >
            hazırla (arm)
          </button>
          <span className="px-2 py-1 text-ink-500">
            arm: {armState} · durum: {snap.status}
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} className="mb-4 h-24 w-full rounded-lg bg-ink-900" />

      <div className="mb-6 flex flex-wrap gap-2">
        {LADDER.map((len) => (
          <button
            key={len}
            disabled={snap.status !== 'ready' && snap.status !== 'playing'}
            className="rounded bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-30"
            onClick={() => void play(len)}
          >
            {len}s
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
        {log.length === 0 ? (
          <div className="text-ink-500">ölçüm yok</div>
        ) : (
          log.map((line, i) => (
            <div
              key={i}
              className={line.startsWith('TAMAM') ? 'text-emerald-400' : 'text-amber-400'}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </main>
  )
}
