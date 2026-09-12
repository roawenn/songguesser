import type { Metadata } from 'next'
import { ClientGame } from '../../ClientGame'
import { decodeChallenge } from '@/game/challenge'
import { chipLabel, emojiLine, verdictLine } from '@/game/share'

/**
 * Meydan okuma sayfası — arkadaşın sabitlediği şarkıyı oynatır.
 *
 * `/paylas/[kod]` "övünme", burası "davet": aynı kodlama ailesinden ama farklı
 * metin, farklı kart, farklı sayfa. Sayfanın kendisi oyunu render eder;
 * ziyaretçi tek tıkla oynamaya başlar.
 *
 * ⚠️ ŞARKI BURADA ÇÖZÜLMEZ. Kod, istemciye ham dize olarak geçer ve yalnızca
 * `GameShell` içinde çözülür. Burada çözülüp prop olarak geçilseydi sabitlenen
 * şarkı Next'in RSC yükünde düz metin olarak otururdu — "sayfa kaynağını
 * görüntüle" ile okunabilirdi, yani linkin kendisinden çok daha büyük bir
 * sızıntı olurdu.
 */
interface Props {
  params: Promise<{ kod: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kod } = await params
  const c = decodeChallenge(decodeURIComponent(kod))

  if (!c) {
    return { title: 'Meydan okuma', robots: { index: false, follow: true } }
  }

  const title = `${chipLabel(c.result.chip)} · ${verdictLine(c.result)}`
  const description = `${emojiLine(c.result.marks)} — sen kaç saniyede bilirsin?`

  return {
    title,
    description,
    openGraph: { title: `nakarat · ${title}`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `nakarat · ${title}`, description },
    // Her tur için ayrı bir URL doğuyor; arama dizinine girmesinler.
    robots: { index: false, follow: true },
  }
}

export default async function MeydanPage({ params }: Props) {
  const { kod } = await params
  return <ClientGame challenge={decodeURIComponent(kod)} />
}
