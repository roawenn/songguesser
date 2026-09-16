import type { Metadata } from 'next'
import Link from 'next/link'
import { ArsivListesi } from './ArsivListesi'

export const metadata: Metadata = {
  title: 'Günlük Arşivi',
  description: 'Kaçırdığın günlerin altı sorusunu puansız oyna.',
  alternates: { canonical: '/gunluk/arsiv' },
}

export default function ArsivPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <Link href="/gunluk" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Bugünün günlüğü
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink-0">Günlük arşivi</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">
        Kaçırdığın günleri oynayabilirsin. Arşiv oyunları sıralamaya ve seriye girmez. Bir gün,
        ertesi gece 03:00&rsquo;te arşive düşer.
      </p>
      <ArsivListesi />
    </main>
  )
}
