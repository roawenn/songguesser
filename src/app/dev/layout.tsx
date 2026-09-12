import type { Metadata } from 'next'

/**
 * Geliştirme araçları dizini.
 *
 * `robots.txt` zaten `/dev/` yolunu kapatıyor ama o yalnızca bir RİCA; doğrudan
 * bağlantı verilen sayfa yine dizine girebilir. `noindex` başlığı bağlayıcıdır.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children
}
