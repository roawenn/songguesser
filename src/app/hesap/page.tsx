import type { Metadata } from 'next'
import Link from 'next/link'
import { HesapSayfasi } from './HesapSayfasi'

export const metadata: Metadata = {
  title: 'Hesabım',
  robots: { index: false },
}

export default function HesapPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <Link href="/gunluk" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink-0">Hesabım</h1>
      <HesapSayfasi />
    </main>
  )
}
