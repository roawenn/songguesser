'use client'

import { useEffect, useRef } from 'react'
import { SERIT, unluSatiri, type Unlu } from '@/data/unlu'
import { KAPAK_ADIM, kapakSatiri, type Kapak } from '@/data/kapak'
import { artworkAt, sarkiSatiri, type Song } from '@/data/schema'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import { IPUCU_SAYISI, MAX_WRONG } from '@/game/machine'
import type { GunlukTurGorunum } from '@/game/gunlukGorunum'
import type { BelirsizAday } from '@/game/gunlukHamle'
import type { GunlukApi } from '@/hooks/useGunluk'
import { useSettingsStore } from '@/store/useSettingsStore'
import { GuessInput, type OneriSatiri } from '../guess/GuessInput'
import { GuessLog } from '../guess/GuessLog'
import { Cassette, type CassetteHandle } from '../stage/Cassette'
import { KapakKare, type KapakKareHandle } from '../stage/KapakKare'
import { StepIndicator } from '../stage/StepIndicator'
import { Transport } from '../stage/Transport'
import { UnluKare, type UnluKareHandle } from '../stage/UnluKare'
import { ANA_DUGME, GHOST, OYUN_ADI } from './GunlukParcalar'

/**
 * Günlük turun sahneleri — normal oyunların YAPRAK bileşenleriyle.
 *
 * `GuessInput`, `GuessLog`, `StepIndicator`, `Transport`, `UnluKare`,
 * `KapakKare` aynen kullanılıyor; farklı olan yalnızca durumun kaynağı
 * (sunucu görünümü) ve belirsizlik listesinin öğe tipi: sunucu adayları
 * `{ id, ust, alt }` satırı olarak gönderiyor, havuz nesnesi olarak değil.
 */

type Tur<O extends GunlukTurGorunum['oyun']> = Extract<GunlukTurGorunum, { oyun: O }>

/** Öneri havuz nesnesinden, belirsizlik adayı sunucu satırından okunur. */
function satirci<T extends object>(havuzSatiri: (o: T) => OneriSatiri) {
  return (o: T | BelirsizAday): OneriSatiri => ('ust' in o ? o : havuzSatiri(o as T))
}

const sarkiSatirci = satirci<Song>(sarkiSatiri)
const unluSatirci = satirci<Unlu>(unluSatiri)
const kapakSatirci = satirci<Kapak>(kapakSatiri)

const PAS_STILI = {
  ...GHOST,
  border: '1px solid rgba(201,162,94,0.38)',
  background: 'rgba(201,162,94,0.07)',
  color: '#d5b477',
}

export function TurBasligi({ tur, index }: { tur: GunlukTurGorunum; index: number }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '.18em',
        textTransform: 'uppercase',
        color: '#8c9297',
        textAlign: 'center',
      }}
    >
      {index + 1}/6 · {OYUN_ADI[tur.oyun]} ·{' '}
      <span style={{ color: tur.zorluk === 'kolay' ? '#8fc9a3' : '#d9a37a' }}>{tur.zorluk}</span>
    </div>
  )
}

function Eylemler({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="nk-eylem"
      style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
    >
      {children}
    </div>
  )
}

export function SarkiTuru({ g, tur }: { g: GunlukApi; tur: Tur<'sarki'> }) {
  const easySearch = useSettingsStore((s) => s.easySearch)
  const reduce = useSettingsStore((s) => s.reduce)
  const ipucuAcik = tur.ipuclari.length < IPUCU_SAYISI && tur.attempt + 1 < ATTEMPTS && !g.bekliyor

  const kaset = useRef<CassetteHandle>(null)
  const { onYanlis } = g
  useEffect(() => onYanlis(() => kaset.current?.shake()), [onYanlis])

  return (
    <>
      {/*
        Kaset şarkı oyunundakiyle aynı — Günlük'te de şarkı turu aynı görünmeli.

        ⚠️ Etiketteki numara şarkı kimliğinden TÜRETİLEMEZ: Günlük'te kimlik
        istemciye hiç gelmiyor (cevabı ele verirdi). Medyanın verildiği andan
        türeyen opak bir numara kullanılıyor — tur başına sabit, cevapla ilgisiz.
      */}
      <Cassette
        handleRef={kaset}
        categoryLabel="Günlük"
        tapeCode={`NK-${String(tur.medyaVerildi).slice(-3)}`}
        playing={g.caliyor}
        reduce={reduce}
      />

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }} className="nk-cubuk">
        <StepIndicator
          attempt={tur.attempt}
          steps={tur.steps}
          playing={g.caliyor}
          clipLength={STEPS[Math.min(tur.attempt, STEPS.length - 1)]!}
          heardIndex={g.heardIndex}
          roundKey={`gunluk:${tur.medyaVerildi}`}
          hakKalan={tur.hakKalan}
          hakToplam={MAX_WRONG}
        />
      </div>

      <div
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        className="nk-kontrol"
      >
        {g.ses === 'desteklenmiyor' ? (
          <p style={{ color: '#d09a9a', fontSize: 13.5 }}>Tarayıcın bu sesi çalamıyor. Güncel bir tarayıcıyla dene.</p>
        ) : (
          <Transport
            listens={g.listens}
            clipLength={STEPS[Math.min(tur.attempt, STEPS.length - 1)]!}
            playing={g.caliyor}
            // Takıldıysa düğme AÇIK: dokunuş indirmeyi yeniden başlatıyor (iOS).
            disabled={g.ses === 'hazirlaniyor' || g.caliyor}
            arming={g.ses === 'hazirlaniyor'}
            stalled={g.ses === 'takildi'}
            onPlay={g.cal}
          />
        )}

        <div className="nk-giris" style={{ width: '100%' }}>
          <GuessInput<Song | BelirsizAday>
            index={g.indeksler.sarki}
            suggestions={easySearch}
            disabled={false}
            yerTutucu={g.indeksler.sarki ? undefined : 'Şarkının adını yaz…'}
            ambiguous={g.belirsiz}
            onGuess={g.tahmin}
            onPickAmbiguous={(a) => {
              g.belirsizligiTemizle()
              g.sec(a.id)
            }}
            satir={sarkiSatirci}
          />
        </div>

        <div className="nk-eylem nk-eylem-listesiz" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={g.pas} disabled={g.bekliyor} className="nk-pass" style={PAS_STILI}>
            Geç{' '}
            <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
              {tur.attempt < ATTEMPTS - 1 ? `→ ${tr(STEPS[tur.attempt + 1]!)}s` : '→ son hak'}
            </span>
          </button>
          <button
            type="button"
            onClick={g.ipucu}
            disabled={!ipucuAcik}
            className="nk-ipucu-dugme"
            title="Bir kademe karşılığında ipucu — tahmin hakkın gitmez"
            style={{
              ...GHOST,
              border: '1px solid rgba(150,140,210,0.36)',
              background: 'rgba(150,140,210,0.07)',
              color: '#bdb6e2',
              opacity: ipucuAcik || tur.ipuclari.length > 0 ? 1 : 0.4,
              cursor: ipucuAcik ? 'pointer' : 'default',
            }}
          >
            {tur.ipuclari.length > 0 && (
              <span style={{ letterSpacing: 0, textTransform: 'none', color: '#e4e0f8' }}>
                {tur.ipuclari.join(' · ')}
              </span>
            )}
            {tur.ipuclari.length < IPUCU_SAYISI && (tur.ipuclari.length > 0 ? ' · İpucu' : 'İpucu')}
          </button>
        </div>
      </div>
    </>
  )
}

export function UnluTuru({ g, tur }: { g: GunlukApi; tur: Tur<'unlu'> }) {
  const easySearch = useSettingsStore((s) => s.easySearch)
  const reduce = useSettingsStore((s) => s.reduce)
  const kare = useRef<UnluKareHandle>(null)
  const { onYanlis } = g
  useEffect(() => onYanlis(() => kare.current?.sars()), [onYanlis])

  return (
    <div className="nk-unlu-izgara">
      <div className="nk-unlu-gorsel">
        <UnluKare
          ref={kare}
          url={tur.medya.gorsel}
          acilan={tur.acilan}
          bitti={false}
          reduce={reduce}
          onYuklendi={g.gorselHazir}
          onHata={tur.sira === 0 ? g.gorselOlu : undefined}
        />
      </div>
      <div className="nk-unlu-kontrol">
        <div className="nk-giris" style={{ width: '100%' }}>
          <GuessInput<Unlu | BelirsizAday>
            index={g.indeksler.unlu}
            suggestions={easySearch}
            disabled={false}
            ambiguous={g.belirsiz}
            onGuess={g.tahmin}
            onPickAmbiguous={(a) => {
              g.belirsizligiTemizle()
              g.sec(a.id)
            }}
            satir={unluSatirci}
            yerTutucu="Ünlünün adını yaz…"
          />
        </div>
        <GuessLog steps={tur.steps} hakToplam={SERIT - 1} hakKalan={tur.hakKalan} yakinlikEtiketi={null} />
        <Eylemler>
          <button type="button" onClick={g.pas} disabled={g.bekliyor} className="nk-pass" style={PAS_STILI}>
            Geç{' '}
            <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
              {tur.acilan < SERIT - 1 ? '→ bir şerit daha' : '→ son hak'}
            </span>
          </button>
        </Eylemler>
      </div>
    </div>
  )
}

export function KapakTuru({ g, tur }: { g: GunlukApi; tur: Tur<'kapak'> }) {
  const easySearch = useSettingsStore((s) => s.easySearch)
  const reduce = useSettingsStore((s) => s.reduce)
  const kare = useRef<KapakKareHandle>(null)
  const { onYanlis } = g
  useEffect(() => onYanlis(() => kare.current?.sars()), [onYanlis])

  return (
    <div className="nk-unlu-izgara">
      <div className="nk-unlu-gorsel">
        <KapakKare
          ref={kare}
          ar=""
          url={tur.medya.gorsel}
          adim={tur.adim}
          bitti={false}
          reduce={reduce}
          onYuklendi={g.gorselHazir}
          onHata={tur.sira === 0 ? g.gorselOlu : undefined}
        />
      </div>
      <div className="nk-unlu-kontrol">
        <div className="nk-giris" style={{ width: '100%' }}>
          <GuessInput<Kapak | BelirsizAday>
            index={g.indeksler.kapak}
            suggestions={easySearch}
            disabled={false}
            ambiguous={g.belirsiz}
            onGuess={g.tahmin}
            onPickAmbiguous={(a) => {
              g.belirsizligiTemizle()
              g.sec(a.id)
            }}
            satir={kapakSatirci}
            yerTutucu="Albümün adını yaz…"
          />
        </div>
        <GuessLog steps={tur.steps} hakToplam={KAPAK_ADIM - 1} hakKalan={tur.hakKalan} yakinlikEtiketi="sanatçı doğru" />
        <Eylemler>
          <button type="button" onClick={g.pas} disabled={g.bekliyor} className="nk-pass" style={PAS_STILI}>
            Geç{' '}
            <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
              {tur.adim < KAPAK_ADIM - 1 ? '→ daha net' : '→ son hak'}
            </span>
          </button>
        </Eylemler>
      </div>
    </div>
  )
}

/** Turun cevabı: görsel, ad, alt satır. Özet ekranı da kullanıyor. */
export function cevapBilgisi(tur: GunlukTurGorunum): { gorsel: string; ad: string; alt: string; link: string } | null {
  if (!tur.cevap) return null
  switch (tur.oyun) {
    case 'sarki':
      return { gorsel: artworkAt(tur.cevap.ar, 300), ad: tur.cevap.t, alt: `${tur.cevap.a} · ${tur.cevap.y}`, link: tur.cevap.u }
    case 'unlu':
      return { gorsel: tur.medya.gorsel, ad: tur.cevap.ad, alt: '', link: '' }
    case 'kapak':
      return { gorsel: tur.medya.gorsel, ad: tur.cevap.al, alt: `${tur.cevap.a} · ${tur.cevap.y}`, link: tur.cevap.u }
  }
}

/** Biten turun kartı ve "Sıradaki tur". */
export function TurSonu({ g, tur, index }: { g: GunlukApi; tur: GunlukTurGorunum; index: number }) {
  const bilgi = cevapBilgisi(tur)
  const kazandi = tur.durum === 'kazandi'
  const sonuc = tur.sonuc
  const dugme = useRef<HTMLButtonElement>(null)

  // Klavyeyle oynayan Enter'a basıp devam edebilsin.
  useEffect(() => {
    dugme.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%', maxWidth: 420 }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 30,
          color: kazandi ? '#9fd8b3' : '#d9a0a0',
        }}
      >
        {kazandi ? 'Bildin!' : 'Bilemedin'}
      </div>

      {bilgi && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%' }}>
          {bilgi.gorsel && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bilgi.gorsel}
              alt=""
              width={tur.oyun === 'unlu' ? 72 : 96}
              height={tur.oyun === 'unlu' ? 120 : 96}
              style={{ flex: 'none', borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.09)' }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, color: '#f2f4f5', lineHeight: 1.25 }}>{bilgi.ad}</div>
            {bilgi.alt && <div style={{ fontSize: 13.5, color: '#8c9297', marginTop: 4 }}>{bilgi.alt}</div>}
            {bilgi.link && (
              <a
                href={bilgi.link}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7ea4be' }}
              >
                Apple Music ↗
              </a>
            )}
          </div>
        </div>
      )}

      {sonuc && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#a9aeb3', textAlign: 'center' }}>
          <span style={{ fontSize: 26, color: kazandi ? 'var(--acc)' : '#6a7075' }}>+{sonuc.puan}</span>
          {kazandi && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#6a7075' }}>
              adım {sonuc.puan - sonuc.hizBonusu} · hız +{sonuc.hizBonusu} · {tr((sonuc.sureMs / 1000).toFixed(1))} sn
            </div>
          )}
        </div>
      )}

      {index < 5 && (
        <button ref={dugme} type="button" onClick={g.sonraki} disabled={g.bekliyor} style={{ ...ANA_DUGME, opacity: g.bekliyor ? 0.5 : 1 }}>
          Sıradaki tur →
        </button>
      )}
    </div>
  )
}
