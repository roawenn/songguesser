'use client'

import { useEffect, useRef, useState } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { tr } from '@/game/ladder'

interface Props {
  /** Kaç kez sonuna kadar dinlendi. Etiketteki sayı budur. */
  listens: number
  clipLength: number
  playing: boolean
  disabled: boolean
  arming: boolean
  stalled: boolean
  onPlay: () => void
}

/**
 * Çal düğmesi + mono saat + deneme etiketi.
 *
 * ⚠️ Saat rAF ile doğrudan DOM'a yazılır; saniyede 60 kez setState çağırmak
 * çalma sırasında tüm ağacı yeniden render ederdi.
 */
export function Transport({
  listens,
  clipLength,
  playing,
  disabled,
  arming,
  stalled,
  onPlay,
}: Props) {
  const clockRef = useRef<HTMLDivElement>(null)

  /**
   * Fırıldak GECİKMELİ gösterilir.
   *
   * ⚠️ Sıradaki şarkının hem alanları hem sesi önceki tur sırasında
   * önyükleniyor, yani `arming` genelde birkaç milisaniye sürüyor. Buna rağmen
   * her tur geçişinde üçgen bir an fırıldağa dönüp geri dönüyordu: düğme
   * "yenileniyormuş" gibi görünen, tamamen gereksiz bir titreme. Yükleme
   * gerçekten uzarsa fırıldak yine çıkar — bilgi kaybı yok, yalnızca yanıp
   * sönme yok.
   */
  const [mesgul, setMesgul] = useState(false)
  useEffect(() => {
    if (!arming) {
      setMesgul(false)
      return
    }
    const t = setTimeout(() => setMesgul(true), 280)
    return () => clearTimeout(t)
  }, [arming])

  /*
   * Bekleme penceresinde düğme SOLMAZ da: sönükleşip geri parlamak da aynı
   * titremenin bir parçasıydı. Tıklama yine işlemez (`disabled` duruyor), ama
   * bu en fazla 280 ms sürüyor.
   */
  const soluk = arming && !mesgul ? false : disabled

  useEffect(() => {
    const el = clockRef.current
    if (!el) return

    if (!playing) {
      el.textContent = `${tr(clipLength.toFixed(1))}s`
      return
    }

    // Sesin gerçekten duyulmaya başladığı anı bekle. Tıklama anında
    // başlatılsaydı sayaç sesten önde giderdi ve klibin başı sessizmiş gibi
    // hissedilirdi.
    el.textContent = `${tr((0).toFixed(1))}s`
    const total = clipLength * 1000
    let raf = 0
    const tick = () => {
      const start = clipPlayer.plateauStart
      if (start != null) {
        const e = Math.max(0, Math.min(total, performance.now() - start))
        el.textContent = `${tr((e / 1000).toFixed(1))}s`
        if (e >= total) return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, clipLength])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <button
        type="button"
        onClick={onPlay}
        disabled={disabled}
        aria-label={playing ? 'Çalıyor' : `${tr(clipLength)} saniye dinle`}
        className="nk-play"
        style={{
          position: 'relative',
          width: 78,
          height: 78,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.14)',
          background:
            'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 60%), #15181c',
          boxShadow: '0 0 0 8px rgba(255,255,255,0.015), 0 18px 40px -22px var(--acc)',
          opacity: soluk ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color .18s ease, opacity .18s ease',
        }}
      >
        {mesgul ? (
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 18,
              height: 18,
              margin: '0 auto',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              borderTopColor: 'var(--acc)',
              animation: 'nk-spin .8s linear infinite',
            }}
          />
        ) : playing ? (
          <span aria-hidden style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            <span style={{ width: 4, height: 22, borderRadius: 1, background: 'var(--acc)' }} />
            <span style={{ width: 4, height: 22, borderRadius: 1, background: 'var(--acc)' }} />
          </span>
        ) : (
          // CSS üçgeni — tasarımın kendi çözümü.
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 0,
              height: 0,
              margin: '0 auto',
              borderLeft: '17px solid var(--acc)',
              borderTop: '11px solid transparent',
              borderBottom: '11px solid transparent',
              transform: 'translateX(3px)',
            }}
          />
        )}
      </button>

      <div>
        <div
          ref={clockRef}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 26,
            color: 'var(--acc)',
            letterSpacing: '.02em',
          }}
        >
          {tr(clipLength.toFixed(1))}s
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: stalled ? '#c9a25e' : '#6a7075',
            marginTop: 4,
          }}
          role={stalled ? 'status' : undefined}
        >
          {stalled ? 'bağlantı takıldı · hakkın gitmedi' : `${listens + 1}. deneme`}
        </div>
      </div>

      <style>{`.nk-play:hover:not(:disabled) { border-color: var(--acc) !important; }`}</style>
    </div>
  )
}
