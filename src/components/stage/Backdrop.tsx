'use client'

import { memo, useEffect, useRef } from 'react'

interface Props {
  /** Açıkken spot fareyi takip etmez, titreşim durur. */
  reduce: boolean
}

/**
 * Sahne katmanları: fare takipli spot ışığı, CRT tarama çizgileri, grain.
 *
 * ⚠️ Spot konumu React state'e ASLA yazılmaz. rAF döngüsü doğrudan CSS
 * değişkenlerine (--mx/--my) yazar; aksi hâlde fare her kıpırdadığında tüm
 * ağaç yeniden render edilirdi.
 */
function BackdropBase({ reduce }: Props) {
  const spotRef = useRef<HTMLDivElement>(null)
  // Hedef ve mevcut konum; aradaki fark her karede yumuşatılır.
  const target = useRef({ x: 50, y: 24 })
  const current = useRef({ x: 50, y: 24 })
  const reduceRef = useRef(reduce)

  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])

  useEffect(() => {
    let raf = 0

    /**
     * ⚠️ Döngü hedefe varınca DURUR ve fare kıpırdayınca yeniden başlar.
     *
     * Önceden kesintisiz dönüyordu: fare hiç hareket etmese bile — dokunmatik
     * bir telefonda, yani hiç fare yokken bile — saniyede 60 kare boşa
     * hesaplanıyor ve pil yakıyordu.
     */
    const follow = () => {
      const el = spotRef.current
      if (!el) {
        raf = 0
        return
      }
      // Azaltılmış animasyonda katsayı 1: yumuşatma yok, anında oturur.
      const k = reduceRef.current ? 1 : 0.09
      const dx = target.current.x - current.current.x
      const dy = target.current.y - current.current.y
      current.current.x += dx * k
      current.current.y += dy * k
      el.style.setProperty('--mx', `${current.current.x.toFixed(2)}%`)
      el.style.setProperty('--my', `${current.current.y.toFixed(2)}%`)

      // Yarım pikselin altındaki fark ekranda görünmez.
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(follow)
    }

    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 100
      target.current.y = (e.clientY / window.innerHeight) * 100
      if (!raf) raf = requestAnimationFrame(follow)
    }

    raf = requestAnimationFrame(follow)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div
        ref={spotRef}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: `
            radial-gradient(26vmax 26vmax at var(--mx, 50%) var(--my, 24%), var(--accSoft) 0%, oklch(0.62 0.13 var(--hue) / 0.05) 36%, rgba(0,0,0,0) 66%),
            radial-gradient(70vmax 40vmax at var(--mx, 50%) -8%, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0) 70%)
          `,
          animation: reduce ? undefined : 'nk-flick 7s ease-in-out infinite',
        }}
      />

      {/* CRT tarama çizgileri */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.5,
          background:
            'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)',
        }}
      />

      {/* Grain */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.045,
          mixBlendMode: 'overlay',
          backgroundSize: '3px 3px, 4px 4px, 7px 7px',
          backgroundImage: `
            repeating-conic-gradient(rgba(255,255,255,0.5) 0% 25%, rgba(0,0,0,0.5) 0% 50%),
            repeating-conic-gradient(rgba(0,0,0,0.45) 0% 25%, rgba(255,255,255,0.45) 0% 50%),
            repeating-linear-gradient(58deg, rgba(255,255,255,0.4) 0 1px, rgba(0,0,0,0) 1px 4px)
          `,
        }}
      />
    </>
  )
}

/** Tek girdisi `reduce`; ses sürüklenirken boşuna render edilmesin. */
export const Backdrop = memo(BackdropBase)
