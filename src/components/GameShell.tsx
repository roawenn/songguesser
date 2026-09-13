'use client'

import { sarkiSatiri } from '@/data/schema'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRound } from '@/hooks/useRound'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useStatsStore } from '@/store/useStatsStore'
import { anahtarYaz } from '@/lib/duelloAnahtar'
import { chipById } from '@/data/categories'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import { heardLength, MAX_WRONG, wrongCount } from '@/game/machine'
import { Backdrop } from './stage/Backdrop'
import { Cassette, type CassetteHandle } from './stage/Cassette'
import { StepIndicator } from './stage/StepIndicator'
import { Transport } from './stage/Transport'
import { GuessInput } from './guess/GuessInput'
import { GuessLog } from './guess/GuessLog'
import { ResultPanel } from './reveal/ResultPanel'
import { Header, CategoryStrip, TierStrip, Footer } from './shell/Chrome'
import {
  SettingsCard, HowToCard, StatsCard, KeyboardCard, LinksCard,
} from './shell/SidePanels'
import { useOlcek } from './shell/useOlcek'

export function GameShell() {
  const round = useRound()
  const settings = useSettingsStore()

  /**
   * ⚠️ Sistemin `prefers-reduced-motion` tercihi KASITLI olarak okunmuyor.
   *
   * Windows'ta "Animasyon efektleri" kapalı olan makinelerde Chrome bunu
   * bildiriyor ve makara dönüşü, konfeti, kart patlaması — oyunun bütün geri
   * bildirimi tek bayrakla ölüyordu. Kısıtlamak isteyen Ayarlar'dan kapatır.
   */
  const reduce = settings.reduce

  // CSS keyframe'lerini kesen kural artık bu özniteliğe bağlı (globals.css).
  useEffect(() => {
    const root = document.documentElement
    if (reduce) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reduce])

  // Sahneyi 1920 tasarımına göre orantılı küçültür.
  useOlcek()
  const router = useRouter()
  const cassette = useRef<CassetteHandle>(null)
  const [duelloKuruluyor, setDuelloKuruluyor] = useState(false)
  const [duelloHata, setDuelloHata] = useState<string | null>(null)

  /**
   * Lobiyi kur ve düello sayfasına geç.
   *
   * ⚠️ Gizli anahtar navigasyondan ÖNCE yazılır. Sonra yazılsaydı düello
   * sayfası kendi kurduğu lobiye "yabancı" olarak girip ikinci slotu kapardı.
   *
   * ⚠️ `router.push`, `window.location.href` DEĞİL. `localStorage` engelliyse
   * anahtar yalnızca `duelloAnahtar`'ın bellek yedeğinde duruyor; tam sayfa
   * yüklemesi o yedeği siler ve yukarıdaki hata aynen geri gelirdi.
   */
  async function duelloBaslat() {
    setDuelloKuruluyor(true)
    setDuelloHata(null)
    try {
      const res = await fetch('/api/duello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chip: settings.category }),
      })
      const d = (await res.json()) as { kod?: string; gizli?: string; error?: string }
      if (!res.ok || !d.kod || !d.gizli) throw new Error(d.error ?? 'Lobi kurulamadı.')
      anahtarYaz(d.kod, d.gizli)
      router.push(`/duello/${d.kod}`)
    } catch (e) {
      setDuelloHata((e as Error).message)
      setDuelloKuruluyor(false)
    }
  }

  const chip = chipById(settings.category)

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
      // yutulursa klavyeyle gezen oyuncu "Sıradaki şarkı", "Geç" ve
      // Ayarlar'daki anahtarların hiçbirini çalıştıramaz.
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
  const live = state.s === 'ready' || state.s === 'playing'

  const attempt = 'attempt' in state ? state.attempt : 0
  const steps = 'steps' in state ? state.steps : []
  const listens = 'listens' in state ? state.listens : 0
  const heardIndex = 'heardIndex' in state ? state.heardIndex : -1

  /**
   * Biten turu istatistiğe işle.
   *
   * ⚠️ Tur kimliği şarkıdan TEK BAŞINA türetilemez: `Şarkıyı değiştir` aynı
   * parçayı tekrar getirebiliyor ve o zaman ikinci tur sayılmazdı. Harcanan
   * hak ve dinleme sayısı da kimliğe giriyor.
   *
   * ⚠️ Kademe, tur BİTTİĞİ andaki değer olmalı; `next()` kazanınca kademeyi
   * yükseltiyor ve etki bir kez daha çalışıyor — deponun çift kayıt koruması
   * ikinci yazmayı yutuyor, yoksa tur bir üst kademeye yazılırdı.
   */
  const kaydet = useStatsStore((s) => s.kaydet)
  useEffect(() => {
    if (state.s !== 'won' && state.s !== 'lost') return
    kaydet(`${state.track.id}:${state.s}:${state.steps.length}:${state.listens}`, {
      won: state.s === 'won',
      tier: settings.tier,
      heardSeconds: heardLength(state.heardIndex, state.ladder),
      listens: state.listens,
    })
  }, [state, settings.tier, kaydet])

  /**
   * Ekran okuyucu için tur anlatımı.
   *
   * Yanlış tahmin, uzayan klip ve sonuç tamamen görsel olarak bildiriliyordu.
   * Metin son eylemden türediği için her adımda değişir ve yeniden okunur.
   */
  const announcement = (() => {
    if (state.s === 'won') return `Doğru! ${state.track.a} — ${state.track.t}`
    if (state.s === 'lost') return `Bilemedin. Doğrusu: ${state.track.a} — ${state.track.t}`
    if (state.s === 'arming') return 'Şarkı yükleniyor'
    if (round.stalled) return 'Bağlantı takıldı, hakkın gitmedi'
    if (state.s !== 'ready') return ''
    const last = steps[steps.length - 1]
    const head = last?.kind === 'wrong' ? 'Yanlış.' : last?.kind === 'skip' ? 'Pas geçildi.' : ''
    // Sınırı artık merdiven değil TAHMİN HAKKI koyuyor; okunan sayı o olmalı.
    const left = MAX_WRONG - wrongCount(steps)
    return `${head} Klip ${tr(round.clipLength)} saniye. ${left} tahmin hakkın kaldı.`.trim()
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
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </div>

      {/*
        ⚠️ Ölçek YALNIZCA içeriğe uygulanır, arka plana değil.
        `Backdrop` tam ekran kalmalı; ölçeklenseydi kenarlarda boş bant
        kalırdı. Detay için `useOlcek.ts`.
      */}
      <div
        className="nk-scale"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/*
         * Üst bant: marka ve kategoriler.
         *
         * Sayfanın kimliği ve ana seçimi burada; oyunla aynı blokta değil,
         * kendi bandında duruyor. Altındaki ince çizgi ikisini ayırır ama
         * kesmez — kenarlarda sönerek bitiyor.
         */}
        <div className="nk-top">
          <Header />
          <CategoryStrip category={settings.category} onCategory={settings.setCategory} />
        </div>

        {/*
          ⚠️ `paddingBottom` YOK.

          Burada `flex: 1` ile birlikte 176px'lik bir alt dolgu duruyordu.
          `flex: 1` kalan alanı zaten dolduruyor; dolgu onun ÜSTÜNE biniyor ve
          footer'ı ekranın dışına itiyordu. Sonuç: sayfa her zaman tam olarak o
          kadar kayıyordu — içerik sığsa bile kaydırma çubuğu çıkıyordu.

          Kaldırılınca sahne, üst bant ile footer arasında `.nk-center`'ın
          `margin: auto`'suyla ortalanıyor ve footer ilk ekranın dibine
          oturuyor.
        */}
        <div style={{ flex: 1, display: 'flex', width: '100%' }}>
          <div className="nk-center">
            {/* Üç sütun: ayarlar · sahne · kurallar. */}
            <div className="nk-stage-grid">
            {/* Sol sütun: yalnızca ayarlar, altında istatistik kartı. */}
            <div className="nk-side">
              <SettingsCard
                volume={settings.volume}
                reduce={settings.reduce}
                easySearch={settings.easySearch}
                onVolume={settings.setVolume}
                onReduce={settings.setReduce}
                onEasySearch={settings.setEasySearch}
              />
              <StatsCard />
            </div>

            {/*
             * Sahne dizilimi, aşağı indikçe açılan boşluklarla kuruluyor:
             * kaset ve kademe sıkı bir ikili (aynı şeyi anlatıyorlar), sonra
             * çubuk, sonra çalma kontrolleri, en altta tahmin ve çıkışlar.
             * Tek tip `gap` yerine her adımın kendi payı var — dolayısıyla
             * `gap: 0` ve öğelerde `marginTop`.
             */}
            <main
              className="nk-stage"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Cassette
                handleRef={cassette}
                categoryLabel={chip.label}
                tapeCode={round.tapeCode}
                playing={playing}
                reduce={reduce}
              />

              <div className="nk-kademe">
                <TierStrip tier={settings.tier} onTier={settings.setTier} />
              </div>

              {/*
                ⚠️ Alttaki blokla AYNI üst boşluğa sahip (55/55) ve öyle kalmalı:
                çubuk, kaset + kademe ikilisini ("ne çalıyor") oynatma
                kontrollerinden ("ne yapıyorum") ayıran aralığın tam ortasında
                duruyor. Biri değişirse diğeri de değişmeli, yoksa çubuk bir
                tarafa yapışır ve ayırıcı olmaktan çıkar.
              */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
                className="nk-cubuk"
              >
                <StepIndicator
                  attempt={attempt}
                  steps={steps}
                  playing={playing}
                  clipLength={round.clipLength}
                  heardIndex={heardIndex}
                  roundKey={'track' in state ? state.track.id : 'yok'}
                />
              </div>

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
                className="nk-kontrol"
              >
              {state.s === 'error' ? (
                <Notice tone="bad">
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
                      style={{ ...GHOST, marginTop: 14 }}
                    >
                      Tekrar dene
                    </button>
                  )}
                </Notice>
              ) : round.tooNarrow ? (
                <Notice tone="warn">
                  <p style={{ margin: 0, color: '#c9a25e', fontWeight: 500 }}>
                    Bu zorlukta yeterli şarkı yok.
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8c9297' }}>
                    Başka bir seçki ya da zorluk dene.
                  </p>
                </Notice>
              ) : state.s === 'empty' ? (
                <div style={{ color: '#8c9297', fontSize: 13.5 }}>
                  Bu seçkide şarkı bulunamadı.
                </div>
              ) : finished ? (
                <ResultPanel
                  key={state.track.id}
                  song={state.track}
                  won={state.s === 'won'}
                  chip={settings.category}
                  steps={steps}
                  listens={listens}
                  heardIndex={heardIndex}
                  ladder={state.ladder}
                  reduce={reduce}
                  onNext={round.next}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Transport
                    listens={listens}
                    clipLength={round.clipLength}
                    playing={playing}
                    disabled={!round.canPlay}
                    arming={arming}
                    stalled={round.stalled}
                    onPlay={round.play}
                  />

                  <div className="nk-giris" style={{ width: '100%' }}>
                    <GuessInput
                      index={round.index}
                      suggestions={settings.easySearch}
                      disabled={!live}
                      ambiguous={round.ambiguous}
                      onGuess={round.guess}
                      onPickAmbiguous={(song) => {
                        round.clearAmbiguity()
                        round.guessSong(song)
                      }}
                    satir={sarkiSatiri}
                      />
                  </div>

                  {/* Yapılan tahminler — üç hakkın nereye gittiği görünsün. */}
                  <GuessLog steps={steps} />

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                    className="nk-eylem"
                  >
                    {/*
                      Geç, yanındaki "Şarkıyı değiştir"den farklı olarak BİR HAK
                      YAKAR. İkisi de aynı nötr griyken yanlışlıkla pas geçmek
                      kolaydı; bu yüzden kendi rengi var — sahnenin uyarı sarısı,
                      hangi kategoride olursan ol aynı kalıyor.
                    */}
                    <button
                      type="button"
                      onClick={round.skip}
                      disabled={!live}
                      className="nk-pass"
                      style={{
                        ...GHOST,
                        border: '1px solid rgba(201,162,94,0.38)',
                        background: 'rgba(201,162,94,0.07)',
                        color: '#d5b477',
                        opacity: live ? 1 : 0.4,
                        cursor: live ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Geç{' '}
                      <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
                        {attempt < ATTEMPTS - 1 ? `→ ${tr(STEPS[attempt + 1]!)}s` : '→ son hak'}
                      </span>
                    </button>

                    {/*
                      Şarkı değiştirmek pas geçmekten farklı: hak tüketmez,
                      turu sıfırdan kurar. Tanımadığı bir parçayı beş hak
                      boyunca zorlamak zorunda kalmasın.
                    */}
                    <button
                      type="button"
                      onClick={round.reroll}
                      disabled={arming}
                      className="nk-degistir"
                      title="Aynı seçkide başka bir şarkıya geç — hakkın gitmez"
                      style={{
                        ...GHOST,
                        // ⚠️ "Geç" kehribar, bu mavi-gri: ikisi de nötr griyken
                        // yanlışlıkla hak yakmak kolaydı.
                        border: '1px solid rgba(126,164,190,0.34)',
                        background: 'rgba(126,164,190,0.07)',
                        color: '#9db9cc',
                        opacity: arming ? 0.4 : 1,
                        cursor: arming ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 13 }}>↻</span> Şarkıyı değiştir
                    </button>

                  </div>

                  {/*
                    ⚠️ Düello KENDİ SATIRINDA, diğer ikisinin altında.
                    Üçü yan yanayken tur içi iki eylem (pas geç, şarkı
                    değiştir) ile sayfadan çıkaran bir eylem aynı ağırlıkta
                    duruyordu. Alt satır, farklı bir işe geçtiğini gösteriyor.
                  */}
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
                  {/*
                    Düello: aynı seçkiden 5 şarkı, kolaydan zora, iki kişi.
                    Paylaşım düğmeleri kaldırıldığı için oyunun tek sosyal
                    çıkışı burası.
                  */}
                  <button
                    type="button"
                    onClick={() => void duelloBaslat()}
                    disabled={duelloKuruluyor}
                    className="nk-skip"
                    title="Arkadaşınla aynı 5 şarkıyı oyna"
                    style={{
                      ...GHOST,
                      borderColor: 'var(--acc)',
                      color: 'var(--acc)',
                      background: 'oklch(0.81 0.12 var(--hue) / 0.08)',
                      opacity: duelloKuruluyor ? 0.5 : 1,
                      cursor: duelloKuruluyor ? 'progress' : 'pointer',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 13 }}>⚔</span>{' '}
                    {duelloKuruluyor ? 'lobi kuruluyor…' : 'Arkadaşınla oyna'}
                  </button>
                  </div>

                  {duelloHata && (
                    <div
                      role="alert"
                      style={{
                        marginTop: 14,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        color: '#d09a9a',
                        textAlign: 'center',
                      }}
                    >
                      {duelloHata}
                    </div>
                  )}
                </div>
              )}
              </div>
            </main>

            <div className="nk-side">
              <HowToCard />
              <KeyboardCard />
              {/* Bağlantılar en altta: sütunun çıkışı, girişi değil. */}
              <LinksCard />
            </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>

      <style>{`
        .nk-skip:hover:not(:disabled) {
          border-color: var(--acc) !important;
          color: var(--acc) !important;
          background: rgba(255,255,255,0.07) !important;
        }
        .nk-degistir:hover:not(:disabled) {
          border-color: rgba(126,164,190,0.7) !important;
          color: #c3dcec !important;
          background: rgba(126,164,190,0.14) !important;
        }
        .nk-pass:hover:not(:disabled) {
          border-color: rgba(201,162,94,0.7) !important;
          color: #e8c98c !important;
          background: rgba(201,162,94,0.14) !important;
        }
      `}</style>
    </div>
  )
}

const GHOST = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 18px',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 5,
  background: 'rgba(255,255,255,0.04)',
  color: '#dfe2e4',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
}

function Notice({ tone, children }: { tone: 'bad' | 'warn'; children: React.ReactNode }) {
  const color = tone === 'bad' ? '160,90,90' : '201,162,94'
  return (
    <div
      style={{
        maxWidth: 420,
        textAlign: 'center',
        padding: 18,
        border: `1px solid rgba(${color},0.35)`,
        borderRadius: 8,
        background: `rgba(${color},0.06)`,
      }}
    >
      {children}
    </div>
  )
}
