'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { GORSEL_ORAN, SERIT } from '@/data/unlu'
import { acikKirpma } from '@/app/yonetim/kirpmaMatematigi'

/**
 * Ünlü görseli — beş eşit yatay şerit, yukarıdan aşağı açılır.
 *
 * ⚠️ BEŞ KAPAK KATMANI DEĞİL, TEK `clip-path`.
 *
 * Şeritler her zaman yukarıdan sırayla açıldığı için görünen bölge daima
 * üstten başlayan TEK bir dikdörtgen. Beş ayrı kapak `<div>`'i beş kompozisyon
 * katmanı demekti; tek `<img>` + tek özellik aynı işi görüyor ve `inset()`
 * arası geçişi tarayıcı animasyonluyor.
 *
 * ⚠️ Boya özelliği (`filter`, `box-shadow`) KULLANILMIYOR. Bu projede
 * `nk-glow` ve `nk-artwork` tam da bunları animasyonladığı için FPS
 * düşürüyordu; `clip-path` ve `opacity` compositor'da kalıyor.
 *
 * ⚠️ Kapalı bölge SAYDAM DEĞİL. Arka plan gradyanı görünseydi oyuncu
 * "görsel yüklenmedi mi?" diye düşünürdü; ince tarama deseni "burası henüz
 * kapalı" diyor.
 */

export interface UnluKareHandle {
  /** Yanlış tahminde kısa bir sarsıntı. */
  sars: () => void
}

interface Props {
  url: string
  acilan: number
  /** Tur bittiğinde tamamı açılır ve ayırıcılar kaybolur. */
  bitti: boolean
  reduce: boolean
}

export const UnluKare = forwardRef<UnluKareHandle, Props>(function UnluKare(
  { url, acilan, bitti, reduce },
  ref,
) {
  const kutu = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    sars() {
      const el = kutu.current
      if (!el || reduce) return
      el.classList.remove('nk-sars')
      // Yeniden akış zorla — sınıf hemen geri eklenirse animasyon tekrar başlamaz.
      void el.offsetWidth
      el.classList.add('nk-sars')
    },
  }))

  const gorunur = bitti ? SERIT : acilan

  return (
    <div
      ref={kutu}
      style={{
        position: 'relative',
        width: '100%',
        /*
         * ⚠️ 330 değil 285. 3:5 oranında genişlik yüksekliği 1,67 katıyla
         * çarpıyor: 330 px → 550 px. Ölçüldü, sahne 1366x768'de (maximize,
         * ~700 px kullanılabilir) ölçeğin alt sınırına dayanıp 14 px taşıyordu.
         * 285 px → 475 px ve her yaygın çözünürlükte sığıyor.
         */
        maxWidth: 285,
        // ⚠️ Oran SABİT: görsel inmeden de şerit sınırları tam beşte bir kalsın
        // ve düzen kaymasın.
        aspectRatio: GORSEL_ORAN,
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
          src={url}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            clipPath: acikKirpma(gorunur, SERIT),
            transition: reduce ? 'none' : 'clip-path .55s cubic-bezier(.22,1,.36,1)',
          }}
        />
      )}

      {/* Kapalı bölgeye "?" — boş bir dikdörtgen hata gibi görünüyor. */}
      {!bitti && gorunur < SERIT && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(gorunur * 100) / SERIT}%`,
            bottom: 0,
            display: 'grid',
            placeContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 30,
            color: 'rgba(255,255,255,0.07)',
          }}
        >
          ?
        </div>
      )}

      {/* Şerit ayırıcıları — kaç parçaya bölündüğü görünsün. */}
      {!bitti &&
        Array.from({ length: SERIT - 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${((i + 1) * 100) / SERIT}%`,
              height: 1,
              background:
                i + 1 < gorunur ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
            }}
          />
        ))}
    </div>
  )
})
