import type { Metadata } from 'next'
import { ClientKapak } from './ClientKapak'

export const metadata: Metadata = {
  title: 'Kapaktan Albümü Bil',
  description:
    'Albüm kapağı 8×8 pikselle başlar, her tahminde biraz daha netleşir. Türkçe albümleri kapağından tanıyabilir misin?',
  alternates: { canonical: '/kapak' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.in',
    title: 'Kapaktan Albümü Bil · tahmin.in',
    description: 'Kapak 8×8 pikselle başlar. Tam netleşmeden albümü tanıyabilir misin?',
  },
}

export default function KapakPage() {
  return <ClientKapak />
}
