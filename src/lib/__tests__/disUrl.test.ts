import { describe, it, expect } from 'vitest'
import { guvenliDisUrl } from '../disUrl'

/**
 * SSRF savunması. Yönetim paneli kimlik doğrulamalı ama uç nokta yine de
 * "bize keyfi bir adrese istek attır" demek; küratör hesabı ele geçirilirse
 * sunucu iç ağa sokulabilir. `169.254.169.254` tek bir GET ile bulut kimlik
 * bilgilerini döker — bu yüzden liste tek tek kilitleniyor.
 */
describe('guvenliDisUrl', () => {
  const red = (u: string) => expect(guvenliDisUrl(u).ok, u).toBe(false)
  const kabul = (u: string) => expect(guvenliDisUrl(u).ok, u).toBe(true)

  it('yalnızca https kabul eder', () => {
    kabul('https://ornek.com/a.jpg')
    red('http://ornek.com/a.jpg')
    red('file:///etc/passwd')
    red('data:image/png;base64,AAAA')
    red('ftp://ornek.com/a.jpg')
    red('gopher://ornek.com/a')
  })

  it('bulut metadata servisini reddeder', () => {
    red('https://169.254.169.254/latest/meta-data/')
    red('https://169.254.169.254/')
  })

  it('geri döngü ve yerel adları reddeder', () => {
    red('https://127.0.0.1/a.jpg')
    red('https://127.1.2.3/a.jpg')
    red('https://localhost/a.jpg')
    red('https://api.localhost/a.jpg')
    red('https://yazici.local/a.jpg')
    red('https://[::1]/a.jpg')
    red('https://0.0.0.0/a.jpg')
  })

  it('özel ağ aralıklarını reddeder', () => {
    red('https://10.0.0.1/a.jpg')
    red('https://10.255.255.255/a.jpg')
    red('https://192.168.1.1/a.jpg')
    red('https://172.16.0.1/a.jpg')
    red('https://172.31.255.1/a.jpg')
    red('https://100.64.0.1/a.jpg') // CGNAT
  })

  it('özel OLMAYAN 172.x aralığını kabul eder', () => {
    // 172.15 ve 172.32 özel DEĞİL — sınırın iki yanı da sınanıyor.
    kabul('https://172.15.0.1/a.jpg')
    kabul('https://172.32.0.1/a.jpg')
  })

  it('IPv6 yerel biçimlerini reddeder', () => {
    red('https://[fc00::1]/a.jpg')
    red('https://[fe80::1]/a.jpg')
    // ⚠️ URL ayrıştırıcısı bunu `[::ffff:7f00:1]`'e normalleştiriyor.
    red('https://[::ffff:127.0.0.1]/a.jpg')
    red('https://[::ffff:10.0.0.1]/a.jpg')
    red('https://[64:ff9b::127.0.0.1]/a.jpg') // NAT64
    kabul('https://[2606:4700::1]/a.jpg') // genel IPv6 geçmeli
  })

  it('noktasız ana adları (iç ağ makineleri) reddeder', () => {
    red('https://intranet/a.jpg')
    red('https://sunucu/gorsel.png')
  })

  it('normal genel adresleri kabul eder', () => {
    kabul('https://upload.wikimedia.org/wikipedia/commons/a.png')
    kabul('https://cdn.ornek.com.tr/görsel.jpg')
    kabul('https://8.8.8.8/a.jpg')
  })

  it('büyük harfli ana adı küçültmeden doğru işler', () => {
    // URL ayrıştırıcısı ASCII ana adı zaten küçültüyor; `toLowerCase()` YOK.
    red('https://LOCALHOST/a.jpg')
    red('https://127.0.0.1/A.JPG')
  })
})
