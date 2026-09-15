import { describe, it, expect } from 'vitest'
import { kodAyikla } from '../duel'

describe('kodAyikla', () => {
  it('düz kodu olduğu gibi kabul eder', () => {
    expect(kodAyikla('Y8Q6S4')).toBe('Y8Q6S4')
  })

  it('küçük harf, boşluk ve tireyi temizler', () => {
    expect(kodAyikla('  y8q6s4 ')).toBe('Y8Q6S4')
    expect(kodAyikla('Y8Q 6S4')).toBe('Y8Q6S4')
    expect(kodAyikla('y8q-6s4')).toBe('Y8Q6S4')
  })

  it('bağlantının tamamından kodu çıkarır', () => {
    expect(kodAyikla('https://tahmin.net/duello/Y8Q6S4')).toBe('Y8Q6S4')
    expect(kodAyikla('http://localhost:3000/duello/y8q6s4?x=1')).toBe('Y8Q6S4')
  })

  it('geçersiz kodları reddeder', () => {
    expect(kodAyikla('')).toBeNull()
    expect(kodAyikla('Y8Q6S')).toBeNull()
    expect(kodAyikla('Y8Q6S45')).toBeNull()
    // Alfabede olmayan harfler: 0, O, 1, I, U
    expect(kodAyikla('Y8Q6S0')).toBeNull()
    expect(kodAyikla('UUUUUU')).toBeNull()
    expect(kodAyikla('ıııııı')).toBeNull()
    expect(kodAyikla('https://tahmin.net/kapak')).toBeNull()
  })
})
