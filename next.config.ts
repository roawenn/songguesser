import type { NextConfig } from 'next'

/**
 * Güvenlik başlıkları.
 *
 * ⚠️ CSP `Report-Only` olarak başlıyor, BİLEREK. Next'in gömülü bootstrap
 * betikleri `'unsafe-inline'` gerektiriyor, ses önizlemeleri ve kapaklar Apple
 * alan adlarından geliyor ve `ssr: false` ile tembel yüklenen parçalar var —
 * doğrulamadan zorlayıcı moda geçmek siteyi sessizce kırar. Bir tur oynanıp
 * konsolda ihlal olmadığı görüldükten sonra başlık adı
 * `Content-Security-Policy` yapılmalı.
 *
 * ⚠️ `style-src 'unsafe-inline'` kaçınılmaz: sahnenin tamamı satır içi
 * `style={{}}` ile yazılmış. Bu, CSP'nin XSS değerini zayıflatıyor; buna
 * karşılık `script-src` dış kaynakları, `frame-ancestors` çerçevelemeyi ve
 * `object-src` eklentileri yine de kapatıyor.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.mzstatic.com",
  "media-src 'self' blob: https://*.itunes.apple.com https://*.mzstatic.com",
  "connect-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.mzstatic.com' }],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `frame-ancestors` ile aynı işi görür; eski tarayıcılar için duruyor.
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
