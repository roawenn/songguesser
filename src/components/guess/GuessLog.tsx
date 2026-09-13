'use client'

import { MAX_WRONG, wrongCount, type Step } from '@/game/machine'

/**
 * Turda yapılmış yanlış tahminler ve kalan hak.
 *
 * ⚠️ Yalnızca YANLIŞ TAHMİNLER listelenir, paslar değil. Sayaç üç tahmin
 * hakkını gösteriyor; pas geçmek bu haktan yemiyor (merdiveni ilerletiyor),
 * dolayısıyla pasları aynı listeye koymak sayacı yalan söyler hâle getirirdi.
 *
 * ⚠️ Liste, oyuncunun YAZDIĞI ham metni gösterir — normalize edilmiş hâlini
 * değil. "Gulpembe" yazdıysa "gülpembe" değil "Gulpembe" görür; aksi hâlde
 * kendi yazdığını tanıyamaz ve aynı şarkıyı tekrar denemesi kolaylaşır.
 */
export function GuessLog({ steps }: { steps: readonly Step[] }) {
  const yanlislar = steps.filter((s) => s.kind === 'wrong')
  if (yanlislar.length === 0) return null

  const kalan = MAX_WRONG - wrongCount(steps)

  return (
    <div
      style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}
      aria-label="Yanlış tahminlerin"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: '#5c6267',
        }}
      >
        <span>Tahminlerin</span>
        <span style={{ color: kalan === 0 ? '#c08a8a' : '#5c6267' }}>
          {kalan} hak kaldı
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: '8px 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {yanlislar.map((s, i) => (
          <li
            key={`${i}-${s.text}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: '#8d9398',
            }}
          >
            <span aria-hidden style={{ color: '#a05a5a', flex: 'none' }}>
              ✕
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {s.text}
            </span>
            {/* Sanatçıyı tutturmak yakınlığı gösterir; oyuncuya ipucu olsun. */}
            {s.sameArtist && (
              <span
                style={{
                  flex: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#6a7075',
                }}
              >
                sanatçı doğru
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
