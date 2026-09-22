import type { Metadata } from 'next'
import { ClientGunluk } from './ClientGunluk'

export const metadata: Metadata = {
  title: 'Günlük: Herkese Aynı 6 Soru',
  description:
    'Her gün iki şarkı, iki ünlü, iki albüm kapağı. Herkes aynı soruları çözüyor — ne kadar erken bilirsen o kadar çok puan.',
  alternates: { canonical: '/gunluk' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.in',
    title: 'Günlük · tahmin.in',
    description: 'Her gün herkese aynı 6 soru: şarkı, ünlü, albüm kapağı. Bugün kaç puan alacaksın?',
  },
}

/**
 * ⚠️ STATİK. Arşiv günü (`?gun=`) burada `searchParams` ile okunmuyor: okunsaydı
 * sayfa dinamikleşir ve BUGÜNÜN günlüğüne her geçiş sunucuda render edilirdi
 * (ölçüldü). Gün istemcide okunuyor (`GunlukSayfasi`).
 */
export default function GunlukPage() {
  return <ClientGunluk />
}
