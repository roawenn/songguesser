import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { accentHex, chipLabel, decodeShare, verdictLine, type Mark } from '@/game/share'
import { restHeaders, restUrl, supabaseReady } from '@/lib/supabase'

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


interface SarkiKarti {
  baslik: string
  sanatci: string
  yil: number
  kapak: string
}

/**
 * Paylaşım kodundaki şarkıyı çeker.
 *
 * ⚠️ Bulunamazsa `null` döner ve görsel kartsız basılır — eski 4 parçalı
 * bağlantılar ve silinmiş şarkılar bu yüzden kırılmaz.
 */
async function sarkiyiAl(id: string | undefined): Promise<SarkiKarti | null> {
  if (!id || !supabaseReady) return null
  try {
    const res = await fetch(
      restUrl(`songs?id=eq.${encodeURIComponent(id)}&select=title,artist,year,artwork&limit=1`),
      { headers: restHeaders(), next: { revalidate: 86400, tags: ['havuz'] } },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as
      { title: string; artist: string; year: number; artwork: string }[]
    const r = rows[0]
    if (!r) return null
    return {
      baslik: r.title,
      sanatci: r.artist,
      yil: r.year,
      // Story'de büyük basılıyor; 100px'lik varsayılan kapak bulanık kalırdı.
      kapak: (r.artwork ?? '').replace(/\/\d+x\d+bb\.jpg$/, '/300x300bb.jpg'),
    }
  } catch {
    return null
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params
  const r = decodeShare(decodeURIComponent(kod))

  const acc = r ? accentHex(r.chip) : '#7dd3fc'
  const marks: Mark[] = r?.marks ?? ['bos', 'bos', 'bos', 'bos', 'bos']
  const headline = r ? verdictLine(r) : 'Yarım saniyeden şarkıyı bil'
  const kart = await sarkiyiAl(r?.songId)
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

          <div style={{ display: 'flex', marginTop: 76, marginLeft: -18 }}>
            {marks.map((m, i) => (
              <div key={i} style={boxStyle(m, acc)} />
            ))}
          </div>

          {/*
            Şarkı kartı.

            ⚠️ Görselde HANGİ ŞARKI olduğu yazmıyordu; "1 saniyede bildim"
            tek başına havada kalıyor ve gören kişi neyi bildiğini
            anlamıyordu. Kart, paylaşım kodunun 5. parçasından geliyor;
            eski kodlarda ve şarkı silinmişse hiç basılmaz.
          */}
          {kart && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 72,
                padding: '26px 34px 26px 26px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.045)',
                border: '2px solid rgba(255,255,255,0.09)',
                maxWidth: 820,
              }}
            >
              {kart.kapak && (
                <img
                  src={kart.kapak}
                  width={132}
                  height={132}
                  style={{ borderRadius: 12, display: 'flex' }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginLeft: 30,
                  maxWidth: 600,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'serif',
                    fontSize: 54,
                    lineHeight: 1.15,
                    color: INK,
                  }}
                >
                  {kart.baslik}
                </div>
                <div style={{ display: 'flex', marginTop: 12, fontSize: 30, color: DIM }}>
                  {kart.sanatci} · {kart.yil}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', marginTop: 56, fontSize: 32, color: DIM }}>
            {r ? `${r.listens} kez dinledim` : '0,5 saniyeden başlar'}
          </div>
        </div>

        {/*
          Alt: yalnızca adres.

          ⚠️ Merdiven satırı ("0,5 → 1 → 2 → 5 → 10 saniye") kaldırıldı: oyunu
          bilmeyene hiçbir şey anlatmıyor, bilene de gereksiz. Görseli gören
          kişinin ihtiyacı olan tek şey adres.
        */}
        <div style={{ display: 'flex', fontSize: 40, color: INK }}>tahmin.net</div>
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
