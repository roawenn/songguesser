'use client'

import { useEffect, useRef } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import type { Step } from '@/game/machine'

interface Props {
  attempt: number
  steps: Step[]
  playing: boolean
  /** Çalan klibin uzunluğu (sn). */
  clipLength: number
  /** Gerçekten duyulan en yüksek kademe; -1 = hiç dinlenmedi. */
  heardIndex: number
  /** Şarkı kimliği — değişince "duyulan" işareti sıfırlanır. */
  roundKey: string
}

/**
 * Beş segmentli kademe göstergesi, iki yanında kaset deliği daireleri.
 *
 * İlerleme songspot.net'teki gibi davranır: her çalmada dolgu SIFIRDAN başlar
 * ve klip süresi boyunca o kademenin sonuna kadar süpürür. Klip bitince dolgu
 * geri düşmez — duyduğun kadarı yerinde kalır, böylece "geç" dedikten sonra
 * tekrar çalınca çubuk baştan ama daha uzun bir yol alır.
 *
 * ⚠️ Dolgu rAF ile doğrudan DOM'a yazılır ve `clipPlayer.plateauStart`'ı
 * bekler — yani sesin gerçekten duyulmaya başladığı anı. Tıklama anında
 * başlatılsaydı çubuk sesten önde giderdi.
 */
/** Segment kutuları arasındaki boşluk (px). */
const BOSLUK = 4

/**
 * `tierIndex` numaralı segmentin SAĞ kenarı, CSS genişliği olarak.
 *
 * ⚠️ Dolgu eskiden çubuğun TAMAMININ yüzdesiydi: `(i+1)/5 × %100`.
 * Ama segment kutuları aralarında `BOSLUK` bırakıyor, dolayısıyla i. kutunun
 * sağ kenarı çubuğun (i+1)/5'inde DEĞİL — dört boşluk kadar solunda. Dolgu her
 * kademede kutusunun dışına taşıyordu; ilk kademede taşma 16/5 ≈ 3,2 px.
 *
 * Doğrusu boşlukları düşüp sonra geri eklemek:
 *   (genişlik − toplam boşluk) × (i+1)/n  +  i × boşluk
 * Son kademede bu tam olarak %100 veriyor, yani çubuk tastamam doluyor.
 */
function hedefGenislik(tierIndex: number): string {
  const i = Math.min(Math.max(tierIndex, 0), ATTEMPTS - 1)
  const toplam = (ATTEMPTS - 1) * BOSLUK
  const oran = ((i + 1) / ATTEMPTS).toFixed(4)
  return `calc((100% - ${toplam}px) * ${oran} + ${i * BOSLUK}px)`
}

export function StepIndicator({
  attempt,
  steps,
  playing,
  clipLength,
  heardIndex,
  roundKey,
}: Props) {
  const sweepRef = useRef<HTMLDivElement>(null)

  /**
   * ⚠️ Dolgu `width` ile DEĞİL `transform: scaleX` ile SÜRÜLÜYOR.
   *
   * `width` bir DÜZEN özelliği: klip boyunca saniyede 60 kez düzen → boya →
   * birleştirme zinciri çalışıyordu. `scaleX` yalnızca birleştirme adımına
   * dokunur. Genişlik kademe başına BİR kez yazılıyor, her karede değil.
   */
  const hedefOlcek = (oran: number) => `scaleX(${oran.toFixed(4)})`

  // Yeni şarkı: dolgu sıfırlanır. (Duyulan kademe artık oyun durumunda tutulur.)
  useEffect(() => {
    if (sweepRef.current) sweepRef.current.style.transform = 'scaleX(0)'
  }, [roundKey])

  useEffect(() => {
    const el = sweepRef.current
    if (!el) return

    if (!playing) {
      if (heardIndex >= 0) {
        el.style.width = hedefGenislik(heardIndex)
        el.style.transform = 'scaleX(1)'
      } else {
        el.style.transform = 'scaleX(0)'
      }
      return
    }

    // Genişlik kademenin sağ kenarına sabitlenir; ölçek 0→1 arası süpürür.
    el.style.width = hedefGenislik(attempt)
    el.style.transform = 'scaleX(0)'
    const total = clipLength * 1000
    let raf = 0

    const tick = () => {
      // Ses başlayana kadar sıfırda bekle.
      const start = clipPlayer.plateauStart
      if (start != null) {
        const p = Math.max(0, Math.min(1, (performance.now() - start) / total))
        el.style.transform = hedefOlcek(p)
        if (p >= 1) return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, clipLength, attempt, heardIndex])

  const hole = {
    width: 13,
    height: 13,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    flex: 'none' as const,
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 430 }}
      role="group"
      aria-label="Kalan haklar"
    >
      <div style={hole} />

      <div style={{ position: 'relative', flex: 1, height: 9 }}>
        {/* Süpüren dolgu — segmentlerin ALTINDA, kesintisiz akar. */}
        <div
          ref={sweepRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            transform: 'scaleX(0)',
            transformOrigin: 'left',
            background: 'var(--acc)',
            opacity: 0.85,
            borderRadius: 2,
          }}
        />

        {/* Segment kutuları — dolgunun ÜSTÜNDE, işaretler görünür kalsın. */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: BOSLUK }}>
          {STEPS.map((len, i) => {
            const step = steps[i]
            return (
              <div
                key={i}
                title={
                  step?.kind === 'wrong'
                    ? `Yanlış: ${step.text}`
                    : step?.kind === 'skip'
                      ? 'Pas geçildi'
                      : `${tr(len)} saniye`
                }
                style={{
                  flex: 1,
                  borderRadius: 2,
                  border: `1px solid ${
                    i <= attempt ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)'
                  }`,
                  // Yalnızca hak tüketen eylemler işaretlenir. Dinlemek kutu
                  // doldurmaz — duyulan yeri zaten alttaki dolgu gösteriyor.
                  background:
                    step?.kind === 'wrong'
                      ? 'rgba(160,90,90,0.8)'
                      : step?.kind === 'skip'
                        ? 'rgba(255,255,255,0.22)'
                        : 'transparent',
                }}
              />
            )
          })}
        </div>
      </div>

      <div style={hole} />
    </div>
  )
}
