'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRound } from '@/hooks/useRound'
import { useSettingsStore } from '@/store/useSettingsStore'
import { chipById, TIER_LABELS } from '@/data/categories'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import { Backdrop } from './stage/Backdrop'
import { Cassette, type CassetteHandle } from './stage/Cassette'
import { StepIndicator } from './stage/StepIndicator'
import { Transport } from './stage/Transport'
import { GuessInput } from './guess/GuessInput'
import { ResultPanel } from './reveal/ResultPanel'
import { Header, ControlStrip, Footer } from './shell/Chrome'
import { Sheet, type SheetTab } from './shell/Sheet'

export function GameShell() {
  const round = useRound()
  const settings = useSettingsStore()

  /**
   * ⚠️ Sistemin `prefers-reduced-motion` tercihi KASITLI olarak okunmuyor.
   *
   * Windows'ta "Animasyon efektleri" kapalı olan makinelerde Chrome bu tercihi
   * bildiriyor ve makara dönüşü, konfeti, kart patlaması — kısacası oyunun
   * bütün geri bildirimi tek bayrakla ölüyordu. Kısıtlamak isteyen Ayarlar'dan
   * kapatır; karar oyuncunun.
   */
  const reduce = settings.reduce

  // CSS keyframe'lerini kesen kural artık bu özniteliğe bağlı (globals.css).
  useEffect(() => {
    const root = document.documentElement
    if (reduce) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reduce])

  const [sheet, setSheet] = useState<SheetTab | null>(null)
  const cassette = useRef<CassetteHandle>(null)

  const chip = chipById(settings.category)
  const tierLabel = TIER_LABELS[settings.tier]

  // Yanlış tahminde kaseti sarsan geri çağrıyı kaydet.
  const { onWrong } = round
  useEffect(() => {
    onWrong(() => cassette.current?.shake())
  }, [onWrong])

  // Klavye: Boşluk çal.
  const { play } = round
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return
      // ⚠️ Boşluk, odaktaki düğmeyi tetiklemenin standart yolu. Burada
      // yutulursa klavyeyle gezen oyuncu "Sıradaki şarkı", "Geç" ve Ayarlar'daki
      // anahtarların hiçbirini çalıştıramaz.
      if (t?.closest('button, a, [role="switch"], [role="slider"], [contenteditable]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        play()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [play])

  const { state } = round
  const playing = state.s === 'playing'
  const arming = state.s === 'arming' || state.s === 'booting'
  const finished = state.s === 'won' || state.s === 'lost'
  const inRound = state.s === 'ready' || state.s === 'playing'

  const closeSheet = useCallback(() => setSheet(null), [])

  const attempt = 'attempt' in state ? state.attempt : 0
  const steps = 'steps' in state ? state.steps : []

  /**
   * Ekran okuyucu için tur anlatımı.
   *
   * Yanlış tahmin, uzayan klip ve sonuç tamamen görsel olarak bildiriliyordu;
   * projede tek bir `aria-live` yoktu. Metin son adımdan türetiliyor, yani her
   * eylemden sonra değişiyor ve yeniden okunuyor.
   */
  const announcement = (() => {
    if (state.s === 'won') return `Doğru! ${state.track.a} — ${state.track.t}`
    if (state.s === 'lost') return `Bilemedin. Doğrusu: ${state.track.a} — ${state.track.t}`
    if (state.s === 'arming') return 'Şarkı yükleniyor'
    if (round.stalled) return 'Bağlantı takıldı, hakkın gitmedi'
    if (state.s !== 'ready') return ''
    const last = steps[steps.length - 1]
    const left = ATTEMPTS - attempt
    const head =
      last?.kind === 'wrong'
        ? 'Yanlış.'
        : last?.kind === 'skip'
          ? 'Pas geçildi.'
          : last?.kind === 'play'
            ? 'Klip bitti.'
            : ''
    if (!round.canPlay) return `${head} Dinleme hakkın bitti, son tahminin.`
    return `${head} ${left} adım kaldı. Sıradaki klip ${tr(round.clipLength)} saniye.`.trim()
  })()

  return (
    <div
      className="themed"
      style={{
        // Sahnenin tek değişkeni: kategori tonu.
        ['--hue' as string]: String(chip.hue),
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
        color: '#e6e8ea',
      }}
    >
      <Backdrop reduce={reduce} />

      {/* Görünmez ama duyulur: turun gidişatını ekran okuyucuya bildirir. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Header onMenu={() => setSheet((s) => (s ? null : 'how'))} />

        <ControlStrip
          category={settings.category}
          tier={settings.tier}
          onCategory={settings.setCategory}
          onTier={settings.setTier}
        />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 26,
            padding: '18px 20px 60px',
            width: '100%',
            maxWidth: 640,
            margin: '0 auto',
          }}
        >
          <Cassette
            handleRef={cassette}
            categoryLabel={chip.label}
            tapeCode={round.tapeCode}
            playing={playing}
            reduce={reduce}
          />

          <StepIndicator
            attempt={attempt}
            steps={steps}
            playing={playing}
            clipLength={round.clipLength}
            roundKey={'track' in state ? state.track.id : 'yok'}
          />

          {state.s === 'error' ? (
            <div
              style={{
                maxWidth: 420,
                textAlign: 'center',
                padding: 18,
                border: '1px solid rgba(160,90,90,0.35)',
                borderRadius: 8,
                background: 'rgba(160,90,90,0.06)',
              }}
            >
              <p style={{ margin: 0, color: '#d09a9a', fontWeight: 500 }}>
                {state.reason === 'pool'
                  ? 'Şarkı listesi yüklenemedi.'
                  : state.reason === 'audio'
                    ? 'Tarayıcın bu sesi çalamıyor.'
                    : 'Şarkı yüklenemedi.'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8c9297' }}>
                {state.reason === 'audio'
                  ? 'Güncel bir tarayıcıyla dene.'
                  : 'Bağlantını kontrol edip tekrar dene.'}
              </p>
              {state.reason !== 'audio' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="nk-skip"
                  style={{
                    marginTop: 14,
                    padding: '10px 18px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 5,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#dfe2e4',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Tekrar dene
                </button>
              )}
            </div>
          ) : round.tooNarrow ? (
            <div
              style={{
                maxWidth: 420,
                textAlign: 'center',
                padding: 18,
                border: '1px solid rgba(201,162,94,0.3)',
                borderRadius: 8,
                background: 'rgba(201,162,94,0.06)',
              }}
            >
              <p style={{ margin: 0, color: '#c9a25e', fontWeight: 500 }}>
                Bu zorlukta yeterli şarkı yok.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8c9297' }}>
                Başka bir seçki ya da zorluk dene.
              </p>
            </div>
          ) : state.s === 'empty' ? (
            <div style={{ color: '#8c9297', fontSize: 13.5 }}>
              Bu seçkide şarkı bulunamadı.
            </div>
          ) : finished ? (
            <ResultPanel
              key={state.track.id}
              song={state.track}
              won={state.s === 'won'}
              steps={steps}
              categoryLabel={chip.label}
              reduce={reduce}
              onNext={round.next}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 22,
                width: '100%',
              }}
            >
              <Transport
                attempt={attempt}
                clipLength={round.clipLength}
                playing={playing}
                disabled={!round.canPlay || playing}
                arming={arming}
                stalled={round.stalled}
                onPlay={round.play}
              />

              <GuessInput
                index={round.index}
                suggestions={settings.easySearch}
                disabled={!inRound}
                ambiguous={round.ambiguous}
                onGuess={round.guess}
                onPickAmbiguous={(song) => {
                  round.clearAmbiguity()
                  round.guessSong(song)
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <button
                  type="button"
                  onClick={round.skip}
                  disabled={!inRound}
                  className="nk-skip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '12px 20px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 5,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#dfe2e4',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    opacity: inRound ? 1 : 0.4,
                    cursor: inRound ? 'pointer' : 'not-allowed',
                  }}
                >
                  Geç <span style={{ fontSize: 14 }}>→</span>
                </button>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#4e5459',
                  }}
                >
                  {attempt >= ATTEMPTS - 1
                    ? 'son hak'
                    : `sonraki: ${tr(STEPS[attempt + 1]!)}s`}
                </span>
              </div>
            </div>
          )}
        </main>

        <Footer
          categoryLabel={chip.label}
          tierLabel={tierLabel}
          onHow={() => setSheet('how')}
        />
      </div>

      {sheet && (
        <Sheet
          tab={sheet}
          volume={settings.volume}
          reduce={settings.reduce}
          easySearch={settings.easySearch}
          onTab={setSheet}
          onVolume={settings.setVolume}
          onReduce={settings.setReduce}
          onEasySearch={settings.setEasySearch}
          onClose={closeSheet}
        />
      )}

      <style>{`
        .nk-skip:hover:not(:disabled) {
          border-color: var(--acc) !important;
          color: var(--acc) !important;
          background: rgba(255,255,255,0.07) !important;
        }
      `}</style>
    </div>
  )
}
