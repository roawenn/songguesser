import type { Metadata } from 'next'
import { gunGecerli } from '@/game/gun'
import { ClientGunluk } from './ClientGunluk'

export const metadata: Metadata = {
  title: 'Günlük: Herkese Aynı 6 Soru',
  description:
    'Her gün iki şarkı, iki ünlü, iki albüm kapağı. Herkes aynı soruları çözüyor — ne kadar erken bilirsen o kadar çok puan.',
  alternates: { canonical: '/gunluk' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.net',
    title: 'Günlük · tahmin.net',
    description: 'Her gün herkese aynı 6 soru: şarkı, ünlü, albüm kapağı. Bugün kaç puan alacaksın?',
  },
}

/** `?gun=YYYY-MM-DD` → arşivden, sıralamasız. Geçerliliği ve sınırı sunucu denetliyor. */
export default async function GunlukPage({ searchParams }: { searchParams: Promise<{ gun?: string }> }) {
  const { gun } = await searchParams
  return <ClientGunluk arsivGun={gunGecerli(gun) ? gun : null} />
}
