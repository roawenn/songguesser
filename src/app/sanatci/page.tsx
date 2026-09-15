import type { Metadata } from 'next'
import Link from 'next/link'
import { sanatcilariGetir, SANATCI_ESIK } from '@/lib/sanatcilar'

/**
 * Sanatçı dizini — sanatçı modu sayfalarının girişi ve iç bağlantı merkezi.
 *
 * ⚠️ ŞARKI ADI YAZILMAZ (seçki sayfalarındaki kuralın aynısı): havuzdaki
 * şarkıların adını dizine vermek oyunun cevap anahtarını yayınlamak olur.
 */

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Sanatçıya Göre Şarkı Tahmin Oyunu',
  description:
    'Sezen Aksu, Tarkan, Müslüm Gürses… Sevdiğin sanatçının şarkılarını yarım saniyeden tanıyabilir misin? Sanatçı seç, hayran testine başla.',
  alternates: { canonical: '/sanatci' },
}

export default async function SanatcilarPage() {
  const liste = await sanatcilariGetir()

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">Sanatçıya göre oyna</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        Yalnızca bir sanatçının şarkılarıyla oyna — gerçek bir hayran testi. Kurallar aynı:
        yarım saniyeyle başlarsın, bilemedikçe klip uzar. Burada en az {SANATCI_ESIK} şarkısı
        olan sanatçılar var.
      </p>

      {liste.length === 0 ? (
        <p className="mt-10 text-ink-3">Sanatçı listesi şu an yüklenemedi.</p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {liste.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/sanatci/${s.slug}`}
                className="flex items-baseline justify-between gap-3 rounded border border-white/10 px-3 py-2 text-ink-1 no-underline hover:border-white/25"
              >
                <span className="truncate">{s.ad}</span>
                <span className="flex-none font-mono text-xs text-ink-3">{s.sayi}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
