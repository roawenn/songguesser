'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { anahtarYaz } from '@/lib/duelloAnahtar'
import { CHIPS, chipById, type ChipId } from '@/data/categories'
import { KAPAK_ADIM, kapakSatiri } from '@/data/kapak'
import { kapakKalanHak, kapakTurBitti, kapakTurIcinde } from '@/game/kapakMachine'
import { useKapakTur } from '@/hooks/useKapakTur'
import { olay, olayBirKez } from '@/lib/olay'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useKapakStatsStore } from '@/store/useKapakStatsStore'
import { GuessInput } from './guess/GuessInput'
import { GuessLog } from './guess/GuessLog'
import { KapakSonucPanel } from './reveal/KapakSonucPanel'
import { SahneCercevesi } from './shell/SahneCercevesi'
import { TierStrip } from './shell/Chrome'
import { KapakAyarKarti, KapakIstatistikKarti, KapakNasilKarti } from './shell/KapakPanels'
import { LinksCard } from './shell/SidePanels'
import { KapakKare, type KapakKareHandle } from './stage/KapakKare'

/**
 * Kapaktan Albüm oyununun kabuğu — `UnluShell`'in kardeşi.
 *
 * Dış iskelet (`SahneCercevesi`), yan yana sahne düzeni (`.nk-unlu-izgara`),
 * tahmin kutusu ve tahmin listesi paylaşılıyor.
 *
 * Düello `KapakDuelloShell`'de; buradan yalnızca lobi kuruluyor.
 */

export function KapakShell() {
  const tur = useKapakTur()
  const reduce = useSettingsStore((s) => s.reduce)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const kolay = useSettingsStore((s) => s.kapakKolay)
  const kategori = useSettingsStore((s) => s.kapakCategory)
  const setKategori = useSettingsStore((s) => s.setKapakCategory)
  const kademe = useSettingsStore((s) => s.kapakTier)
  const setKademe = useSettingsStore((s) => s.setKapakTier)
  const kaydet = useKapakStatsStore((s) => s.kaydet)

  const kare = useRef<KapakKareHandle>(null)
  const { durum, onYanlis } = tur
  const router = useRouter()
  const [duelloKuruluyor, setDuelloKuruluyor] = useState(false)
  const [duelloHata, setDuelloHata] = useState<string | null>(null)

  /**
   * Lobi kur ve oraya git.
   *
   * ⚠️ Kolay mod LOBİYE yazılıyor: iki oyuncuya kuranın o anki kuralı uygulanır
   * (bkz. `KapakDuelloShell`).
   *
   * ⚠️ Gizli anahtar navigasyondan ÖNCE yazılıyor ve `router.push` kullanılıyor
   * — `UnluShell`'deki gerekçenin aynısı.
   */
  const duelloBaslat = async () => {
    setDuelloKuruluyor(true)
    setDuelloHata(null)
    try {
      const res = await fetch('/api/duello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oyun: 'kapak', chip: kategori, kolay }),
      })
      const d = (await res.json()) as { kod?: string; gizli?: string; error?: string }
      if (!res.ok || !d.kod || !d.gizli) throw new Error(d.error ?? 'Lobi kurulamadı.')
      anahtarYaz(d.kod, d.gizli)
      olay('duello_kuruldu', { oyun: 'kapak', secki: kategori })
      router.push(`/duello/${d.kod}`)
    } catch (e) {
      setDuelloHata((e as Error).message)
      setDuelloKuruluyor(false)
    }
  }

  useEffect(() => {
    onYanlis(() => kare.current?.sars())
  }, [onYanlis])

  // Biten turu istatistiğe ve analitiğe yaz — tek anahtar, çift kayıt koruması.
  useEffect(() => {
    if (!kapakTurBitti(durum)) return
    const turId = `${durum.kapak.id}:${durum.s}:${durum.adim}`
    kaydet(turId, { won: durum.s === 'won', tier: durum.kapak.d, acilan: durum.adim })
    olayBirKez(`kapak:${turId}`, 'tur_bitti', {
      oyun: 'kapak',
      secki: kategori,
      zorluk: kademe,
      sonuc: durum.s === 'won' ? 'kazandi' : 'kaybetti',
      adim: durum.adim,
      duello: false,
    })
  }, [durum, kaydet, kategori, kademe])

  const chip = chipById(kategori)
  const steps = 'steps' in durum ? durum.steps : []
  const adim = 'adim' in durum ? durum.adim : 1
  const canli = kapakTurIcinde(durum)

  const anons = (() => {
    if (durum.s === 'won') return `Doğru! ${durum.kapak.al} — ${durum.kapak.a}`
    if (durum.s === 'lost') return `Bilemedin. Doğrusu: ${durum.kapak.al} — ${durum.kapak.a}`
    if (durum.s === 'arming') return 'Kapak yükleniyor'
    if (!canli) return ''
    const son = steps[steps.length - 1]
    const bas = son?.kind === 'wrong' ? 'Yanlış.' : son?.kind === 'skip' ? 'Pas geçildi.' : ''
    return `${bas} Kapak ${adim}. adımda. ${kapakKalanHak(adim)} tahmin hakkın kaldı.`.trim()
  })()

  return (
    <SahneCercevesi
      hue={chip.hue}
      reduce={reduce}
      anons={anons}
      cipler={CHIPS}
      secili={kategori}
      onSecki={(c) => setKategori(c as ChipId)}
      aktifOyun="kapak"
      atif="Albüm kapakları Apple Music / iTunes aracılığıyla sağlanmaktadır."
      sol={<KapakIstatistikKarti />}
      sag={
        <>
          <KapakAyarKarti />
          <KapakNasilKarti />
          <LinksCard />
        </>
      }
      orta={
        <main
          className="nk-stage nk-unlu nk-kapak"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          {durum.s === 'error' ? (
            <Uyari>
              {durum.reason === 'pool'
                ? 'Albüm listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'
                : 'Kapak açılamadı. Bağlantın yavaş olabilir.'}
              {/* Sayfayı yenilemeye zorlamasın: kapak hatasında başka albümle yeniden dene. */}
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => (durum.reason === 'pool' ? window.location.reload() : tur.degistir())}
                  style={{ ...GHOST, border: '1px solid var(--acc)', color: 'var(--acc)' }}
                >
                  Tekrar dene
                </button>
              </div>
            </Uyari>
          ) : durum.s === 'empty' ? (
            <Uyari>Bu seçkide henüz albüm yok. Başka bir seçki dene.</Uyari>
          ) : kapakTurBitti(durum) ? (
            <div className="nk-sonuc">
              <KapakSonucPanel
                key={durum.kapak.id}
                album={durum.kapak.al}
                sanatci={durum.kapak.a}
                yil={durum.kapak.y}
                ar={tur.kapakAr}
                magaza={tur.magazaUrl}
                kazandi={durum.s === 'won'}
                adim={durum.adim}
                reduce={reduce}
                onSonraki={tur.sonraki}
              />
            </div>
          ) : (
            <div className="nk-unlu-izgara">
              <div className="nk-unlu-gorsel">
                <KapakKare ref={kare} ar={tur.kapakAr} adim={adim} bitti={false} reduce={reduce} />
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
                    onPickAmbiguous={(k) => {
                      tur.belirsizligiTemizle()
                      tur.kapakSec(k)
                    }}
                    satir={kapakSatiri}
                    yerTutucu={kolay ? 'Albüm ya da sanatçı…' : 'Albümün adını yaz…'}
                  />
                </div>

                {/*
                  ⚠️ Kolay modda sanatçı zaten kabul olduğu için "sanatçı doğru"
                  rozeti anlamsız; kapalı modda değerli bir işaret.
                */}
                <GuessLog
                  steps={steps}
                  hakToplam={KAPAK_ADIM - 1}
                  hakKalan={kapakKalanHak(adim)}
                  yakinlikEtiketi={kolay ? null : 'sanatçı doğru'}
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
                      {adim < KAPAK_ADIM - 1 ? '→ daha net' : '→ son hak'}
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
                    title="Aynı seçkide başka bir albüme geç — hakkın gitmez"
                  >
                    ↻ Albümü değiştir
                  </button>
                </div>

                {/* Düello — `UnluShell` ile aynı yer ve görünüm. */}
                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => void duelloBaslat()}
                    disabled={duelloKuruluyor}
                    className="nk-duello"
                    title={
                      kolay
                        ? 'Arkadaşınla aynı 5 albüm — sanatçı adı da kabul (Kolay mod açık)'
                        : 'Arkadaşınla aynı 5 albüm — yalnızca albüm adı (Kolay mod kapalı)'
                    }
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
