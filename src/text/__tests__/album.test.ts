import { describe, it, expect } from 'vitest'
import { albumAnahtarlari, albumTemizle } from '../album'

describe('albumTemizle', () => {
  it('mağazanın biçim eklerini siler', () => {
    expect(albumTemizle('Gülümse - Single')).toBe('Gülümse')
    expect(albumTemizle('Sezen Aksu Söylüyor - EP')).toBe('Sezen Aksu Söylüyor')
  })

  it('sürüm parantezlerini siler', () => {
    expect(albumTemizle('Kuşu Kalkmış (Deluxe Edition)')).toBe('Kuşu Kalkmış')
    expect(albumTemizle('Aşk Tesadüfleri Sever [Remastered]')).toBe('Aşk Tesadüfleri Sever')
    expect(albumTemizle('Gitme (2011 Remaster)')).toBe('Gitme')
    expect(albumTemizle('Konser (Canlı)')).toBe('Konser')
  })

  it('tireden sonraki sürüm açıklamasını siler', () => {
    expect(albumTemizle('Unutulmayanlar - Remastered 2015')).toBe('Unutulmayanlar')
  })

  it('adın parçası olan parantezi KORUR', () => {
    expect(albumTemizle('Aşk (Değişmem)')).toBe('Aşk (Değişmem)')
  })

  it('temiz adı değiştirmez', () => {
    expect(albumTemizle('Git')).toBe('Git')
  })
})

describe('albumAnahtarlari', () => {
  it('Türkçe karakter şart olmadan eşleşecek anahtar üretir', () => {
    expect(albumAnahtarlari('Gülümse')).toContain('gulumse')
  })

  it('boş addan anahtar üretmez', () => {
    expect(albumAnahtarlari('')).toEqual([])
  })
})
