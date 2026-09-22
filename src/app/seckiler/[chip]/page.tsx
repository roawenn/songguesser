import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CHIPS, chipById, type ChipId } from '@/data/categories'
import { CHIP_COPY } from '@/data/chipCopy'
import { seedsFor } from '@/data/seeds'
import { STEPS, tr } from '@/game/ladder'
import { MAX_WRONG } from '@/game/machine'
import { songCount } from '@/lib/poolCount'

/**
 * Seçki giriş sayfaları.
 *
 * Bunlar oyunun organik arama kanalı: "türkçe rap şarkı tahmin oyunu",
 * "90'lar şarkı bilme oyunu" gibi aramalar. Site bunlardan önce yalnızca üç
 * sayfayla görünüyordu.
 *
 * ⚠️ ŞARKI ADI YAZILMAZ. Havuzdaki şarkıların adını dizine vermek oyunun cevap
 * anahtarını yayınlamak olur. Sanatçı adı sorun değil — oyun şarkıyı sorar.
 */
interface Props {
  params: Promise<{ chip: string }>
}

export function generateStaticParams() {
  return CHIPS.map((c) => ({ chip: c.id }))
}

function bul(raw: string): ChipId | null {
  return CHIPS.find((c) => c.id === raw)?.id ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chip = bul((await params).chip)
  if (!chip) return {}
  const copy = CHIP_COPY[chip]
  return {
    title: copy.h1,
    description: copy.ozet,
    alternates: { canonical: `/seckiler/${chip}` },
    openGraph: { title: `${copy.h1} · tahmin.in`, description: copy.ozet, type: 'website' },
  }
}

export default async function SeckiPage({ params }: Props) {
  const chip = bul((await params).chip)
  if (!chip) notFound()

  const copy = CHIP_COPY[chip]
  const bilgi = chipById(chip)
  const sayi = await songCount(chip)
  const source = bilgi.source
  const sanatcilar = source.kind === 'genre' ? seedsFor(source.genre).slice(0, 18) : []

  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">{copy.h1}</h1>
      <p className="mt-3 text-ink-2 leading-relaxed">{copy.giris}</p>

      <p className="mt-6">
        <Link
          href={`/?secki=${chip}`}
          className="inline-block rounded-md bg-[#7dd3fc] px-7 py-3.5 font-semibold text-[#0a0c0e] no-underline"
        >
          {bilgi.label} oyna
        </Link>
      </p>

      <dl className="mt-10 flex flex-col gap-5">
        {sayi !== null && (
          <div>
            <dt className="font-semibold text-ink-0">Bu seçkide kaç şarkı var?</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-2">
              Şu an <strong className="text-ink-0">{sayi}</strong> şarkı. Havuz elle
              küratörleniyor; her parçanın zorluk kademesi ve orijinal çıkış yılı tek tek
              atanıyor.
            </dd>
          </div>
        )}


        {sanatcilar.length > 0 && (
          <div>
            <dt className="font-semibold text-ink-0">Kimler var?</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-2">
              {sanatcilar.join(' · ')} ve dahası.
            </dd>
          </div>
        )}

        <div>
          <dt className="font-semibold text-ink-0">Nasıl oynanır?</dt>
          <dd className="mt-1.5 leading-relaxed text-ink-2">
            {tr(STEPS[0]!)} saniyelik bir klip çalınır. Bilemezsen ya da pas geçersen klip
            uzar: {STEPS.map((s) => `${tr(s)} sn`).join(' → ')}. {MAX_WRONG} yanlış tahmin
            hakkın var; dinlemek bedava.{' '}
            <Link href="/nasil-oynanir" className="underline underline-offset-4">
              Tüm kurallar
            </Link>
            .
          </dd>
        </div>
      </dl>

      <nav className="mt-12 border-t border-white/10 pt-6">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-ink-3">
          Diğer seçkiler
        </h2>
        <div className="flex flex-wrap gap-2">
          {CHIPS.filter((c) => c.id !== chip).map((c) => (
            <Link
              key={c.id}
              href={`/seckiler/${c.id}`}
              className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs text-ink-2 no-underline hover:border-white/25"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
