'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { unluChipById, type UnluChipId } from '@/data/categories'
import { SERIT, unluSatiri, type Unlu } from '@/data/unlu'
import { kalanHak, turBitti, turIcinde } from '@/game/unluMachine'
import { useDuello } from '@/hooks/useDuello'
import { useUnluTur } from '@/hooks/useUnluTur'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUnluStatsStore } from '@/store/useUnluStatsStore'
import { olayBirKez } from '@/lib/olay'
import { GuessInput } from './guess/GuessInput'
import { GuessLog } from './guess/GuessLog'
import { Backdrop } from './stage/Backdrop'
import { UnluKare, type UnluKareHandle } from './stage/UnluKare'
import { Bitis, GeriSayim, Kutu, Lobi, Marka, Skor, SonBekleme, M } from './duello/Parcalar'

/**
 * Ünlü düellosu.
 *
 * `DuelloShell`'in kardeşi: protokol, faz makinesi, lobi ekranı, geri sayım,
 * skor şeridi, bekleme ve bitiş ekranı `duello/Parcalar.tsx`'ten PAYLAŞILIYOR.
 * Burada yalnızca sahne var — görsel, şerit göstergesi ve tahmin kutusu.
 */

export function UnluDuelloShell({ kod }: { kod: string }) {
  const d = useDuello<Unlu>(kod)
  const reduce = useSettingsStore((s) => s.reduce)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const kaydet = useUnluStatsStore((s) => s.kaydet)
  const kare = useRef<UnluKareHandle>(null)

  /*
   * ⚠️ Tur YALNIZCA oynanırken kurulur ve sunucu öğeleri adım adım açtığı
   * için elimizde her zaman beş tane OLMAYABİLİR. Ölçüt "beş geldi mi" değil,
   * "sıradaki geldi mi".
   */
  const hazir = d.songs.length > d.aktif
  const oynanabilir = d.faz === 'oynaniyor' && hazir

  /*
   * ⚠️ Dizi kimliği SABİTLENMELİ. `d.songs` her yoklamada (1,5 sn) yeni bir
   * dizi; doğrudan geçilseydi `useUnluTur`'un etkisi her yoklamada turu
   * yeniden kurardı — şarkı tarafında tam bu hata yaşandı.
   */
  const imza = d.songs.map((u) => u.id).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dizilim = useMemo(() => d.songs, [imza])

  const tur = useUnluTur(oynanabilir ? { dizilim, index: d.aktif } : undefined)
  const { durum, onYanlis } = tur
  const { cevapGonder } = d

  useEffect(() => {
    onYanlis(() => kare.current?.sars())
  }, [onYanlis])

  // Tur bitince sonucu bir kez bildir — hem rakibe hem kendi sayaçlarına.
  useEffect(() => {
    if (!turBitti(durum)) return
    /*
     * ⚠️ Maliyet = AÇILAN ŞERİT. Az olan iyi; şarkı tarafında duyulan saniye
     * ne ise burada bu. `ikincil` ünlüde kullanılmıyor.
     */
    cevapGonder({ won: durum.s === 'won', maliyet: durum.acilan, ikincil: 0 })
    const turId = `${durum.kisi.id}:${durum.s}:${durum.acilan}`
    kaydet(turId, {
      won: durum.s === 'won',
      tier: durum.kisi.d,
      acilan: durum.acilan,
    })
    olayBirKez(`duello-unlu:${turId}`, 'tur_bitti', {
      oyun: 'unlu',
      secki: d.chip ?? '',
      zorluk: durum.kisi.d,
      sonuc: durum.s === 'won' ? 'kazandi' : 'kaybetti',
      adim: durum.acilan,
      duello: true,
    })
  }, [durum, cevapGonder, kaydet, d.chip])

  // ⚠️ Sahne rengi LOBİNİN çipinden — yerel ayardan değil.
  const chip = unluChipById((d.chip as UnluChipId | null) ?? 'unlu-karisik')
  const steps = 'steps' in durum ? durum.steps : []
  const acilan = 'acilan' in durum ? durum.acilan : 1
  const canli = turIcinde(durum)

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
        }}
      >
        <Link href="/unlu" style={{ ...M, color: '#6a7075', textDecoration: 'none' }}>
          ← tahmin.in
        </Link>
        <Marka />

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
                <Bitis
                  d={d}
                  satir={(u: Unlu) => ({ ust: u.ad })}
                  maliyetMetni={(n) => `${n} şerit`}
                  tekBasinaYol="/unlu"
                  birim="ünlüler"
                />
              ) : d.faz === 'bekleme' ? (
                <SonBekleme d={d} birim="ünlü" />
              ) : durum.s === 'error' ? (
                /*
                 * ⚠️ Kaçış kapısı ŞART. Görsel açılamazsa tur asla bitmez,
                 * `cevapGonder` hiç çalışmaz ve oyuncu SONSUZA KADAR donar —
                 * şarkı tarafında tam bu hata yaşandı.
                 */
                <Kutu tone="bad">
                  <p style={{ margin: 0 }}>Bu görsel açılamadı.</p>
                  <button
                    type="button"
                    onClick={() => cevapGonder({ won: false, maliyet: SERIT, ikincil: 0 })}
                    style={GECBUTON}
                  >
                    Bu turu geç
                  </button>
                </Kutu>
              ) : hazir ? (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 430,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 18,
                  }}
                >
                  <UnluKare
                    ref={kare}
                    url={tur.gorselUrl}
                    acilan={acilan}
                    bitti={false}
                    reduce={reduce}
                  />

                  <div style={{ width: '100%' }}>
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

                  <GuessLog
                    steps={steps}
                    hakToplam={SERIT - 1}
                    hakKalan={kalanHak(acilan)}
                    yakinlikEtiketi={null}
                  />

                  <button type="button" onClick={tur.pas} disabled={!canli} style={GECBUTON}>
                    Geç{' '}
                    <span style={{ color: '#8a7448' }}>
                      {acilan < SERIT - 1 ? `→ ${acilan + 1}. şerit` : '→ son hak'}
                    </span>
                  </button>
                </div>
              ) : (
                <div style={{ ...M, color: '#6a7075' }}>görsel hazırlanıyor…</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const GECBUTON = {
  marginTop: 4,
  padding: '11px 18px',
  borderRadius: 6,
  border: '1px solid rgba(201,162,94,0.38)',
  background: 'rgba(201,162,94,0.07)',
  color: '#d5b477',
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
}
