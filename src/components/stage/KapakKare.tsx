'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { artworkAt } from '@/data/schema'
import { KAPAK_ADIM, KAPAK_BOYUTLARI } from '@/data/kapak'
import { sars as sarsit } from './sars'

/**
 * Albüm kapağı — pikselden netleşir.
 *
 * ⚠️ Pikselleştirme TARAYICIDA YAPILMIYOR. Her adımda Apple'dan o boyutta
 * gerçek bir görsel isteniyor (8×8, 16×16…) ve CSS `image-rendering: pixelated`
 * ile büyütülüyor. Tam boyutlu kapağı indirip bulanıklaştırmak, ilk adımda
 * cevabı tarayıcıya teslim etmek olurdu.
 *
 * ⚠️ `<img>`'e `key={boyut}`: adres değişince tarayıcı eski kareyi yeni görsel
 * inene kadar bırakabiliyor; anahtar yeni öğe kurduruyor ve geçiş animasyonu
 * her adımda yeniden oynuyor.
 *
 * ⚠️ Azami genişlik CSS'te (`.nk-kapak-kare`): masaüstü ve telefon farklı.
 */

export interface KapakKareHandle {
  /** Yanlış tahminde kısa bir sarsıntı. */
  sars: () => void
}

interface Props {
  /** Kapak adresi (Apple, herhangi bir boyut) — boyut burada seçilir. */
  ar: string
  /**
   * Adımın HAZIR adresi — verilirse `ar`'dan boyut türetilmez.
   *
   * ⚠️ Günlük modda kapak adresi tarayıcıya hiç gelmiyor (`8x8bb` elle
   * `600x600bb` yapılabilirdi); sunucu o adımın görselini imzalı adresle veriyor.
   */
  url?: string
  onYuklendi?: () => void
  onHata?: () => void
  adim: number
  /** Tur bittiğinde tam kapak gösterilir. */
  bitti: boolean
  reduce: boolean
}

export const KapakKare = forwardRef<KapakKareHandle, Props>(function KapakKare(
  { ar, url: hazirUrl, adim, bitti, reduce, onYuklendi, onHata },
  ref,
) {
  const kutu = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({ sars: () => sarsit(kutu.current, reduce) }))

  const gorunur = bitti ? KAPAK_ADIM : Math.max(1, Math.min(adim, KAPAK_ADIM))
  const boyut = KAPAK_BOYUTLARI[gorunur - 1] ?? 600
  const url = hazirUrl ?? artworkAt(ar, boyut)
  const net = boyut === KAPAK_BOYUTLARI[KAPAK_BOYUTLARI.length - 1]

  /*
   * YÜKLENİYOR DURUMU. Apple'dan ilk kapak ~750 ms sürebiliyor (ölçüldü) ve bu
   * sürede kutu boş kalıyordu. İki önlem:
   *   · adres yokken ya da henüz inmediyse ortada dönen gösterge (250 ms
   *     gecikmeli — önbellekten gelen görselde hiç görünmesin),
   *   · netlik adımı değişince ÖNCEKİ kare yenisi inene kadar yerinde kalır;
   *     eskiden `key` değişince kutu bir an boşalıyordu.
   */
  const [yuklenen, setYuklenen] = useState<string | null>(null)
  const [hatali, setHatali] = useState<string | null>(null)
  const yukleniyor = !url || (url !== yuklenen && url !== hatali)

  return (
    <div
      ref={kutu}
      className="nk-kapak-kare"
      style={{
        position: 'relative',
        width: '100%',
        // ⚠️ Oran SABİT: görsel inmeden de kutu yerini koruyor, düzen kaymıyor.
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'repeating-linear-gradient(135deg, #15181c 0 7px, #0f1216 7px 14px)',
      }}
    >
      {yuklenen && yuklenen !== url && (
        // Önceki adımın karesi — yenisi inene kadar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={yuklenen}
          alt=""
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
        />
      )}

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          decoding="async"
          onLoad={() => {
            setYuklenen(url)
            onYuklendi?.()
          }}
          onError={() => {
            setHatali(url)
            onHata?.()
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: net ? 'auto' : 'pixelated',
            // İnene kadar görünmez; animasyon inince başlar (stil o an ekleniyor).
            opacity: url === yuklenen ? 1 : 0,
            animation: reduce || url !== yuklenen ? undefined : 'nk-kapak-gelis .35s ease both',
          }}
        />
      )}

      {yukleniyor &&
        (yuklenen ? (
          // Önceki kare görünürken ortadaki yazı piksellerin üstünde okunmuyordu: köşede küçük halka.
          <span role="status" aria-label="Kapak netleşiyor" className="nk-kapak-halka nk-kapak-halka-kose" />
        ) : (
          <div role="status" aria-label="Kapak yükleniyor" className="nk-kapak-yukleniyor">
            <span className="nk-kapak-halka" aria-hidden />
            <span className="nk-kapak-yazi">kapak yükleniyor</span>
          </div>
        ))}

      {/* Kaçıncı netlikte olunduğu — "8×8" oyunun ne istediğini söylüyor. */}
      {!bitti && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            padding: '3px 7px',
            borderRadius: 4,
            background: 'rgba(10,11,13,0.72)',
            color: '#b6bbbf',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.08em',
          }}
        >
          {net ? 'net' : `${boyut}×${boyut}`}
        </span>
      )}

      <style>{`
        .nk-kapak-yukleniyor {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px; pointer-events: none;
          opacity: 0; animation: nk-kapak-yukleniyor-belir .25s ease 250ms forwards;
        }
        @keyframes nk-kapak-yukleniyor-belir { to { opacity: 1 } }
        .nk-kapak-halka {
          width: 30px; height: 30px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.10); border-top-color: var(--acc);
          animation: nk-spin .8s linear infinite;
        }
        .nk-kapak-halka-kose {
          position: absolute; top: 9px; right: 9px; width: 16px; height: 16px;
          background: rgba(10,11,13,0.6); opacity: 0;
          animation: nk-spin .8s linear infinite, nk-kapak-yukleniyor-belir .25s ease 250ms forwards;
        }
        .nk-kapak-yazi {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: .18em;
          text-transform: uppercase; color: #6a7075;
        }
      `}</style>
    </div>
  )
})
