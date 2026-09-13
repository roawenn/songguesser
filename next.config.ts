import type { NextConfig } from 'next'

const gelistirme = process.env.NODE_ENV !== 'production'

/**
 * Güvenlik başlıkları.
 *
 * CSP artık ZORLAYICI. Report-Only olarak bir tur bekletildi ve yedi sayfada
 * (ana sayfa, nasıl oynanır, hakkında, seçki, paylaş, yönetim, düello) tam bir
 * tur oynanarak, ses/kapak/API çağrıları dahil, tek bir ihlal üretmediği
 * ölçüldü.
 *
 * ⚠️ `'unsafe-eval'` YALNIZCA geliştirmede. Next'in Fast Refresh altyapısı onu
 * istiyor; üretim paketinde gerek yok ve orada açık bırakmak CSP'nin en değerli
 * kısmını bedavaya vermek olurdu.
 *
 * ⚠️ `style-src 'unsafe-inline'` kaçınılmaz: sahnenin tamamı satır içi
 * `style={{}}` ile yazılmış. Bu, CSP'nin XSS değerini zayıflatıyor; buna
 * karşılık `script-src` dış kaynakları, `frame-ancestors` çerçevelemeyi ve
 * `object-src` eklentileri yine de kapatıyor.
 *
 * ⚠️ `media-src`'de Apple'ın İKİ alan adı da olmalı: önizleme sesi
 * `audio-ssl.itunes.apple.com`'dan, kapak `is1-ssl.mzstatic.com`'dan geliyor.
 * Biri eksik kalırsa oyun sessizce çalmaz hâle gelir.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${gelistirme ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // ⚠️ `*.supabase.co`: ünlü görselleri Supabase Storage'dan geliyor. Eksik
  // kalırsa görseller SESSİZCE engellenir — CSP zorlayıcı ve konsola tek satır
  // düşer. `blob:` ve `data:` admin kırpıcısının önizlemesi için zaten var.
  "img-src 'self' data: blob: https://*.mzstatic.com https://*.supabase.co",
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
    // Proje ham `<img>` kullanıyor, `next/image` değil; bu liste ileriye dönük.
    remotePatterns: [
      { protocol: 'https', hostname: '*.mzstatic.com' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
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
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
