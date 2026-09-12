import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import '../styles/globals.css'

// ⚠️ 'latin-ext' ZORUNLU. Yalnızca 'latin' ile ğ, ş, İ, ı, Ş, Ğ sessizce düşer
// ve tam da en önemli kelimelerde yedek font karmaşası oluşur.

// Instrument Serif'in tek ağırlığı var (400); marka ve cevap başlığı italik kullanılır.
const serif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const sans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
})

/**
 * Kanonik adres.
 *
 * ⚠️ Sabit kodlanırsa Vercel önizleme dağıtımları da canlı adresi kanonik
 * gösterir; `VERCEL_URL` her dağıtımın kendi adresini verir.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === 'production'
    ? 'https://tahmin.net'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tahmin.net')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'tahmin.net — Türkçe Şarkı Tahmin Oyunu',
    template: '%s · tahmin.net',
  },
  description:
    'Yarım saniyeden şarkıyı bil. Türkçe pop, rap, arabesk, rock, halk ve sanat müziğinden yüzlerce parça. Kayıt yok, reklam yok, anında oyna.',
  keywords: [
    'şarkı tahmin oyunu',
    'türkçe müzik oyunu',
    'şarkıyı bil',
    'müzik bilgi yarışması',
    'türkçe heardle',
    'tahmin.net',
  ],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.net',
    title: 'tahmin.net — Türkçe Şarkı Tahmin Oyunu',
    description: 'Yarım saniyeden şarkıyı bilebilir misin?',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tahmin.net — Türkçe Şarkı Tahmin Oyunu',
    description: 'Yarım saniyeden şarkıyı bilebilir misin?',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0a0b0d',
  width: 'device-width',
  initialScale: 1,
  // Erişilebilirlik için elle yakınlaşmayı YASAKLAMA.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${serif.variable} ${mono.variable} ${sans.variable}`}
    >
      <head>
        {/* Ses ve kapak görselleri doğrudan Apple'dan gelir — el sıkışmayı öne al. */}
        <link rel="preconnect" href="https://audio-ssl.itunes.apple.com" crossOrigin="" />
        <link rel="preconnect" href="https://is1-ssl.mzstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  )
}
