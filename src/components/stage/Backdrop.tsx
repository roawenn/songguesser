'use client'

import { useEffect, useRef } from 'react'

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
export function Backdrop({ reduce }: Props) {
  const spotRef = useRef<HTMLDivElement>(null)
  // Hedef ve mevcut konum; aradaki fark her karede yumuşatılır.
  const target = useRef({ x: 50, y: 24 })
  const current = useRef({ x: 50, y: 24 })
  const reduceRef = useRef(reduce)

  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 100
      target.current.y = (e.clientY / window.innerHeight) * 100
    }

    let raf = 0
    const follow = () => {
      const el = spotRef.current
      if (el) {
        // Azaltılmış animasyonda katsayı 1: yumuşatma yok, anında oturur.
        const k = reduceRef.current ? 1 : 0.09
        current.current.x += (target.current.x - current.current.x) * k
        current.current.y += (target.current.y - current.current.y) * k
        el.style.setProperty('--mx', `${current.current.x.toFixed(2)}%`)
        el.style.setProperty('--my', `${current.current.y.toFixed(2)}%`)
      }
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)

    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
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
