'use client'

import { SERIT } from '@/data/unlu'
import type { Step } from '@/game/machine'

/**
 * Beş şeritlik ilerleme göstergesi.
 *
 * ⚠️ `StepIndicator` YENİDEN KULLANILMADI. O bileşen `clipPlayer.plateauStart`
 * bekliyor, rAF ile dolgu sürüyor ve `STEPS` saniyelerine bağlı; ses kısmı
 * ayrılabilir değil. Buradaki iş çok daha basit — açık olanlar dolu — ve 40
 * satırlık yeni bir bileşen, props'u budanmış bir paylaşımdan ucuz.
 *
 * Kutular kademe göstergesiyle AYNI genişlikte duruyor ki iki oyun arasında
 * geçen oyuncu aynı şeyi görsün.
 */
export function SeritGostergesi({
  acilan,
  steps,
  bitti,
}: {
  acilan: number
  steps: readonly Step[]
  bitti: boolean
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 430 }}
      role="group"
      aria-label="Açılan şeritler"
    >
      <div style={DELIK} />
      <div style={{ display: 'flex', flex: 1, gap: 4 }}>
        {Array.from({ length: SERIT }, (_, i) => {
          const adim = steps[i]
          const acik = i < acilan || bitti
          return (
            <div
              key={i}
              title={
                adim?.kind === 'wrong'
                  ? `Yanlış: ${adim.text}`
                  : adim?.kind === 'skip'
                    ? 'Pas geçildi'
                    : `${i + 1}. şerit`
              }
              style={{
                flex: 1,
                height: 9,
                borderRadius: 2,
                border: `1px solid ${acik ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)'}`,
                // Yanlış ve pas ayrı renkte: hangi şeridi neyin açtığı okunsun.
                background:
                  adim?.kind === 'wrong'
                    ? 'rgba(160,90,90,0.8)'
                    : adim?.kind === 'skip'
                      ? 'rgba(255,255,255,0.22)'
                      : acik
                        ? 'var(--acc)'
                        : 'transparent',
                opacity: acik ? 0.85 : 1,
              }}
            />
          )
        })}
      </div>
      <div style={DELIK} />
    </div>
  )
}

const DELIK = {
  width: 13,
  height: 13,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.04)',
  flex: 'none' as const,
}
