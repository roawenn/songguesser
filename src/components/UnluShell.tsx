'use client'

import { useEffect, useRef } from 'react'
import { UNLU_CHIPS, unluChipById, type UnluChipId } from '@/data/categories'
import { SERIT, unluSatiri } from '@/data/unlu'
import { kalanHak, turBitti, turIcinde } from '@/game/unluMachine'
import { useUnluTur } from '@/hooks/useUnluTur'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUnluStatsStore } from '@/store/useUnluStatsStore'
import { GuessInput } from './guess/GuessInput'
import { GuessLog } from './guess/GuessLog'
import { UnluSonucPanel } from './reveal/UnluSonucPanel'
import { SahneCercevesi } from './shell/SahneCercevesi'
import { TASARIM_Y_UNLU } from './shell/useOlcek'
import { TierStrip } from './shell/Chrome'
import { UnluAyarKarti, UnluIstatistikKarti, UnluNasilKarti } from './shell/UnluPanels'
import { LinksCard } from './shell/SidePanels'
import { SeritGostergesi } from './stage/SeritGostergesi'
import { UnluKare, type UnluKareHandle } from './stage/UnluKare'

/**
 * Ünlü tanıma oyununun kabuğu.
 *
 * `GameShell`'in yerine geçmez, YANINDA durur — `DuelloShell`'in koyduğu
 * kuralın aynısı. Dış iskelet (`SahneCercevesi`) ve yaprak bileşenler
 * (`GuessInput`, `GuessLog`, `TierStrip`, `LinksCard`, `Confetti`)
 * paylaşılıyor; kopyalanmıyor.
 *
 * ⚠️ `Transport` ve Boşluk tuşu YOK — burada çalınacak bir şey yok. Ama dikey
 * ritim sınıfları (`.nk-kademe`, `.nk-cubuk`, `.nk-kontrol`, `.nk-giris`,
 * `.nk-eylem`) aynen kullanılıyor ki iki oyun arasında geçen oyuncu aynı
 * düzeni görsün ve `TASARIM_Y` bütçesi ikisinde de tutsun.
 */

export function UnluShell() {
  const tur = useUnluTur()
  const reduce = useSettingsStore((s) => s.reduce)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const kategori = useSettingsStore((s) => s.unluCategory)
  const setKategori = useSettingsStore((s) => s.setUnluCategory)
  const kademe = useSettingsStore((s) => s.unluTier)
  const setKademe = useSettingsStore((s) => s.setUnluTier)
  const kaydet = useUnluStatsStore((s) => s.kaydet)

  const kare = useRef<UnluKareHandle>(null)
  const { durum, onYanlis } = tur

  useEffect(() => {
    onYanlis(() => kare.current?.sars())
  }, [onYanlis])

  // Biten turu istatistiğe yaz. Çift kayıt koruması depoda.
  useEffect(() => {
    if (!turBitti(durum)) return
    kaydet(`${durum.kisi.id}:${durum.s}:${durum.acilan}`, {
      won: durum.s === 'won',
      tier: durum.kisi.d,
      acilan: durum.acilan,
    })
  }, [durum, kaydet])

  const chip = unluChipById(kategori)
  const steps = 'steps' in durum ? durum.steps : []
  const acilan = 'acilan' in durum ? durum.acilan : 1
  const canli = turIcinde(durum)

  const anons = (() => {
    if (durum.s === 'won') return `Doğru! ${durum.kisi.ad}`
    if (durum.s === 'lost') return `Bilemedin. Doğrusu: ${durum.kisi.ad}`
    if (durum.s === 'arming') return 'Görsel yükleniyor'
    if (!turIcinde(durum)) return ''
    const son = steps[steps.length - 1]
    const bas = son?.kind === 'wrong' ? 'Yanlış.' : son?.kind === 'skip' ? 'Pas geçildi.' : ''
    return `${bas} ${acilan}. şerit açıldı. ${kalanHak(acilan)} tahmin hakkın kaldı.`.trim()
  })()

  return (
    <SahneCercevesi
      hue={chip.hue}
      reduce={reduce}
      anons={anons}
      cipler={UNLU_CHIPS}
      secili={kategori}
      onSecki={(c) => setKategori(c as UnluChipId)}
      aktifOyun="unlu"
      tasarimY={TASARIM_Y_UNLU}
      atif="Görseller yalnızca tanıma amacıyla, düşük çözünürlükte kullanılıyor."
      sol={
        <>
          <UnluAyarKarti />
          <UnluIstatistikKarti />
        </>
      }
      sag={
        <>
          <UnluNasilKarti />
          <LinksCard />
        </>
      }
      orta={
        <main
          className="nk-stage"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          {durum.s === 'error' ? (
            <Uyari>
              {durum.reason === 'pool'
                ? 'Ünlü listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'
                : 'Görsel açılamadı. Sayfayı yenilemeyi dene.'}
            </Uyari>
          ) : durum.s === 'empty' ? (
            <Uyari>Bu seçkide henüz kimse yok. Başka bir kategori dene.</Uyari>
          ) : tur.cokDar ? (
            <Uyari>Bu zorlukta oynanacak kadar kişi yok. Başka bir kademe dene.</Uyari>
          ) : turBitti(durum) ? (
            <UnluSonucPanel
              key={durum.kisi.id}
              ad={durum.kisi.ad}
              gorselUrl={tur.gorselUrl}
              kazandi={durum.s === 'won'}
              acilan={durum.acilan}
              reduce={reduce}
              onSonraki={tur.sonraki}
            />
          ) : (
            <>
              <UnluKare
                ref={kare}
                url={tur.gorselUrl}
                acilan={acilan}
                bitti={false}
                reduce={reduce}
              />

              <div className="nk-kademe">
                <TierStrip tier={kademe} onTier={setKademe} />
              </div>

              <div className="nk-cubuk" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <SeritGostergesi acilan={acilan} steps={steps} bitti={false} />
              </div>

              <div className="nk-giris" style={{ width: '100%' }}>
                <GuessInput
                  index={tur.index}
                  suggestions={easySearch}
                  disabled={!canli}
                  ambiguous={tur.belirsiz}
                  onGuess={tur.tahmin}
                  onPickAmbiguous={(u) => {
                    tur.belirsizligiTemizle()
                    tur.kisiSec(u)
                  }}
                  satir={unluSatiri}
                  yerTutucu="Ünlünün adını yaz…"
                />
              </div>

              {/* ⚠️ `hakToplam` MAX_WRONG değil: burada sınırı şerit sayısı koyuyor. */}
              <GuessLog
                steps={steps}
                hakToplam={SERIT - 1}
                hakKalan={kalanHak(acilan)}
                yakinlikEtiketi={null}
              />

              <div
                className="nk-eylem"
                style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
              >
                <button
                  type="button"
                  onClick={tur.pas}
                  disabled={!canli}
                  className="nk-pass"
                  style={{
                    ...GHOST,
                    border: '1px solid rgba(201,162,94,0.38)',
                    background: 'rgba(201,162,94,0.07)',
                    color: '#d5b477',
                    opacity: canli ? 1 : 0.4,
                    cursor: canli ? 'pointer' : 'not-allowed',
                  }}
                >
                  Geç{' '}
                  <span style={{ color: '#8a7448', letterSpacing: 0, textTransform: 'none' }}>
                    {acilan < SERIT - 1 ? `→ ${acilan + 1}. şerit` : '→ son hak'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={tur.degistir}
                  className="nk-degistir"
                  style={{
                    ...GHOST,
                    border: '1px solid rgba(126,164,190,0.32)',
                    color: '#a9c7da',
                  }}
                  title="Aynı seçkide başka bir kişiye geç — hakkın gitmez"
                >
                  ↻ Kişiyi değiştir
                </button>
              </div>
            </>
          )}

          <style>{`
            .nk-pass:hover:not(:disabled) {
              border-color: rgba(201,162,94,0.7) !important;
              color: #e8c98c !important;
              background: rgba(201,162,94,0.14) !important;
            }
            .nk-degistir:hover:not(:disabled) {
              border-color: rgba(126,164,190,0.7) !important;
              color: #c3dcec !important;
              background: rgba(126,164,190,0.14) !important;
            }
          `}</style>
        </main>
      }
    />
  )
}

function Uyari({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      style={{
        maxWidth: 380,
        textAlign: 'center',
        color: '#8c9297',
        fontSize: 13.5,
        lineHeight: 1.7,
        padding: '40px 10px',
      }}
    >
      {children}
    </div>
  )
}

const GHOST = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '11px 18px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#a9aeb3',
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}
