import type { Metadata } from 'next'
import { ClientUnlu } from './ClientUnlu'

export const metadata: Metadata = {
  title: 'Ünlüyü Görselinden Tanı',
  description:
    'Önce sadece saç görünür. Her tahminde bir şerit daha açılır — beş şerit dolmadan ünlüyü tanıyabilir misin?',
  alternates: { canonical: '/unlu' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.in',
    title: 'Ünlüyü Görselinden Tanı · tahmin.in',
    description: 'Önce sadece saç. Beş şerit dolmadan tanıyabilir misin?',
  },
}

export default function UnluPage() {
  return <ClientUnlu />
}
