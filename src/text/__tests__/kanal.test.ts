import { describe, it, expect } from 'vitest'
import { kanalAdiTemizle } from '../kanal'

describe('kanalAdiTemizle', () => {
  it('büyük harfi küçültür', () => {
    expect(kanalAdiTemizle('KaiCenat', 'twitch')).toBe('kaicenat')
  })

  it('bağlantıdan ve @ işaretinden adı çıkarır', () => {
    expect(kanalAdiTemizle('https://www.twitch.tv/xqc', 'twitch')).toBe('xqc')
    expect(kanalAdiTemizle('@elraenn', 'twitch')).toBe('elraenn')
    expect(kanalAdiTemizle('kick.com/jahrein?ref=abc', 'kick')).toBe('jahrein')
    expect(kanalAdiTemizle('  https://kick.com/some-user/  ', 'kick')).toBe('some-user')
  })

  it('tire Kick için geçerli, Twitch için değil', () => {
    expect(kanalAdiTemizle('some-user', 'kick')).toBe('some-user')
    expect(kanalAdiTemizle('some-user', 'twitch')).toBeNull()
  })

  it('geçersiz adları reddeder', () => {
    expect(kanalAdiTemizle('ab', 'twitch')).toBeNull()
    expect(kanalAdiTemizle('bad name!', 'twitch')).toBeNull()
    expect(kanalAdiTemizle('', 'kick')).toBeNull()
    expect(kanalAdiTemizle('şarkı', 'kick')).toBeNull()
  })
})
