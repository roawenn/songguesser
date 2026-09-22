import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STEPS, tr } from '@/game/ladder'
import { IPUCU_SAYISI, MAX_WRONG } from '@/game/machine'
import { sanatcilariGetir, sanatciBul } from '@/lib/sanatcilar'

/**
 * Sanatçı giriş sayfası — "sezen aksu şarkı tahmin oyunu" gibi aramaların kanalı.
 *
 * ⚠️ ŞARKI ADI YAZILMAZ: havuzdaki şarkıların adını dizine vermek oyunun cevap
 * anahtarını yayınlamak olur. Sanatçı adı sorun değil — oyun şarkıyı soruyor.
 *
 * ⚠️ `dynamicParams` açık: panelden şarkı eklenip bir sanatçı eşiği geçince
 * sayfası derleme beklemeden açılsın. Listede olmayan kısa ad 404.
 */

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

export async function generateStaticParams() {
  return (await sanatcilariGetir()).map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await sanatciBul((await params).slug)
  if (!s) return {}
  const baslik = `${s.ad} Şarkı Tahmin Oyunu`
  const ozet = `${s.ad} şarkılarını yarım saniyeden tanıyabilir misin? ${s.sayi} şarkılık hayran testi — kayıt yok, anında oyna.`
  return {
    title: baslik,
    description: ozet,
    alternates: { canonical: `/sanatci/${s.slug}` },
    openGraph: { title: `${baslik} · tahmin.in`, description: ozet, type: 'website' },
  }
}

export default async function SanatciPage({ params }: Props) {
  const slug = (await params).slug
  const s = await sanatciBul(slug)
  if (!s) notFound()

  // İç bağlantı: en çok şarkısı olan diğer sanatçılar.
  const digerleri = (await sanatcilariGetir()).filter((x) => x.slug !== slug).slice(0, 24)

  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/sanatci" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Tüm sanatçılar
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">{s.ad} şarkı tahmin oyunu</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        {s.ad} şarkılarını ne kadar iyi tanıyorsun? Yalnızca onun şarkılarından oluşan bir
        tur açılır; ilk yarım saniyeden hangi şarkı olduğunu bulmaya çalışırsın.
      </p>

      <p className="mt-6">
        <Link
          href={`/?sanatci=${s.slug}`}
          className="inline-block rounded-md bg-[#7dd3fc] px-7 py-3.5 font-semibold text-[#0a0c0e] no-underline"
        >
          {s.ad} ile oyna
        </Link>
      </p>

      <dl className="mt-10 flex flex-col gap-5">
        <div>
          <dt className="font-semibold text-ink-0">Kaç şarkı var?</dt>
          <dd className="mt-1.5 leading-relaxed text-ink-2">
            Şu an <strong className="text-ink-0">{s.sayi}</strong> şarkı. Havuz elle
            küratörleniyor; her parçanın zorluk kademesi ve orijinal çıkış yılı tek tek atanıyor.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-ink-0">Nasıl oynanır?</dt>
          <dd className="mt-1.5 leading-relaxed text-ink-2">
            {tr(STEPS[0]!)} saniyelik bir klip çalınır. Bilemezsen ya da pas geçersen klip
            uzar: {STEPS.map((x) => `${tr(x)} sn`).join(' → ')}. {MAX_WRONG} yanlış tahmin
            hakkın var; takılırsan {IPUCU_SAYISI} ipucu alabilirsin.{' '}
            <Link href="/nasil-oynanir" className="underline underline-offset-4">
              Tüm kurallar
            </Link>
            .
          </dd>
        </div>
      </dl>

      {digerleri.length > 0 && (
        <nav className="mt-12 border-t border-white/10 pt-6">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-ink-3">
            Diğer sanatçılar
          </h2>
          <div className="flex flex-wrap gap-2">
            {digerleri.map((x) => (
              <Link
                key={x.slug}
                href={`/sanatci/${x.slug}`}
                className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs text-ink-2 no-underline hover:border-white/25"
              >
                {x.ad}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </main>
  )
}
