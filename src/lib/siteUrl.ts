/**
 * Kanonik adres — tek kaynak.
 *
 * ⚠️ Daha önce üç yerde ayrı ayrı yazılıydı ve `sitemap.ts` ile `robots.ts`
 * sabit `tahmin.net` kullanıyordu. Sonuç: Vercel önizleme dağıtımları canlı
 * adresi işaret eden bir sitemap yayınlıyordu.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === 'production'
    ? 'https://tahmin.net'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tahmin.net')
