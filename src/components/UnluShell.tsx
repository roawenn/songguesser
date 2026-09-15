'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { anahtarYaz } from '@/lib/duelloAnahtar'
import { olay, olayBirKez } from '@/lib/olay'
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
import { TierStrip } from './shell/Chrome'
import { UnluAyarKarti, UnluIstatistikKarti, UnluNasilKarti } from './shell/UnluPanels'
import { LinksCard } from './shell/SidePanels'
import { UnluKare, type UnluKareHandle } from './stage/UnluKare'

/**
 * Ünlü tanıma oyununun kabuğu.
 *
 * `GameShell`'in yerine geçmez, YANINDA durur — `DuelloShell`'in koyduğu
 * kuralın aynısı. Dış iskelet (`SahneCercevesi`) ve yaprak bileşenler
 * (`GuessInput`, `GuessLog`, `TierStrip`, `Confetti`) paylaşılıyor.
 *
 * ⚠️ Masaüstünde görsel ve kontroller YAN YANA (`.nk-unlu-izgara`). Dikey
 * dizilimde 475 px'lik görsel sayfayı en az 1113 px'e kilitliyordu ve iki oyun
 * aynı ölçeği paylaştığı için şarkı oyununu da küçültüyordu. Görseli küçültmek
 * yerine orta sütunun boş genişliği kullanıldı. Telefonda dizilim dikey.
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
  const router = useRouter()
  const [duelloKuruluyor, setDuelloKuruluyor] = useState(false)
  const [duelloHata, setDuelloHata] = useState<string | null>(null)
  const { durum, onYanlis } = tur

  /**
   * Lobi kur ve oraya git.
   *
   * ⚠️ Gizli anahtar navigasyondan ÖNCE yazılıyor ve `router.push`
   * kullanılıyor (`window.location` değil): tam sayfa yüklemesi modül
   * düzeyindeki bellek yedeğini siler ve tarayıcı verisi kapalıysa kuran kişi
   * kendi lobisine 2. oyuncu olarak girer — şarkı tarafında yaşanan hata.
   */
  const duelloBaslat = async () => {
    setDuelloKuruluyor(true)
    setDuelloHata(null)
    try {
      const res = await fetch('/api/duello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oyun: 'unlu', chip: kategori }),
      })
      const d = (await res.json()) as { kod?: string; gizli?: string; error?: string }
      if (!res.ok || !d.kod || !d.gizli) throw new Error(d.error ?? 'Lobi kurulamadı.')
      anahtarYaz(d.kod, d.gizli)
      olay('duello_kuruldu', { oyun: 'unlu', secki: kategori })
      router.push(`/duello/${d.kod}`)
    } catch (e) {
      setDuelloHata((e as Error).message)
      setDuelloKuruluyor(false)
    }
  }

  useEffect(() => {
    onYanlis(() => kare.current?.sars())
  }, [onYanlis])

  // Biten turu istatistiğe yaz. Çift kayıt koruması depoda.
  useEffect(() => {
    if (!turBitti(durum)) return
    const turId = `${durum.kisi.id}:${durum.s}:${durum.acilan}`
    kaydet(turId, {
      won: durum.s === 'won',
      tier: durum.kisi.d,
      acilan: durum.acilan,
    })
    // Zorluk: oyuncunun SEÇTİĞİ kademe — "hangi zorluk oynanıyor" sorusu bu.
    olayBirKez(`unlu:${turId}`, 'tur_bitti', {
      oyun: 'unlu',
      secki: kategori,
      zorluk: kademe,
      sonuc: durum.s === 'won' ? 'kazandi' : 'kaybetti',
      adim: durum.acilan,
      duello: false,
    })
  }, [durum, kaydet, kategori, kademe])

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
      atif="Görseller yalnızca tanıma amacıyla, düşük çözünürlükte kullanılıyor."
      sol={<UnluIstatistikKarti />}
      sag={
        <>
          <UnluAyarKarti />
          <UnluNasilKarti />
          <LinksCard />
        </>
      }
      orta={
        <main
          className="nk-stage nk-unlu"
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
          ) : turBitti(durum) ? (
            <div className="nk-sonuc">
            <UnluSonucPanel
              key={durum.kisi.id}
              ad={durum.kisi.ad}
              gorselUrl={tur.gorselUrl}
              kazandi={durum.s === 'won'}
              acilan={durum.acilan}
              reduce={reduce}
              onSonraki={tur.sonraki}
            />
            </div>
          ) : (
            <div className="nk-unlu-izgara">
              <div className="nk-unlu-gorsel">
                <UnluKare
                  ref={kare}
                  url={tur.gorselUrl}
                  acilan={acilan}
                  bitti={false}
                  reduce={reduce}
                />

                {/*
                  Havuz inceyken oyun ENGELLENMİYOR, yalnızca durum söyleniyor —
                  küratör içerik eklerken oyunu deneyebilmeli.

                  ⚠️ Masaüstünde `position: absolute` (bkz. `.nk-ipucu`): normal
                  akışta sahneyi uzatıyor ve yüksekliği havuzun doluluğuna bağlı
                  hâle getiriyordu. Telefonda normal akışta — orada ölçek
                  bütçesi yok, mutlak konumda "Zorluk" yazısının üstüne biniyordu.
                */}
                {tur.azKisi && (
                  <div
                    className="nk-ipucu"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: '#6a7075',
                    }}
                  >
                    bu seçkide {tur.suzulmus.length} kişi var · tekrar edebilir
                  </div>
                )}
              </div>

              <div className="nk-unlu-kontrol">
                <div className="nk-kademe">
                  <TierStrip tier={kademe} onTier={setKademe} />
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

                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => void duelloBaslat()}
                    disabled={duelloKuruluyor}
                    className="nk-duello"
                    style={{
                      ...GHOST,
                      border: '1px solid var(--acc)',
                      color: 'var(--acc)',
                      background: 'oklch(0.81 0.12 var(--hue) / 0.08)',
                      opacity: duelloKuruluyor ? 0.5 : 1,
                    }}
                  >
                    ⚔ {duelloKuruluyor ? 'Lobi kuruluyor…' : 'Arkadaşınla oyna'}
                  </button>
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
              </div>
            </div>
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
