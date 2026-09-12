import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { accentHex, chipLabel, decodeShare, verdictLine, type Mark } from '@/game/share'

/**
 * Tweet'te görünen kart görseli.
 *
 * ⚠️ Satori (bunu üreten motor) tarayıcı DEĞİLDİR:
 *   - `oklch()` bilinmez → renkler `accentHex` ile hex'e çevrilir
 *   - `gap` yoktur → aralıklar `margin` ile kurulur
 *   - gömülü olmayan yazı tipi yoktur → fontlar diskten okunup veriliyor
 *   - her `div` açıkça `display: flex` olmalı, yoksa çocukları üst üste biner
 */
export const alt = 'Nakarat sonucu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#e6e8ea'
const DIM = '#8c9297'
const WRONG = '#a05a5a'

async function font(file: string) {
  return readFile(join(process.cwd(), 'src/assets', file))
}

/** Kutu rengi — paylaşım şeridindeki emojilerin görsel karşılığı. */
function boxStyle(mark: Mark, acc: string) {
  const base = {
    width: 118,
    height: 118,
    borderRadius: 10,
    display: 'flex' as const,
    marginLeft: 14,
  }
  if (mark === 'dogru') return { ...base, background: acc }
  if (mark === 'yanlis') return { ...base, background: WRONG, opacity: 0.85 }
  if (mark === 'pas') return { ...base, background: '#2b3138' }
  return { ...base, background: '#14181c', border: '2px solid #23282e' }
}

export default async function ShareImage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params
  const r = decodeShare(decodeURIComponent(kod))

  const acc = r ? accentHex(r.chip) : '#7dd3fc'
  const marks: Mark[] = r?.marks ?? ['bos', 'bos', 'bos', 'bos', 'bos']
  const headline = r ? verdictLine(r) : 'Yarım saniyeden şarkıyı bil'
  const label = r ? chipLabel(r.chip) : 'Türkçe şarkı tahmin oyunu'

  const [serif, mono] = await Promise.all([
    font('InstrumentSerif-Italic.ttf'),
    font('IBMPlexMono-Regular.ttf'),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '58px 70px',
          background: '#0a0b0d',
          backgroundImage: `radial-gradient(90% 70% at 12% -20%, ${acc}22 0%, #0a0b0d 60%)`,
          color: INK,
          fontFamily: 'mono',
        }}
      >
        {/* Üst şerit: solda marka, sağda seçki. */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontFamily: 'serif', fontSize: 60, color: INK }}>
              nakarat
            </div>
            <div
              style={{
                display: 'flex',
                width: 8,
                height: 8,
                borderRadius: 4,
                background: acc,
                marginLeft: 18,
                marginTop: 10,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 4,
              color: acc,
              border: `2px solid ${acc}55`,
              borderRadius: 8,
              padding: '12px 22px',
            }}
          >
            {label.toLocaleUpperCase('tr-TR')}
          </div>
        </div>

        {/* Orta: sonuç cümlesi ve kutular. */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'serif',
              fontSize: 92,
              lineHeight: 1.05,
              color: r?.won ? acc : INK,
            }}
          >
            {headline}
          </div>

          <div style={{ display: 'flex', marginTop: 44, marginLeft: -14 }}>
            {marks.map((m, i) => (
              <div key={i} style={boxStyle(m, acc)} />
            ))}
          </div>
        </div>

        {/* Alt şerit: merdiven ve dinleme sayısı. */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            color: DIM,
          }}
        >
          <div style={{ display: 'flex' }}>0,5 → 1 → 2 → 5 → 10 saniye</div>
          <div style={{ display: 'flex' }}>
            {r ? `${r.listens} kez dinledim` : 'nakarat.app'}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'serif', data: serif, style: 'normal', weight: 400 },
        { name: 'mono', data: mono, style: 'normal', weight: 400 },
      ],
    },
  )
}
