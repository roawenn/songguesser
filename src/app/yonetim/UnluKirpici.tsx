'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GORSEL_G, GORSEL_Y, SERIT } from '@/data/unlu'
import {
  BASLANGIC, acikKirpma, cizimAdimi, doldurOlcegi, kelepcele, type Konum,
} from './kirpmaMatematigi'

/**
 * Görseli 3:5 çerçeveye oturtan kırpma aracı.
 *
 * ⚠️ Şerit sınırları SABİT — beş eşit beşte bir. Küratör yalnızca fotoğrafı
 * oynatıyor. Bu bilinçli: her görsel için dört ayırıcı sürüklemek ekleme
 * hızını öldürürdü ve tutarsız bölmeler üretirdi.
 *
 * ⚠️ Matematiğin tamamı `kirpmaMatematigi.ts`'te ve orada test ediliyor;
 * burada yalnızca olaylar ve çizim var (`vitest` `.tsx` toplamıyor).
 */

const KARE_G = 300
const KARE_Y = 500
const CARPAN = GORSEL_G / KARE_G // 3

interface Props {
  gorsel: HTMLImageElement
  /** Dışa aktarılan WebP — kaydetme ebeveynde. */
  onHazir: (blob: Blob, onizlemeUrl: string) => void
  onIptal: () => void
}

export function UnluKirpici({ gorsel, onHazir, onIptal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [konum, setKonum] = useState<Konum>(() => ({
    ...BASLANGIC,
    olcek: doldurOlcegi(gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y),
  }))
  const [aciliyor, setAciliyor] = useState(1)
  const surukle = useRef<{ x: number; y: number; k: Konum } | null>(null)

  const ciz = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== KARE_G * dpr) {
      c.width = KARE_G * dpr
      c.height = KARE_Y * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, KARE_G, KARE_Y)
    ctx.fillStyle = '#0a0b0d'
    ctx.fillRect(0, 0, KARE_G, KARE_Y)

    const a = cizimAdimi(konum, gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y)
    ctx.save()
    ctx.translate(a.merkezX + a.kaydirX, a.merkezY + a.kaydirY)
    ctx.rotate(a.donus)
    ctx.scale(a.olcek, a.olcek)
    ctx.drawImage(gorsel, a.cizX, a.cizY)
    ctx.restore()
  }, [konum, gorsel])

  useEffect(() => {
    ciz()
  }, [ciz])

  const guncelle = (f: (k: Konum) => Konum) =>
    setKonum((k) => kelepcele(f(k), gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y))

  /**
   * Dışa aktarım: aynı dönüşüm, 3 kat büyük bir canvas'a.
   *
   * ⚠️ Çok büyük kaynaklarda tek adımda 900'e indirmek tırtıklı kenar üretir;
   * tarayıcının `imageSmoothingQuality: 'high'` ayarı bunu büyük ölçüde
   * karşılıyor ve ara adım eklemek görülür bir fark vermedi.
   */
  const disaAktar = () => {
    const c = document.createElement('canvas')
    c.width = GORSEL_G
    c.height = GORSEL_Y
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#0a0b0d'
    ctx.fillRect(0, 0, GORSEL_G, GORSEL_Y)

    const a = cizimAdimi(
      konum, gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y, CARPAN,
    )
    ctx.save()
    ctx.translate(a.merkezX + a.kaydirX, a.merkezY + a.kaydirY)
    ctx.rotate(a.donus)
    ctx.scale(a.olcek, a.olcek)
    ctx.drawImage(gorsel, a.cizX, a.cizY)
    ctx.restore()

    /*
     * ⚠️ `toBlob` asenkron ve `null` DÖNEBİLİR (bellek ya da desteklenmeyen
     * biçim). WebP başarısızsa JPEG'e düşülüyor; ikisi de olmazsa sessiz
     * kalmak yerine hata veriliyor.
     */
    c.toBlob(
      (b) => {
        if (b) return onHazir(b, URL.createObjectURL(b))
        c.toBlob(
          (j) => {
            if (j) onHazir(j, URL.createObjectURL(j))
            else alert('Görsel dışa aktarılamadı. Daha küçük bir dosya dene.')
          },
          'image/jpeg',
          0.85,
        )
      },
      'image/webp',
      0.82,
    )
  }

  return (
    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
      {/* --- Çerçeve --- */}
      <div>
        <div
          style={{ position: 'relative', width: KARE_G, height: KARE_Y, touchAction: 'none' }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            surukle.current = { x: e.clientX, y: e.clientY, k: konum }
          }}
          onPointerMove={(e) => {
            const s = surukle.current
            if (!s) return
            guncelle(() => ({ ...s.k, x: s.k.x + (e.clientX - s.x), y: s.k.y + (e.clientY - s.y) }))
          }}
          onPointerUp={() => {
            surukle.current = null
          }}
          onWheel={(e) => {
            guncelle((k) => ({ ...k, olcek: k.olcek * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }))
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: KARE_G,
              height: KARE_Y,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'grab',
              display: 'block',
            }}
          />

          {/* Şerit ayırıcıları — oyundaki bölmenin birebir aynısı. */}
          {Array.from({ length: SERIT - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${((i + 1) * 100) / SERIT}%`,
                height: 1,
                background: 'rgba(125,211,252,0.55)',
                pointerEvents: 'none',
              }}
            />
          ))}
          {Array.from({ length: SERIT }, (_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                position: 'absolute',
                left: 6,
                top: `calc(${(i * 100) / SERIT}% + 5px)`,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '.2em',
                color: 'rgba(125,211,252,0.75)',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                pointerEvents: 'none',
              }}
            >
              {i + 1}
              {i === 0 ? ' SAÇ' : ''}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={konum.olcek / doldurOlcegi(gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y, konum.aci)}
            onChange={(e) =>
              guncelle((k) => ({
                ...k,
                olcek:
                  Number(e.target.value) *
                  doldurOlcegi(gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y, k.aci),
              }))
            }
            style={{ flex: 1 }}
            aria-label="Yakınlaştırma"
          />
          <button type="button" onClick={() => guncelle((k) => ({ ...k, aci: (((k.aci + 270) % 360) as Konum['aci']) }))} style={KUCUK}>
            ↺
          </button>
          <button type="button" onClick={() => guncelle((k) => ({ ...k, aci: (((k.aci + 90) % 360) as Konum['aci']) }))} style={KUCUK}>
            ↻
          </button>
          <button
            type="button"
            onClick={() =>
              setKonum({
                ...BASLANGIC,
                olcek: doldurOlcegi(gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y),
              })
            }
            style={KUCUK}
          >
            sıfırla
          </button>
        </div>
      </div>

      {/* --- Oyundaki açılım önizlemesi --- */}
      <div style={{ flex: '1 1 240px', minWidth: 220 }}>
        <div style={BASLIK}>Oyunda böyle açılacak</div>
        <input
          type="range"
          min={1}
          max={SERIT}
          step={1}
          value={aciliyor}
          onChange={(e) => setAciliyor(Number(e.target.value))}
          style={{ width: '100%', marginTop: 8 }}
          aria-label="Açık şerit sayısı"
        />
        <div style={{ ...BASLIK, marginTop: 4 }}>
          {aciliyor}. adım · {aciliyor === SERIT ? 'tur biter' : `${SERIT - aciliyor} tahmin hakkı`}
        </div>

        <div
          style={{
            position: 'relative',
            width: 180,
            height: 300,
            marginTop: 10,
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            background:
              'repeating-linear-gradient(135deg, #15181c 0 6px, #101317 6px 12px)',
          }}
        >
          <canvas
            ref={(el) => {
              if (!el) return
              const ctx = el.getContext('2d')
              if (!ctx) return
              el.width = 180
              el.height = 300
              ctx.fillStyle = '#0a0b0d'
              ctx.fillRect(0, 0, 180, 300)
              const a = cizimAdimi(
                konum, gorsel.naturalWidth, gorsel.naturalHeight, KARE_G, KARE_Y, 180 / KARE_G,
              )
              ctx.save()
              ctx.translate(a.merkezX + a.kaydirX, a.merkezY + a.kaydirY)
              ctx.rotate(a.donus)
              ctx.scale(a.olcek, a.olcek)
              ctx.drawImage(gorsel, a.cizX, a.cizY)
              ctx.restore()
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: 180,
              height: 300,
              // ⚠️ Oyunla AYNI hesap (`acikKirpma`) — ikisi ayrışırsa küratörün
              // saçı 1. şeride hizalama işi boşa gider.
              clipPath: acikKirpma(aciliyor, SERIT),
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <button type="button" onClick={disaAktar} style={BIRINCIL}>
          Bu kırpmayı kullan
        </button>
        <button type="button" onClick={onIptal} style={KUCUK}>
          Vazgeç
        </button>
      </div>
    </div>
  )
}

const BASLIK = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.2em',
  textTransform: 'uppercase' as const,
  color: '#6a7075',
}

const KUCUK = {
  padding: '6px 10px',
  borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#a9aeb3',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
}

const BIRINCIL = {
  ...KUCUK,
  border: '1px solid #7dd3fc',
  color: '#7dd3fc',
  padding: '8px 14px',
}
