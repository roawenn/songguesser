import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { accentHex, chipLabel, decodeShare, verdictLine, type Mark } from '@/game/share'

/**
 * Instagram Story görseli — 1080×1920.
 *
 * ⚠️ Yatay OG kartı (`../opengraph-image.tsx`) Story'ye KOYULAMAZ: 1200×630
 * dikey bir ekranda ortada minicik bir şerit olarak kalır, yazısı okunmaz.
 * Tek görseli esnetmek de çözüm değil — iki ayrı en-boy oranı, iki ayrı
 * yerleşim gerektiriyor. Ortak olan her şey (`decodeShare`, `accentHex`,
 * gömülü fontlar) paylaşılıyor, yalnızca dizilim ayrı.
 *
 * ⚠️ Satori tarayıcı DEĞİLDİR: `oklch()` bilmez (renkler hex'e çevrilir),
 * `gap` yoktur (aralıklar `margin` ile), gömülü olmayan yazı tipi yoktur ve
 * her `div` açıkça `display: flex` olmalıdır.
 */

const G = 1080
const Y = 1920
const INK = '#e6e8ea'
const DIM = '#8c9297'
const WRONG = '#a05a5a'

async function font(file: string) {
  return readFile(join(process.cwd(), 'src/assets', file))
}

function boxStyle(mark: Mark, acc: string) {
  const base = {
    width: 148,
    height: 148,
    borderRadius: 14,
    display: 'flex' as const,
    marginLeft: 18,
  }
  if (mark === 'dogru') return { ...base, background: acc }
  if (mark === 'yanlis') return { ...base, background: WRONG, opacity: 0.85 }
  if (mark === 'pas') return { ...base, background: '#2b3138' }
  return { ...base, background: '#14181c', border: '3px solid #23282e' }
}

export async function GET(_req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
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
          alignItems: 'center',
          /*
           * ⚠️ Üstte ve altta geniş pay bırakılıyor: Instagram Story arayüzü
           * (profil şeridi ve "mesaj gönder" çubuğu) görselin üst ve alt
           * bandını kapatıyor. Dar paylı bir yerleşimde adres görünmüyordu.
           */
          padding: '170px 90px 230px',
          background: '#0a0b0d',
          /*
           * ⚠️ Parlama TEPEDEN, sayfanın dışından gelmeli. Merkezi ekranın
           * içinde bir gradyan Satori'de ortada bulanık bir leke gibi çıkıyor
           * ve sonuç cümlesinin arkasını kirletiyordu.
           */
          backgroundImage: `radial-gradient(72% 26% at 50% -4%, ${acc}2e 0%, #0a0b0d 70%)`,
          color: INK,
          fontFamily: 'mono',
        }}
      >
        {/* Üst: marka ve seçki rozeti, alt alta ve ortalı. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', fontFamily: 'serif', fontSize: 104, color: INK }}>
              tahmin
            </div>
            <div
              style={{
                display: 'flex',
                width: 13,
                height: 13,
                borderRadius: 7,
                background: acc,
                marginLeft: 20,
                marginTop: 26,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 46,
              fontSize: 30,
              letterSpacing: 6,
              color: acc,
              border: `3px solid ${acc}55`,
              borderRadius: 10,
              padding: '18px 32px',
            }}
          >
            {label.toLocaleUpperCase('tr-TR')}
          </div>
        </div>

        {/* Orta: sonuç cümlesi ve beş kutu. */}
        <div
          style={{
            // Kalan boşluğu kaplayıp sonucu tam ortalar.
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'serif',
              fontSize: 124,
              lineHeight: 1.08,
              textAlign: 'center',
              color: r?.won ? acc : INK,
            }}
          >
            {headline}
          </div>

          <div style={{ display: 'flex', marginTop: 86, marginLeft: -18 }}>
            {marks.map((m, i) => (
              <div key={i} style={boxStyle(m, acc)} />
            ))}
          </div>

          <div style={{ display: 'flex', marginTop: 60, fontSize: 32, color: DIM }}>
            {r ? `${r.listens} kez dinledim` : '0,5 saniyeden başlar'}
          </div>
        </div>

        {/* Alt: merdiven ve adres. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 30, color: DIM }}>
            0,5 → 1 → 2 → 5 → 10 saniye
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 38, color: INK }}>
            tahmin.net
          </div>
        </div>
      </div>
    ),
    {
      width: G,
      height: Y,
      fonts: [
        { name: 'serif', data: serif, style: 'normal', weight: 400 },
        { name: 'mono', data: mono, style: 'normal', weight: 400 },
      ],
    },
  )
}
