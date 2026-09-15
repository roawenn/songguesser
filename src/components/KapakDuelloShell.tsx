'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { chipById, type ChipId } from '@/data/categories'
import { KAPAK_ADIM, kapakSatiri, type Kapak } from '@/data/kapak'
import { kapakKalanHak, kapakTurBitti, kapakTurIcinde } from '@/game/kapakMachine'
import { useDuello } from '@/hooks/useDuello'
import { useKapakTur } from '@/hooks/useKapakTur'
import { olayBirKez } from '@/lib/olay'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useKapakStatsStore } from '@/store/useKapakStatsStore'
import { GuessInput } from './guess/GuessInput'
import { GuessLog } from './guess/GuessLog'
import { Backdrop } from './stage/Backdrop'
import { KapakKare, type KapakKareHandle } from './stage/KapakKare'
import { Bitis, GeriSayim, Kutu, Lobi, Marka, Skor, SonBekleme, M } from './duello/Parcalar'

/**
 * Kapaktan Albüm düellosu.
 *
 * `UnluDuelloShell`'in kardeşi: protokol, faz makinesi, lobi, geri sayım, skor,
 * bekleme ve bitiş `duello/Parcalar.tsx`'ten PAYLAŞILIYOR. Burada yalnızca
 * sahne var — pikselli kapak, tahmin kutusu ve tahmin listesi.
 *
 * ⚠️ KABUL KURALI LOBİDEN (`d.kolay`), oyuncunun kendi ayarından DEĞİL. İki
 * oyuncunun ayarı farklıyken biri sanatçı adıyla, diğeri yalnızca albüm adıyla
 * bilebilirdi. Kural ekranda yazılı ki kimse sürprizle karşılaşmasın.
 */

/** Lobi ve beklemede kancaya verilen boş dizilim — kimliği sabit kalmalı. */
const BOS: Kapak[] = []

export function KapakDuelloShell({ kod }: { kod: string }) {
  const d = useDuello<Kapak>(kod)
  const reduce = useSettingsStore((s) => s.reduce)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const kaydet = useKapakStatsStore((s) => s.kaydet)
  const kare = useRef<KapakKareHandle>(null)

  // Sunucu öğeleri adım adım açıyor: ölçüt "beş geldi mi" değil "sıradaki geldi mi".
  const hazir = d.songs.length > d.aktif
  const oynanabilir = d.faz === 'oynaniyor' && hazir

  /*
   * ⚠️ Dizi kimliği SABİTLENMELİ: `d.songs` her yoklamada (1,5 sn) yeni bir dizi.
   */
  const imza = d.songs.map((k) => k.id).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dizilim = useMemo(() => d.songs, [imza])

  // Eski bir lobide (kural yazılmadan kurulmuş) ya da durum gelmeden sıkı kural.
  const kolay = d.kolay === true

  /*
   * ⚠️ Seçenekler HER fazda geçiriliyor, lobide boş dizilimle: `undefined`
   * geçilseydi kanca tek oyunculu kipe düşer ve lobi beklenirken arka planda
   * rastgele turlar kurardı.
   */
  const tur = useKapakTur({ dizilim: oynanabilir ? dizilim : BOS, index: d.aktif, kolay })
  const { durum, onYanlis } = tur
  const { cevapGonder } = d

  useEffect(() => {
    onYanlis(() => kare.current?.sars())
  }, [onYanlis])

  // Tur bitince sonucu bir kez bildir — hem rakibe hem kendi sayaçlarına.
  useEffect(() => {
    if (!kapakTurBitti(durum)) return
    // ⚠️ Maliyet = AÇILAN ADIM. Az olan iyi; ünlüde açılan şerit ne ise bu o.
    cevapGonder({ won: durum.s === 'won', maliyet: durum.adim, ikincil: 0 })
    const turId = `${durum.kapak.id}:${durum.s}:${durum.adim}`
    kaydet(turId, { won: durum.s === 'won', tier: durum.kapak.d, acilan: durum.adim })
    olayBirKez(`duello-kapak:${turId}`, 'tur_bitti', {
      oyun: 'kapak',
      secki: d.chip ?? '',
      zorluk: durum.kapak.d,
      sonuc: durum.s === 'won' ? 'kazandi' : 'kaybetti',
      adim: durum.adim,
      duello: true,
    })
  }, [durum, cevapGonder, kaydet, d.chip])

  // ⚠️ Sahne rengi LOBİNİN çipinden — yerel ayardan değil.
  const chip = chipById((d.chip as ChipId | null) ?? 'karisik')
  const steps = 'steps' in durum ? durum.steps : []
  const adim = 'adim' in durum ? durum.adim : 1
  const canli = kapakTurIcinde(durum)

  const kural = (
    <div style={{ ...M, color: '#8c9297', textAlign: 'center' }}>
      Kural: {kolay ? 'albüm ya da sanatçı adı' : 'yalnızca albüm adı'}
    </div>
  )

  return (
    <div
      className="themed"
      style={{
        ['--hue' as string]: String(chip.hue),
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background: 'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
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
        <Link href="/kapak" style={{ ...M, color: '#6a7075', textDecoration: 'none' }}>
          ← tahmin.net
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
          {d.faz === 'lobi' && (
            <>
              <Lobi kod={kod} />
              {d.kolay !== null && kural}
            </>
          )}
          {d.faz === 'gerisayim' && <GeriSayim n={d.geriSayim} />}

          {(d.faz === 'oynaniyor' || d.faz === 'bekleme' || d.faz === 'bitti') && (
            <>
              <Skor d={d} />

              {d.faz === 'bitti' ? (
                <Bitis
                  d={d}
                  satir={kapakSatiri}
                  maliyetMetni={(n) => `${n} adım`}
                  tekBasinaYol="/kapak"
                  birim="albümler"
                />
              ) : d.faz === 'bekleme' ? (
                <SonBekleme d={d} birim="albüm" />
              ) : durum.s === 'error' ? (
                /*
                 * ⚠️ Kaçış kapısı ŞART: kapak açılamazsa tur asla bitmez,
                 * `cevapGonder` hiç çalışmaz ve oyuncu sonsuza kadar donar.
                 */
                <Kutu tone="bad">
                  <p style={{ margin: 0 }}>Bu kapak açılamadı.</p>
                  <button
                    type="button"
                    onClick={() => cevapGonder({ won: false, maliyet: KAPAK_ADIM, ikincil: 0 })}
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
                  {kural}
                  <div className="nk-kapak-kare" style={{ width: '100%', margin: '0 auto' }}>
                    <KapakKare ref={kare} ar={tur.kapakAr} adim={adim} bitti={false} reduce={reduce} />
                  </div>

                  <div style={{ width: '100%' }}>
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

                  <GuessLog
                    steps={steps}
                    hakToplam={KAPAK_ADIM - 1}
                    hakKalan={kapakKalanHak(adim)}
                    yakinlikEtiketi={kolay ? null : 'sanatçı doğru'}
                  />

                  <button type="button" onClick={tur.pas} disabled={!canli} style={GECBUTON}>
                    Geç{' '}
                    <span style={{ color: '#8a7448' }}>
                      {adim < KAPAK_ADIM - 1 ? '→ daha net' : '→ son hak'}
                    </span>
                  </button>
                </div>
              ) : (
                <div style={{ ...M, color: '#6a7075' }}>kapak hazırlanıyor…</div>
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
