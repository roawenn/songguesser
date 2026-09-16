import { describe, it, expect } from 'vitest'
import type { GunlukOlay } from '../gunluk'
import { adimIndeksi, hakKalan, olayGecerli, turBitisi, turDurumu } from '../gunlukKural'
import { ogeler } from './gunlukOrnek'

const [sarki, , unlu, , kapak] = ogeler()
const Y: GunlukOlay = { t: 'Y', m: 'x', sa: false, z: 0 }
const P: GunlukOlay = { t: 'P', z: 0 }
const I: GunlukOlay = { t: 'I', z: 0 }
const D: GunlukOlay = { t: 'D', z: 0 }

describe('şarkı turu', () => {
  it('başlangıçta hazır, 3 hak, ilk adım', () => {
    const t = turDurumu(sarki!, [])
    expect(t.d.s).toBe('ready')
    expect(hakKalan(t)).toBe(3)
    expect(adimIndeksi(t)).toBe(0)
  })

  it('üç yanlışta kaybedilir', () => {
    expect(turBitisi(turDurumu(sarki!, [Y, Y]))).toBeNull()
    expect(turBitisi(turDurumu(sarki!, [Y, Y, Y]))).toBe('kaybetti')
  })

  it('merdivenin sonunda kaybedilir (paslar da sayar)', () => {
    expect(turBitisi(turDurumu(sarki!, [P, P, P, P]))).toBeNull()
    expect(turBitisi(turDurumu(sarki!, [P, P, P, P, Y]))).toBe('kaybetti')
  })

  it('ipucu kademe yakar, son kademede ve üçüncüde reddedilir', () => {
    const t = turDurumu(sarki!, [I])
    expect(adimIndeksi(t)).toBe(1)
    expect(olayGecerli(turDurumu(sarki!, [I, I]), I)).toBe(false)
    expect(olayGecerli(turDurumu(sarki!, [P, P, P]), I)).toBe(true)
    expect(olayGecerli(turDurumu(sarki!, [P, P, P, P]), I)).toBe(false)
  })

  it('doğru adım indeksini korur, bitmiş turda hamle geçersiz', () => {
    const t = turDurumu(sarki!, [Y, P, D])
    expect(turBitisi(t)).toBe('kazandi')
    expect(adimIndeksi(t)).toBe(2)
    expect(olayGecerli(t, Y)).toBe(false)
    expect(olayGecerli(t, D)).toBe(false)
  })
})

describe('ünlü ve kapak turu', () => {
  it('dört yanlışta kaybedilir, hak 4 → 1', () => {
    for (const oge of [unlu!, kapak!]) {
      expect(hakKalan(turDurumu(oge, []))).toBe(4)
      expect(hakKalan(turDurumu(oge, [Y, Y, Y]))).toBe(1)
      expect(turBitisi(turDurumu(oge, [Y, P, Y]))).toBeNull()
      expect(turBitisi(turDurumu(oge, [Y, P, Y, P]))).toBe('kaybetti')
    }
  })

  it('ipucu yok', () => {
    expect(olayGecerli(turDurumu(unlu!, []), I)).toBe(false)
    expect(olayGecerli(turDurumu(kapak!, []), I)).toBe(false)
  })

  it('adım indeksi açık şerit/adım − 1', () => {
    expect(adimIndeksi(turDurumu(unlu!, [D]))).toBe(0)
    expect(adimIndeksi(turDurumu(kapak!, [Y, Y, D]))).toBe(2)
  })
})
