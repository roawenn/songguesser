import { ImageResponse } from 'next/og'

/**
 * Paylaşım görseli.
 *
 * Oyunun ana yayılma kanalı paylaşım ("tahmin.net · Pop / 🟦🟦🟥🟩⬛") ama link
 * boş bir kutu olarak görünüyordu. Kasetin sahne dilini taşıyan tek bir kare
 * yeter; kategoriye göre değişmesi gerekmiyor çünkü paylaşılan URL her zaman
 * kök adres.
 *
 * ⚠️ `next/og` Satori kullanır: yalnızca flexbox, `gap` yok, `oklch()` yok.
 * Bu yüzden renkler hex ve yerleşim `margin` ile kuruluyor.
 */
export const alt = 'tahmin.net — Türkçe şarkı tahmin oyunu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ACC = '#7dd3fc'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0b0d',
          backgroundImage:
            'radial-gradient(120% 80% at 50% -10%, #1b2129 0%, #0a0b0d 55%, #07080a 100%)',
          color: '#e6e8ea',
        }}
      >
        {/* Kaset makaraları */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 86,
                height: 86,
                borderRadius: 43,
                border: `6px solid ${ACC}`,
                opacity: 0.85,
                marginLeft: i === 0 ? 0 : 78,
                display: 'flex',
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 128,
            letterSpacing: -2,
            marginTop: 44,
            display: 'flex',
          }}
        >
          tahmin
        </div>

        <div
          style={{
            fontSize: 34,
            color: '#8c9297',
            marginTop: 14,
            display: 'flex',
          }}
        >
          Yarım saniyeden şarkıyı bil
        </div>

        {/* Beş segmentli kademe çubuğu — oyunun imzası. */}
        <div style={{ display: 'flex', marginTop: 52 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 104,
                height: 12,
                borderRadius: 3,
                marginLeft: i === 0 ? 0 : 10,
                background: i < 2 ? ACC : '#20262c',
                display: 'flex',
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 24,
            color: '#5c6266',
            marginTop: 40,
            letterSpacing: 6,
            display: 'flex',
          }}
        >
          POP · RAP · ARABESK · ROCK · HALK · SANAT
        </div>
      </div>
    ),
    size,
  )
}
