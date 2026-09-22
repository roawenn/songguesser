import type { Metadata } from 'next'
import { ClientYayin } from './ClientYayin'

export const metadata: Metadata = {
  title: 'Yayıncı Modu',
  description:
    'Twitch ya da Kick sohbetinle şarkı tahmini oyna: izleyiciler sohbete şarkının adını yazar, erken bilen çok puan alır. Hesap gerekmez.',
  alternates: { canonical: '/yayin' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'tahmin.in',
    title: 'Yayıncı Modu · tahmin.in',
    description: 'Sohbetinle şarkı tahmini: klip uzar, erken bilen çok puan alır.',
  },
}

export default function YayinPage() {
  return <ClientYayin />
}
