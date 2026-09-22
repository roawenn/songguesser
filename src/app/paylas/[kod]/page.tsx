import type { Metadata } from 'next'
import Link from 'next/link'
import { chipLabel, decodeShare, emojiLine, verdictLine } from '@/game/share'

/**
 * Paylaşılan sonuç sayfası.
 *
 * Tweet'teki bağlantı buraya gelir. Sayfanın asıl işi `generateMetadata`:
 * Twitter kartı ve görseli buradan doğar. Ziyaretçi için de bir karşılama var
 * ama asıl amaç onu oyuna sokmak — **cevap ASLA gösterilmez**, yalnızca kutular.
 */
interface Props {
  params: Promise<{ kod: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kod } = await params
  const r = decodeShare(decodeURIComponent(kod))
  if (!r) {
    return { title: 'Sonuç', robots: { index: false, follow: true } }
  }

  const title = `${chipLabel(r.chip)} · ${verdictLine(r)}`
  const description = `${emojiLine(r.marks)} — sen kaç saniyede bilirsin?`

  return {
    title,
    description,
    openGraph: { title: `tahmin.in · ${title}`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `tahmin.in · ${title}`, description },
    // Paylaşım sayfaları sonsuz sayıda üretilebilir; arama dizinine girmesinler.
    robots: { index: false, follow: true },
  }
}

export default async function PaylasPage({ params }: Props) {
  const { kod } = await params
  const r = decodeShare(decodeURIComponent(kod))

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 24,
        textAlign: 'center',
        background:
          'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 42,
          color: '#f2f4f5',
        }}
      >
        tahmin
      </div>

      {r ? (
        <>
          <div style={{ fontSize: 34, letterSpacing: '.12em' }}>{emojiLine(r.marks)}</div>
          <p style={{ margin: 0, fontSize: 18, color: '#b6bbbf' }}>
            <strong style={{ color: '#f0f2f3', fontWeight: 500 }}>{chipLabel(r.chip)}</strong>{' '}
            seçkisinde {verdictLine(r)}.
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: '#6a7075',
            }}
          >
            {r.listens} kez dinleyerek
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 17, color: '#b6bbbf' }}>
          Bu paylaşım bağlantısı okunamadı.
        </p>
      )}

      <Link
        href="/"
        style={{
          marginTop: 8,
          padding: '14px 28px',
          border: '1px solid #7dd3fc',
          borderRadius: 6,
          background: '#7dd3fc',
          color: '#0a0c0e',
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Sen de oyna
      </Link>
    </main>
  )
}
