'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDuello } from '@/hooks/useDuello'
import { useRound } from '@/hooks/useRound'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useStatsStore } from '@/store/useStatsStore'
import { chipById } from '@/data/categories'
import { DUELLO_SARKI } from '@/game/duel'
import { heardLength } from '@/game/machine'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import { Backdrop } from './stage/Backdrop'
import { Cassette, type CassetteHandle } from './stage/Cassette'
import { StepIndicator } from './stage/StepIndicator'
import { Transport } from './stage/Transport'
import { GuessInput } from './guess/GuessInput'

/**
 * Düello sahnesi.
 *
 * `GameShell`'in yerine geçmez, yanında durur: tek oyunculu kabuk seçki
 * şeridi, yan kartlar ve kademe seçicisiyle birlikte geliyor — düelloda
 * bunların hiçbiri anlamlı değil (şarkılar ve kademeler sabit). Yaprak
 * bileşenler (kaset, çubuk, çalma kontrolleri, tahmin kutusu) aynen
 * paylaşılıyor, kopyalanmıyor.
 */
export function DuelloShell({ kod }: { kod: string }) {
  const d = useDuello(kod)
  const settings = useSettingsStore()
  const reduce = settings.reduce

  const cassette = useRef<CassetteHandle>(null)

  /**
   * ⚠️ Dizilim yalnızca oynanabilir fazlarda verilir.
   *
   * Lobide ve geri sayımda dizilim geçilirse `useRound` şarkıyı hemen kurar ve
   * klip rakip gelmeden çalınabilir hâle gelir — düellonun "aynı anda" vaadi
   * daha başlamadan bozulur.
   *
   * ⚠️ Sunucu şarkıları adım adım açıyor (bkz. `api/duello/[kod]/route.ts`),
   * yani elimizde her zaman beş tane OLMAYABİLİR. Hazırlık ölçütü "beş geldi
   * mi" değil, "sıradaki geldi mi".
   */
  const hazir = d.songs.length > d.aktif
  /*
   * ⚠️ Tur YALNIZCA oynanırken kurulur. Bitiş ve bekleme fazlarında da dizilim
   * veriliyordu; bu, son şarkıyı boşuna yeniden kurup sesini indiriyordu.
   */
  const oynanabilir = d.faz === 'oynaniyor' && hazir
  const round = useRound(oynanabilir ? { sequence: d.songs, index: d.aktif } : undefined)

  const { onWrong } = round
  useEffect(() => {
    onWrong(() => cassette.current?.shake())
  }, [onWrong])

  /*
   * Tur bitince sonucu bir kez bildir — hem rakibe (sunucu) hem oyuncunun
   * kendi sayaçlarına.
   *
   * ⚠️ Düello turları da istatistiğe YAZILIYOR. Yazılmasaydı yalnızca
   * arkadaşıyla oynayan biri kendi kartında sonsuza kadar "0 tur" görürdü.
   * Kademe, oyuncunun kendi seçimi değil düellonun rampası olduğu için
   * ayarlardan değil ŞARKIDAN okunuyor.
   */
  const { state } = round
  const { cevapGonder } = d
  const kaydet = useStatsStore((s) => s.kaydet)
  useEffect(() => {
    if (state.s !== 'won' && state.s !== 'lost') return
    const sonuc = {
      won: state.s === 'won',
      heardSeconds: heardLength(state.heardIndex, state.ladder),
      listens: state.listens,
    }
    cevapGonder(sonuc)
    kaydet(`${state.track.id}:${state.s}:${state.steps.length}:${state.listens}`, {
      ...sonuc,
      tier: state.track.d,
    })
  }, [state, cevapGonder, kaydet])

  const chip = chipById(settings.category)

  return (
    <div
      className="themed"
      style={{
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

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '26px 20px 40px',
          gap: 22,
        }}
      >
        <Link href="/" style={{ ...M, color: '#6a7075', alignSelf: 'flex-start' }}>
          ← tahmin.net
        </Link>

        {/*
          ⚠️ Oyun dışı ekranlar (lobi, geri sayım, bekleme, bitiş, hata) DİKEY
          ORTALANIR. Hepsi sayfanın üstüne yapışıyordu ve altında bomboş bir
          ekran kalıyordu; özellikle lobide, tek işi bir kodu göstermek olan
          kart ekranın tepesinde asılı duruyordu.
        */}
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: oynanabilir ? 'flex-start' : 'center',
            gap: 22,
          }}
        >
          {d.faz === 'hata' && <Kutu tone="bad">{d.hata ?? 'Bir şeyler ters gitti.'}</Kutu>}
          {d.faz === 'yukleniyor' && <div style={{ ...M, color: '#6a7075' }}>yükleniyor…</div>}
          {d.faz === 'lobi' && <Lobi kod={kod} />}
          {d.faz === 'gerisayim' && <GeriSayim n={d.geriSayim} />}

          {(d.faz === 'oynaniyor' || d.faz === 'bekleme' || d.faz === 'bitti') && (
            <>
              <Skor d={d} />

              {d.faz === 'bitti' ? (
                <Bitis d={d} />
              ) : d.faz === 'bekleme' ? (
                <SonBekleme d={d} />
              ) : round.state.s === 'error' ? (
                <CalinamadiKutusu d={d} />
              ) : hazir ? (
                <Sahne round={round} cassette={cassette} reduce={reduce} d={d} />
              ) : (
                <div style={{ ...M, color: '#6a7075' }}>şarkı hazırlanıyor…</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type Round = ReturnType<typeof useRound>
type Duello = ReturnType<typeof useDuello>

function Sahne({
  round, cassette, reduce, d,
}: {
  round: Round
  cassette: React.RefObject<CassetteHandle | null>
  reduce: boolean
  d: Duello
}) {
  const easySearch = useSettingsStore((x) => x.easySearch)
  const { state } = round
  const playing = state.s === 'playing'
  const arming = state.s === 'arming' || state.s === 'booting'
  const live = state.s === 'ready' || state.s === 'playing'
  const attempt = 'attempt' in state ? state.attempt : 0
  const steps = 'steps' in state ? state.steps : []
  const listens = 'listens' in state ? state.listens : 0
  const heardIndex = 'heardIndex' in state ? state.heardIndex : -1

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 560,
      }}
    >
      <Cassette
        handleRef={cassette}
        categoryLabel={`${d.aktif + 1}. şarkı`}
        tapeCode={`NK-${String(d.aktif + 1).padStart(3, '0')}`}
        playing={playing}
        reduce={reduce}
      />

      <div style={{ marginTop: 36, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <StepIndicator
          attempt={attempt}
          steps={steps}
          playing={playing}
          clipLength={round.clipLength}
          heardIndex={heardIndex}
          roundKey={'track' in state ? state.track.id : 'yok'}
        />
      </div>

      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <Transport
          listens={listens}
          clipLength={round.clipLength}
          playing={playing}
          disabled={!round.canPlay}
          arming={arming}
          stalled={round.stalled}
          onPlay={round.play}
        />

        <div style={{ marginTop: 40, width: '100%' }}>
          <GuessInput
            index={round.index}
            /*
             * ⚠️ `getState()` render sırasında ABONELİKSİZ okunuyordu: değer
             * ilk render'da doğru geliyor ama sonra hiç güncellenmiyordu, yani
             * "Kolay arama" anahtarının düello ekranında hiçbir etkisi yoktu.
             */
            suggestions={easySearch}
            disabled={!live}
            ambiguous={round.ambiguous}
            onGuess={round.guess}
            onPickAmbiguous={(song) => {
              round.clearAmbiguity()
              round.guessSong(song)
            }}
          />
        </div>

        <button
          type="button"
          onClick={round.skip}
          disabled={!live}
          style={{
            marginTop: 36,
            ...M,
            padding: '11px 18px',
            border: '1px solid rgba(201,162,94,0.38)',
            background: 'rgba(201,162,94,0.07)',
            color: '#d5b477',
            borderRadius: 5,
            opacity: live ? 1 : 0.4,
          }}
        >
          Geç{' '}
          <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
            {attempt < ATTEMPTS - 1 ? `→ ${tr(STEPS[attempt + 1]!)}s` : '→ son hak'}
          </span>
        </button>
      </div>
    </main>
  )
}

/**
 * Şarkı hiç kurulamadıysa çıkış kapısı.
 *
 * ⚠️ Bu ekran OLMADAN oyuncu kalıcı olarak donuyordu. Ölü bir Apple önizleme
 * URL'i `useRound`'u `error` durumuna düşürüyor; o durumda çal, tahmin ve
 * **Geç** düğmelerinin üçü birden kapalı oluyor, tur asla bitmediği için cevap
 * hiç gönderilmiyor ve sıra hiç ilerlemiyordu. Ekranda bir açıklama bile yoktu.
 *
 * ⚠️ Şarkı yalnızca BU oyuncu için atlanıyor, rakip için değil. Sunucuya bir
 * "iki taraf için de atla" uç noktası eklemek, rakibinin bileceği şarkıyı iptal
 * etme — her şarkıda çağırıp beraberliği garantileme — yolunu açardı. Küratörlü
 * bir havuzda ölü önizleme nadir; sonsuza kadar kilitlenmek ise kesindi.
 */
function CalinamadiKutusu({ d }: { d: Duello }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Kutu tone="bad">
        Bu şarkı çalınamadı. Senin için atlanacak — rakibin oynamaya devam ediyor.
      </Kutu>
      <button
        type="button"
        onClick={() => d.cevapGonder({ won: false, heardSeconds: 0, listens: 0 })}
        style={{
          ...M,
          padding: '12px 20px',
          borderRadius: 5,
          border: '1px solid var(--acc)',
          background: 'oklch(0.81 0.12 var(--hue) / 0.12)',
          color: 'var(--acc)',
        }}
      >
        Bu şarkıyı geç
      </button>
    </div>
  )
}

/**
 * Beş şarkıyı bitirip rakibi bekleme ekranı — düellodaki TEK bekleme noktası.
 *
 * ⚠️ Şarkı listesi ve kazanan BURADA GÖSTERİLMEZ. İki oyuncu sonucu aynı anda
 * görmeli; erken bitiren kişi cevapları görürse onları dışarıdan (WhatsApp vb.)
 * söyleyebilir. Yalnızca kendi doğru sayısı ve rakibin ilerlemesi var.
 */
function SonBekleme({ d }: { d: Duello }) {
  return (
    <div
      style={{
        ...KART,
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: 420,
        gap: 18,
      }}
    >
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: '#e6e8ea' }}>
        Sen bitirdin
      </div>

      <div style={{ ...M, color: '#8c9297' }}>
        {d.benim.dogru}/{DUELLO_SARKI} doğru
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          ...M,
          color: '#6a7075',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--acc)',
            animation: 'nk-flick 1.4s ease-in-out infinite',
          }}
        />
        rakibin {d.rakipIlerleme}/{DUELLO_SARKI} bitirdi
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6a7075' }}>
        Şarkılar ve kazanan, ikiniz de bitirince aynı anda açılacak.
      </p>
    </div>
  )
}

/** Lobi ve bekleme ekranlarının üstündeki marka. */
function Marka() {
  return (
    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 30,
        lineHeight: 1,
        color: '#f2f4f5',
        textShadow: '0 0 28px var(--accSoft)',
      }}
    >
      tahmin
    </div>
  )
}

function Lobi({ kod }: { kod: string }) {
  const [kopyalandi, setKopyalandi] = useState(false)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/duello/${kod}`

  useEffect(() => {
    if (!kopyalandi) return
    const id = setTimeout(() => setKopyalandi(false), 2200)
    return () => clearTimeout(id)
  }, [kopyalandi])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        width: '100%',
        maxWidth: 460,
      }}
    >
      <Marka />

      <div style={{ ...KART, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ ...M, color: '#6a7075' }}>Lobi kodu</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 46,
          letterSpacing: '.22em',
          color: 'var(--acc)',
          textShadow: '0 0 30px var(--accSoft)',
        }}
      >
        {kod}
      </div>

      <p style={{ margin: 0, fontSize: 14, color: '#b6bbbf', lineHeight: 1.6 }}>
        Bu bağlantıyı arkadaşına gönder. O girdiği anda ikiniz aynı beş şarkıyı
        kolaydan zora oynamaya başlayacaksınız.
      </p>

      {/*
        ⚠️ Panoya kopyalama BURADA zorunlu. Düellonun tek işe yarama yolu linki
        birine göndermek; paylaşım düğmeleri kaldırıldığı için başka çıkış yok.
      */}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(link)
            .then(() => setKopyalandi(true))
            .catch(() => setKopyalandi(false))
        }}
        style={{
          ...M,
          padding: '12px 22px',
          borderRadius: 5,
          border: '1px solid var(--acc)',
          background: 'oklch(0.81 0.12 var(--hue) / 0.12)',
          color: 'var(--acc)',
        }}
      >
        {kopyalandi ? 'kopyalandı ✓' : 'bağlantıyı kopyala'}
      </button>

      <div
        style={{
          ...M,
          color: '#6a7075',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--acc)',
            animation: 'nk-flick 1.4s ease-in-out infinite',
          }}
        />
        arkadaşın bekleniyor
      </div>
      </div>
    </div>
  )
}

function GeriSayim({ n }: { n: number }) {
  return (
    <div
      role="status"
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 96,
        color: 'var(--acc)',
        textShadow: '0 0 40px var(--accSoft)',
        animation: 'nk-pop .4s cubic-bezier(.34,1.56,.64,1) both',
      }}
      key={n}
    >
      {n}
    </div>
  )
}

function Skor({ d }: { d: Duello }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, ...M }}>
      <span style={{ color: 'var(--acc)' }}>Sen {d.benim.dogru}</span>
      <span style={{ color: '#34393d' }}>—</span>
      <span style={{ color: '#b6bbbf' }}>{d.rakip.dogru} Rakip</span>
      <span style={{ color: '#4e5459' }}>
        {Math.min(d.aktif + 1, DUELLO_SARKI)}/{DUELLO_SARKI}
      </span>
    </div>
  )
}

function Bitis({ d }: { d: Duello }) {
  const baslik =
    d.sonuc === 'sen' ? 'Kazandın' : d.sonuc === 'rakip' ? 'Rakibin kazandı' : 'Berabere'

  return (
    <div style={{ ...KART, alignItems: 'center', textAlign: 'center', maxWidth: 460 }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 40,
          color: d.sonuc === 'sen' ? 'var(--acc)' : '#e6e8ea',
        }}
      >
        {baslik}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <tbody>
          <Satir ad="Sen" s={d.benim} vurgu={d.sonuc === 'sen'} />
          <Satir ad="Rakip" s={d.rakip} vurgu={d.sonuc === 'rakip'} />
        </tbody>
      </table>

      {d.rakip.eksik > 0 && (
        <p style={{ margin: 0, ...M, color: '#8a7448' }}>
          rakibin {d.rakip.eksik} şarkıyı bitirmedi
        </p>
      )}

      {/* Beş şarkı ancak tur bitince açılıyor; oyuncu ne çaldığını burada görür. */}
      {d.songs.length === DUELLO_SARKI && (
        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
          <div style={{ ...M, color: '#6a7075', marginBottom: 10 }}>şarkılar · sen / rakip</div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {d.songs.map((s, i) => (
              <li
                key={s.id}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left' }}
              >
                <span style={{ ...M, color: '#4e5459', width: 14, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: '#d7dadd', lineHeight: 1.4 }}>
                  {s.t} <span style={{ color: '#757b80' }}>· {s.a}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 13, display: 'inline-flex', gap: 9 }}>
                  <Im ok={d.sonuclar[i]?.benim ?? null} />
                  <Im ok={d.sonuclar[i]?.rakip ?? null} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Link
        href="/"
        style={{
          padding: '13px 26px',
          borderRadius: 5,
          border: '1px solid var(--acc)',
          background: 'var(--acc)',
          color: '#0a0c0e',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Tek başına oyna
      </Link>
    </div>
  )
}

/** Tek şarkı sonucu: bildi · bilemedi · hiç cevaplamadı. */
function Im({ ok }: { ok: boolean | null }) {
  const [im, renk, ad] =
    ok === null ? ['·', '#4e5459', 'cevaplamadı'] : ok ? ['✓', '#5fb87f', 'bildi'] : ['✕', '#a05a5a', 'bilemedi']
  return (
    <span title={ad} aria-label={ad} style={{ color: renk }}>
      {im}
    </span>
  )
}

function Satir({ ad, s, vurgu }: { ad: string; s: Duello['benim']; vurgu: boolean }) {
  return (
    <tr style={{ color: vurgu ? 'var(--acc)' : '#b6bbbf' }}>
      <td style={{ textAlign: 'left', padding: '7px 0', ...M }}>{ad}</td>
      <td style={{ textAlign: 'right', padding: '7px 0' }}>
        {s.dogru}/{DUELLO_SARKI} doğru
      </td>
      <td style={{ textAlign: 'right', padding: '7px 0', color: '#757b80' }}>
        {tr(Math.round(s.sure * 10) / 10)} sn
      </td>
    </tr>
  )
}

function Kutu({ tone, children }: { tone: 'bad' | 'warn'; children: React.ReactNode }) {
  const c = tone === 'bad' ? '160,90,90' : '201,162,94'
  return (
    <div
      role="status"
      style={{
        padding: '14px 20px',
        borderRadius: 8,
        border: `1px solid rgba(${c},0.35)`,
        background: `rgba(${c},0.07)`,
        color: tone === 'bad' ? '#d09a9a' : '#d5b477',
        fontSize: 13.5,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

const M = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
}

const KART = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
  padding: 26,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.02)',
  width: '100%',
}
