import { describe, it, expect } from 'vitest'
import { ARM_BUFFER, armPenceresi, MAX_CLIP, PREROLL, previewIsLongEnough } from '../envelope'
import { MAX_STEP } from '@/game/ladder'

describe('armPenceresi', () => {
  it('merdivenin tavanı kadar değil, ARM_BUFFER kadar arabellek ister', () => {
    const p = armPenceresi(0.325, 29)
    expect(p.to - p.from).toBeLessThan(ARM_BUFFER + PREROLL + 0.001)
    // Eski davranış (MAX_CLIP) bunun dört katından fazlaydı.
    expect(p.to - p.from).toBeLessThan(MAX_CLIP / 3)
  })

  it('medyanın sonunu aşmaz', () => {
    expect(armPenceresi(0.325, 1.5).to).toBe(1.5)
  })

  it('çok erken klip başlangıcını alt sınıra çeker', () => {
    expect(armPenceresi(0, 29).from).toBeGreaterThanOrEqual(0)
    expect(armPenceresi(0, 29).to).toBeGreaterThan(ARM_BUFFER)
  })
})

describe('previewIsLongEnough', () => {
  it('arabellek kapısından BAĞIMSIZ: hâlâ merdivenin tavanını istiyor', () => {
    // 29 sn'lik önizleme 10 sn'lik son kademeyi taşır.
    expect(previewIsLongEnough(29, 0.325, MAX_STEP)).toBe(true)
    // 8 sn'lik bir önizleme taşımaz — kapı küçüldü diye bu gevşememeli.
    expect(previewIsLongEnough(8, 0.325, MAX_STEP)).toBe(false)
  })
})
