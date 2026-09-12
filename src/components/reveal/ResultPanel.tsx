'use client'

import { useRef } from 'react'
import type { Song } from '@/data/schema'
import { artworkAt } from '@/data/schema'
import { ATTEMPTS, tr } from '@/game/ladder'
import { heardLength, type Step } from '@/game/machine'
import type { ChipId } from '@/data/categories'
import { chipLabel, marksOf, type Mark } from '@/game/share'
import { Confetti } from './Confetti'

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

/**
 * Ne kadar dinleyerek bildiğine göre kutlama metni.
 *
 * Ölçü adım sayısı değil, DUYULAN SÜRE: iki yanlış tahminden sonra yarım
 * saniyeyle bilmek hâlâ yarım saniyelik bir iştir. Hiç dinlemeden bilmek ise
 * en tepede.
 */
function praise(heard: number): { headline: string; rank: string } {
  switch (heard) {
    case 0:
      return { headline: 'Dinlemeden bildin', rank: 'telepati' }
    case 0.5:
      return { headline: 'Yarım saniyede bildin', rank: 'efsane kulak' }
    case 1:
      return { headline: 'Bir saniyede bildin', rank: 'keskin kulak' }
    case 2:
      return { headline: 'İki saniyede bildin', rank: 'iyi iş' }
    case 5:
      return { headline: 'Beş saniyede bildin', rank: 'tamamdır' }
    default:
      return { headline: 'Son anda yakaladın', rank: 'kıl payı' }
  }
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
  const cardRef = useRef<HTMLDivElement>(null)
  const grid = marksOf(steps, won)
  const heardSeconds = heardLength(heardIndex, ladder)
  const { headline, rank } = praise(heardSeconds)
  const categoryLabel = chipLabel(chip)

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
        style={{
          position: 'relative',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
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
                ? 'nk-burst .52s cubic-bezier(.22,1.2,.36,1) both, nk-glow 1.4s ease-out both'
                : 'nk-rise .4s ease both',
        }}
      >
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
        <img
          src={artworkAt(song.ar, 300)}
          alt=""
          width={96}
          height={96}
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
          {won ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 11,
                  flexWrap: 'wrap',
                  animation: reduce
                    ? undefined
                    : 'nk-pop .5s cubic-bezier(.34,1.56,.64,1) both',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16.5,
                    letterSpacing: '.01em',
                    color: 'var(--acc)',
                    textShadow: '0 0 22px var(--accSoft)',
                  }}
                >
                  {headline}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '.2em',
                    textTransform: 'uppercase',
                    color: '#6a7075',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rank}
                </span>
              </div>
            </>
          ) : (
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
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 27,
              lineHeight: 1.15,
              marginTop: 7,
              color: '#f1f3f4',
              animation: anim(0.08),
            }}
          >
            {song.t}
          </div>
          <div
            style={{ fontSize: 14, color: '#8c9297', marginTop: 3, animation: anim(0.14) }}
          >
            {song.a} · {song.y}
          </div>

          {/* Hangi kulvarda ve kaçıncı denemede — sayılar burada. */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 10,
              flexWrap: 'wrap',
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
                }}
              >
                {tr(heardSeconds)} sn kulvarı
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
              }}
            >
              {listens === 0 ? 'hiç dinlemedin' : `${listens} kez dinledin`}
            </span>
          </div>
        </div>
      </div>

      {/*
        Sonuç şeridi. Paylaşım düğmeleri kaldırıldı — Twitter kutusu sahnenin
        diline oturmuyordu ve URL tabanlı meydan okuma yerini gerçek düello
        moduna bırakıyor.
      */}
      <div style={{ display: 'flex', animation: anim(0.26) }}>
        <MarkRow marks={grid} reduce={reduce} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          animation: anim(0.32),
        }}
      >
        <button
          type="button"
          onClick={onNext}
          autoFocus
          className="nk-next"
          style={{
            padding: '14px 26px',
            border: '1px solid var(--acc)',
            borderRadius: 5,
            background: 'var(--acc)',
            color: '#0a0c0e',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Sıradaki şarkı
        </button>
        {/* Apple ToS: parçaya doğrudan mağaza bağlantısı. */}
        <a
          href={song.u}
          target="_blank"
          rel="noreferrer"
          className="nk-ghost"
          style={{
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            letterSpacing: '.08em',
            color: '#b9bec2',
          }}
        >
          {/* textTransform yok: lang="tr" "MUSIC"i "MUSİC" yapardı. */}
          APPLE MUSIC&apos;TE DİNLE
        </a>
        <a
          href={`https://open.spotify.com/search/${encodeURIComponent(`${song.a} ${song.t}`)}`}
          target="_blank"
          rel="noreferrer"
          className="nk-ghost"
          style={{
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            letterSpacing: '.08em',
            color: '#b9bec2',
          }}
        >
          SPOTIFY&apos;DA ARA
        </a>
      </div>

      <style>{`
        .nk-ghost:hover { border-color: var(--acc) !important; color: var(--acc) !important; }
        .nk-next:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  )
}
