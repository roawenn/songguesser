import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { kodGecerli } from '@/game/duel'
import { ClientDuello } from './ClientDuello'

export const metadata: Metadata = {
  title: 'Düello',
  description: 'Arkadaşınla aynı beş şarkı, kolaydan zora.',
  // Her lobi için ayrı bir URL doğuyor; dizine girmesinler.
  robots: { index: false, follow: true },
}

export default async function DuelloPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params
  // Biçim yanlışsa veritabanına hiç gitme.
  if (!kodGecerli(kod)) notFound()
  return <ClientDuello kod={kod} />
}
