import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Instrument_Serif, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import '../styles/globals.css'
import { SITE_URL } from '@/lib/siteUrl'

/** Umami Cloud site kimliği — tanımsızsa analitik hiç yüklenmez (bkz. `lib/olay.ts`). */
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_ID

/**
 * Umami'ye gitmeden önce her yükü süzen işlev (`data-before-send`).
 *
 * - Yönetim paneli hiç sayılmaz: tek kişinin çalışma trafiği oyuncu verisini bozar.
 * - Düello ve paylaşım kodları TEK kalıba indirilir. Düello kodu bir lobiye giriş
 *   bileti; analitik paneline binlerce ayrı URL olarak düşmesi hem gürültü hem
 *   gereksiz bir sızıntı olurdu.
 *
 * ⚠️ Satır içi betik: CSP `script-src 'unsafe-inline'` zaten açık (bkz. next.config).
 */
const UMAMI_SUZGEC = `window.nkUmamiSuzgec=function(t,p){if(!p||typeof p.url!=='string')return p;if(p.url.indexOf('/yonetim')===0)return false;p.url=p.url.replace(/^\\/duello\\/[^/?#]+/,'/duello/[kod]').replace(/^\\/paylas\\/[^/?#]+/,'/paylas/[kod]');return p}`

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  /*
   * ⚠️ Kök metadata artık İKİ oyunu birden kapsıyor. Her oyun kendi
   * `metadata`'sını export ediyor; buradaki yalnızca site geneli.
   */
  title: {
    default: 'tahmin.in — Türkçe Tahmin Oyunları',
    template: '%s · tahmin.in',
  },
  description:
    'Yarım saniyeden şarkıyı bil, ünlüyü saçından tanı. Üyelik gerekmez, reklam yok, anında oyna.',
  keywords: [
    'şarkı tahmin oyunu',
    'türkçe müzik oyunu',
    'şarkıyı bil',
    'ünlü tahmin oyunu',
    'türkçe heardle',
    'tahmin.in',
  ],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.in',
    title: 'tahmin.in — Türkçe Tahmin Oyunları',
    description: 'Yarım saniyeden şarkıyı bil, ünlüyü saçından tanı.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tahmin.in — Türkçe Tahmin Oyunları',
    description: 'Yarım saniyeden şarkıyı bil, ünlüyü saçından tanı.',
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
        {/*
          Ünlü görselleri Supabase Storage'dan geliyor.

          ⚠️ `@/lib/supabase` BURADAN import edilmiyor: o dosya `server-only`
          ve layout'un modül grafiğini gereksiz kirletirdi. Değer zaten
          herkese açık bir ortam değişkeni.
        */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="" />
        )}
      </head>
      <body>
        {children}
        {/*
          Çerezsiz analitik — yalnızca üretimde ve kimlik tanımlıysa.
          `data-domains`: önizleme dağıtımları ve yerel üretim derlemeleri
          canlı veriyi kirletmesin. `data-exclude-search`: sorgu dizeleri
          (ör. `?secki=`) sayfa sayısını parçalamasın; seçki zaten olayda var.
        */}
        {process.env.NODE_ENV === 'production' && UMAMI_ID && (
          <>
            <Script id="nk-umami-suzgec" strategy="afterInteractive">
              {UMAMI_SUZGEC}
            </Script>
            <Script
              src="/u/s.js"
              strategy="afterInteractive"
              data-website-id={UMAMI_ID}
              data-host-url="/u"
              data-domains={new URL(SITE_URL).hostname}
              data-exclude-search="true"
              data-before-send="nkUmamiSuzgec"
            />
          </>
        )}
      </body>
    </html>
  )
}
