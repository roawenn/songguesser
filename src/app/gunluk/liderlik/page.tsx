import type { Metadata } from 'next'
import Link from 'next/link'
import { LiderlikSayfasi } from './LiderlikSayfasi'

export const metadata: Metadata = {
  title: 'Günlük Sıralama',
  description: 'Günlük modun bugünkü ve bu haftaki sıralaması.',
  alternates: { canonical: '/gunluk/liderlik' },
}

export default function LiderlikPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <Link href="/gunluk" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Günlüğe dön
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink-0">Günlük sıralama</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">
        Oyuna başlamadan önce Google ile giriş yapmış oyuncular. Haftalık sıralama pazartesi başlar,
        günlük puanların toplamıdır; eşitlikte önce bitiren üstte.
      </p>
      <LiderlikSayfasi />
    </main>
  )
}
