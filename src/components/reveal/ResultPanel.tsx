'use client'

import { useRef } from 'react'
import type { Song } from '@/data/schema'
import { artworkAt } from '@/data/schema'
import { ATTEMPTS, tr } from '@/game/ladder'
import { heardLength, type Step } from '@/game/machine'
import type { ChipId } from '@/data/categories'
import { encodeShare, marksOf, type Mark } from '@/game/share'
import { isabet } from '@/game/stats'
import { useShallow } from 'zustand/react/shallow'
import { useStatsStore } from '@/store/useStatsStore'
import { olay } from '@/lib/olay'
import { Confetti } from './Confetti'
import { useSonrakiKilit } from './sonrakiKilit'
import { useHesap } from '@/hooks/useHesap'

interface Props {
  song: Song
  won: boolean
  chip: ChipId
  steps: Step[]
  listens: number
  heardIndex: number
  ladder: number[]
  reduce: boolean
  onNext: () => void
}

/** Beş kutuluk sonuç şeridi. */
function MarkRow({ marks, reduce }: { marks: Mark[]; reduce: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {marks.map((m, i) => (
        <div
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: 3,
            border: `1px solid ${
              m === 'bos' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.14)'
            }`,
            background:
              m === 'dogru'
                ? 'var(--acc)'
                : m === 'yanlis'
                  ? 'rgba(160,90,90,0.45)'
                  : m === 'pas'
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
            // Kutular sırayla belirsin.
            animation: reduce
              ? undefined
              : `nk-pop .34s cubic-bezier(.34,1.56,.64,1) ${0.3 + i * 0.05}s both`,
          }}
        />
      ))}
    </div>
  )
}


/**
 * Yalnızca simge taşıyan dinleme bağlantısı.
 *
 * ⚠️ Metin yerine simge: "APPLE MUSIC'TE DİNLE" ve "SPOTIFY'DA ARA"
 * yan yana durunca birincil eylemle ("Sıradaki şarkı") aynı görsel ağırlığa
 * sahip oluyor ve göz hangisine basacağını seçemiyordu. Erişilebilirlik
 * `aria-label` ve `title` ile korunuyor.
 */
function SimgeBaglanti({
  href,
  label,
  simge,
}: {
  href: string
  label: string
  simge: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="nk-simge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 5,
        color: '#b9bec2',
        flex: 'none',
      }}
    >
      {simge}
    </a>
  )
}

/** Apple Music — elma silueti. */
function AppleSimge() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.3 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.1-1.5 2.7-.4 6.6 1.1 8.8.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4-.1 0-2.2-.9-2.2-3.5zM14.2 6.3c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z" />
    </svg>
  )
}

/** Spotify — üç dalga. */
function SpotifySimge() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.3-.5 10 1.1.3.2.4.6.2.9zm1.2-2.8a.8.8 0 0 1-1 .3c-2.7-1.7-6.9-2.2-10.1-1.2a.8.8 0 1 1-.4-1.5c3.7-1.1 8.3-.6 11.4 1.4.4.2.5.7.1 1zm.1-2.9C14.6 8.8 9.4 8.6 6.3 9.6a.9.9 0 1 1-.5-1.8c3.6-1.1 9.3-.9 13 1.3a.9.9 0 1 1-.9 1.6z" />
    </svg>
  )
}
export function ResultPanel({
  song,
  won,
  chip,
  steps,
  listens,
  heardIndex,
  ladder,
  reduce,
  onNext,
}: Props) {
  const sonraki = useSonrakiKilit(onNext)
  const cardRef = useRef<HTMLDivElement>(null)
  const grid = marksOf(steps, won)
  const heardSeconds = heardLength(heardIndex, ladder)

  // Yalnızca gösterilen üç sayaca abone: tur biterken depoya yazılan diğer
  // alanlar (ör. çift kayıt koruması) bu kartı yeniden çizdirmesin.
  const istatistik = useStatsStore(
    useShallow((s) => ({ oynanan: s.oynanan, kazanilan: s.kazanilan, seri: s.seri })),
  )
  const { kullanici } = useHesap()
  /*
   * Görsel adresi turun kendisinden türüyor; sunucuya hiçbir şey yazılmıyor.
   * Aynı kod hem yatay OG kartını hem bu dikey Story görselini besliyor.
   */
  const kare = `/paylas/${encodeShare({ chip, marks: grid, won, heardSeconds, listens, songId: song.id })}/kare`

  // Ne kadar az hak harcadıysa konfeti o kadar coşkulu.
  const intensity = won ? 1 - Math.min(steps.length, ATTEMPTS) / ATTEMPTS : 0

  const anim = (delay: number) =>
    reduce ? undefined : `nk-slide .42s cubic-bezier(.22,1,.36,1) ${delay}s both`

  return (
    <div
      style={{
        width: '100%',

        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {won && <Confetti intensity={intensity} reduce={reduce} originRef={cardRef} />}

      <div
        ref={cardRef}
        className="nk-sonuc-kart"
        style={{
          position: 'relative',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          /*
           * ⚠️ Sarmalanabilir: telefonda rozetler kendi satırına iniyor
           * (bkz. `.nk-sonuc-rozetler`, globals.css). Tek satırdayken kapak ve
           * rozetler genişliği paylaşıp metne ~30 px bırakıyordu; başlık
           * rozetlerin üstüne taşıyor, sanatçı kelime kelime kırılıyordu.
           */
          flexWrap: 'wrap',
          padding: 16,
          border: `1px solid ${won ? 'var(--acc)' : 'rgba(255,255,255,0.09)'}`,
          borderRadius: 8,
          background: won
            ? 'oklch(0.81 0.12 var(--hue) / 0.05)'
            : 'rgba(255,255,255,0.025)',
          animation:
            reduce
              ? undefined
              : won
                ? 'nk-burst .52s cubic-bezier(.22,1.2,.36,1) both'
                : 'nk-rise .4s ease both',
        }}
      >
        {/*
          Parıltı KENDİ katmanında ve gölgesi statik.
          Kartın animasyon kısayoluna `nk-glow` olarak eklenmişti; `box-shadow`
          bir boya özelliği olduğu için hem her karede Gaussian yeniden
          rasterize ediliyor hem de kartı compositor'dan düşürüp yanındaki
          `nk-burst`i de yavaşlatıyordu.
        */}
        {won && !reduce && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 8,
              boxShadow: '0 0 46px -6px var(--accSoft)',
              pointerEvents: 'none',
              animation: 'nk-parilti 1.4s ease-out both',
            }}
          />
        )}

        {/* Patlama anında dışa açılan tek halka. */}
        {won && !reduce && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius: 10,
              border: '1px solid var(--acc)',
              pointerEvents: 'none',
              animation: 'nk-ring .75s cubic-bezier(.22,1,.36,1) both',
            }}
          />
        )}
        {/*
          ⚠️ 300 değil 200: kutu 96px, yani 2× ekranda bile 192px yetiyor.
          300'lük kaynak hem gereksiz bayt hem de kod çözme işi demekti ve
          çözme tam da açılış animasyonlarının olduğu 750 ms'ye düşüyordu.
        */}
        <img
          src={artworkAt(song.ar, 200)}
          alt=""
          width={96}
          height={96}
          decoding="async"
          style={{
            width: 96,
            height: 96,
            flex: 'none',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.1)',
            objectFit: 'cover',
            animation: reduce ? undefined : 'nk-artwork .75s cubic-bezier(.22,1,.36,1) both',
          }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          {/*
            ⚠️ "Bir saniyede bildin" ve "keskin kulak" KALDIRILDI.
            İlki yanıltıcıydı — duyulan kulvarı anlatıyordu ama oyuncu onu
            geçen süre sanıyordu; ikincisi hiçbir bilgi taşımıyordu. Kaybedince
            gösterilen "bilemedin" duruyor: kazanma/kaybetme ayrımını başka
            hiçbir metin taşımıyor (kenarlık ve konfeti yalnızca destekliyor).
          */}
          {!won && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: '#8a5f5f',
              }}
            >
              bilemedin
            </div>
          )}

          <div
            className="nk-sonuc-baslik"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 27,
              lineHeight: 1.15,
              marginTop: won ? 0 : 7,
              color: '#f1f3f4',
              animation: anim(0.08),
            }}
          >
            {song.t}
          </div>
          {/* Sanatçı BİLEREK duruyor: bir şarkı tahmin oyununda gerçek bilgi. */}
          <div
            style={{ fontSize: 14, color: '#8c9297', marginTop: 3, animation: anim(0.14) }}
          >
            {song.a} · {song.y}
          </div>
        </div>

        {/* Sayılar sağ üstte (telefonda kartın altında): duyulan kulvar ve kaç kez dinlendiği. */}
        <div
          className="nk-sonuc-rozetler"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 'none',
            animation: anim(0.2),
          }}
        >
          {won && heardSeconds > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  padding: '4px 9px',
                  borderRadius: 4,
                  border: '1px solid var(--acc)',
                  background: 'oklch(0.81 0.12 var(--hue) / 0.1)',
                  color: 'var(--acc)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tr(heardSeconds)} sn
              </span>
            )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              padding: '4px 9px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8c9297',
              whiteSpace: 'nowrap',
            }}
          >
            {listens === 0 ? 'hiç dinlemedin' : `${listens} kez dinledin`}
          </span>
        </div>
      </div>

      {/*
        ⚠️ Şerit ve sayaçlar ORTALI. Sola dayalıyken kartın altında sağa
        doğru dağılıyor ve hangi sayının neye ait olduğu belirsizleşiyordu.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          animation: anim(0.26),
        }}
      >
        <MarkRow marks={grid} reduce={reduce} />

        {/*
          Kişisel sayaçlar — YALNIZCA GİRİŞLİYE. Girişsiz oyuncunun sayaçları
          hiçbir yere yazılmıyor, sayfa yenilenince sıfırlanıyor (bkz.
          `store/useStatsStore`); yarım bir sayıyı göstermek yanıltıyor.
        */}
        {kullanici && istatistik.oynanan > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: '#6d7378',
            }}
          >
            <span>%{isabet(istatistik)} isabet</span>
            <span style={{ color: '#3f4449' }}>·</span>
            <span>{istatistik.oynanan} tur</span>
            {istatistik.seri > 1 && (
              <>
                <span style={{ color: '#3f4449' }}>·</span>
                <span style={{ color: 'var(--acc)' }}>{istatistik.seri} seri</span>
              </>
            )}
          </div>
        )}
      </div>

      {/*
        ⚠️ Tek bir düğme sırası yerine HİYERARŞİ.

        Dört düğme aynı satırda eşit ağırlıktaydı ve oyuncunun neredeyse her
        zaman istediği tek şey "Sıradaki şarkı"ydı; o da diğer üçünün arasında
        kayboluyordu. Artık birincil eylem ortada, dinleme bağlantıları
        yanında yalnızca simge, paylaşım ise altında.
      */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          animation: anim(0.32),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            autoFocus
            className="nk-next"
            {...sonraki.ozellikler}
            style={{
              // ⚠️ Genişlik SABİT: metin "yükleniyor…" olunca düğme zıplamasın.
              minWidth: 186,
              padding: '14px 30px',
              border: '1px solid var(--acc)',
              borderRadius: 5,
              background: 'var(--acc)',
              color: '#0a0c0e',
              fontWeight: 600,
              fontSize: 14,
              opacity: sonraki.basildi ? 0.72 : 1,
              cursor: sonraki.basildi ? 'progress' : 'pointer',
            }}
          >
            {sonraki.basildi ? 'yükleniyor…' : 'Sıradaki şarkı'}
          </button>

          {/* Apple ToS: parçaya doğrudan mağaza bağlantısı ZORUNLU. */}
          <SimgeBaglanti
            href={song.u ?? '#'}
            label="Apple Music'te dinle"
            simge={<AppleSimge />}
          />
          <SimgeBaglanti
            href={`https://open.spotify.com/search/${encodeURIComponent(`${song.a} ${song.t}`)}`}
            label="Spotify'da ara"
            simge={<SpotifySimge />}
          />
        </div>

        {/*
          Instagram Story görseli — 1080×1920.

          ⚠️ `download` özniteliği iOS Safari'de yok sayılır ve PNG sekmede
          açılır; oradan basılı tutup kaydetmek zaten Story'ye koymanın olağan
          yolu. Blob'a çevirip zorlamak o tarayıcıda daha kırılgan olurdu.
        */}
        <a
          href={kare}
          onClick={() => olay('story_indirildi', { oyun: 'sarki' })}
          download="tahmin-net.png"
          target="_blank"
          rel="noreferrer"
          className="nk-ghost"
          style={{
            padding: '11px 18px',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.08em',
            color: '#b9bec2',
          }}
        >
          STORY GÖRSELİNİ İNDİR
        </a>
      </div>

      <style>{`
        .nk-ghost:hover { border-color: var(--acc) !important; color: var(--acc) !important; }
        .nk-simge:hover { border-color: var(--acc) !important; color: var(--acc) !important; }
        .nk-next:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  )
}
