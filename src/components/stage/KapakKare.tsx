'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { artworkAt } from '@/data/schema'
import { KAPAK_ADIM, KAPAK_BOYUTLARI } from '@/data/kapak'
import { sars as sarsit } from './sars'

/**
 * Albüm kapağı — pikselden netleşir.
 *
 * ⚠️ Pikselleştirme TARAYICIDA YAPILMIYOR. Her adımda Apple'dan o boyutta
 * gerçek bir görsel isteniyor (8×8, 16×16…) ve CSS `image-rendering: pixelated`
 * ile büyütülüyor. Tam boyutlu kapağı indirip bulanıklaştırmak, ilk adımda
 * cevabı tarayıcıya teslim etmek olurdu.
 *
 * ⚠️ `<img>`'e `key={boyut}`: adres değişince tarayıcı eski kareyi yeni görsel
 * inene kadar bırakabiliyor; anahtar yeni öğe kurduruyor ve geçiş animasyonu
 * her adımda yeniden oynuyor.
 *
 * ⚠️ Azami genişlik CSS'te (`.nk-kapak-kare`): masaüstü ve telefon farklı.
 */

export interface KapakKareHandle {
  /** Yanlış tahminde kısa bir sarsıntı. */
  sars: () => void
}

interface Props {
  /** Kapak adresi (Apple, herhangi bir boyut) — boyut burada seçilir. */
  ar: string
  adim: number
  /** Tur bittiğinde tam kapak gösterilir. */
  bitti: boolean
  reduce: boolean
}

export const KapakKare = forwardRef<KapakKareHandle, Props>(function KapakKare(
  { ar, adim, bitti, reduce },
  ref,
) {
  const kutu = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({ sars: () => sarsit(kutu.current, reduce) }))

  const gorunur = bitti ? KAPAK_ADIM : Math.max(1, Math.min(adim, KAPAK_ADIM))
  const boyut = KAPAK_BOYUTLARI[gorunur - 1] ?? 600
  const url = artworkAt(ar, boyut)
  const net = boyut === KAPAK_BOYUTLARI[KAPAK_BOYUTLARI.length - 1]

  return (
    <div
      ref={kutu}
      className="nk-kapak-kare"
      style={{
        position: 'relative',
        width: '100%',
        // ⚠️ Oran SABİT: görsel inmeden de kutu yerini koruyor, düzen kaymıyor.
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'repeating-linear-gradient(135deg, #15181c 0 7px, #0f1216 7px 14px)',
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={boyut}
          src={url}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: net ? 'auto' : 'pixelated',
            animation: reduce ? undefined : 'nk-kapak-gelis .35s ease both',
          }}
        />
      )}

      {/* Kaçıncı netlikte olunduğu — "8×8" oyunun ne istediğini söylüyor. */}
      {!bitti && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            padding: '3px 7px',
            borderRadius: 4,
            background: 'rgba(10,11,13,0.72)',
            color: '#b6bbbf',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.08em',
          }}
        >
          {net ? 'net' : `${boyut}×${boyut}`}
        </span>
      )}
    </div>
  )
})
