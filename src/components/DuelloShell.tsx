'use client'

import { sarkiSatiri, type Song } from '@/data/schema'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDuello, type DuelloApi } from '@/hooks/useDuello'
import { useRound } from '@/hooks/useRound'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useStatsStore } from '@/store/useStatsStore'
import { olayBirKez } from '@/lib/olay'
import { chipById, type ChipId } from '@/data/categories'
import { DUELLO_TUR } from '@/game/duel'
import { heardLength, MAX_WRONG, wrongCount } from '@/game/machine'
import { ATTEMPTS, STEPS, tr } from '@/game/ladder'
import { Backdrop } from './stage/Backdrop'
import { Cassette, type CassetteHandle } from './stage/Cassette'
import { StepIndicator } from './stage/StepIndicator'
import { Transport } from './stage/Transport'
import { GuessInput } from './guess/GuessInput'
import {
  Bitis, GeriSayim, Im, KART, Kutu, Lobi, M, Marka, Skor, SonBekleme,
} from './duello/Parcalar'

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
  const d = useDuello<Song>(kod)
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
    const duyulan = heardLength(state.heardIndex, state.ladder)
    /*
     * ⚠️ Düellonun ölçütü artık jenerik: `maliyet` = duyulan saniye,
     * `ikincil` = dinleme sayısı. İstatistik deposu ise hâlâ ses semantiği
     * kullanıyor, o yüzden ikisi ayrı yazılıyor.
     */
    cevapGonder({ won: state.s === 'won', maliyet: duyulan, ikincil: state.listens })
    const turId = `${state.track.id}:${state.s}:${state.steps.length}:${state.listens}`
    kaydet(turId, {
      won: state.s === 'won',
      heardSeconds: duyulan,
      listens: state.listens,
      tier: state.track.d,
    })
    olayBirKez(`duello-sarki:${turId}`, 'tur_bitti', {
      oyun: 'sarki',
      secki: d.chip ?? '',
      zorluk: state.track.d,
      sonuc: state.s === 'won' ? 'kazandi' : 'kaybetti',
      adim: state.steps.length,
      duello: true,
    })
  }, [state, cevapGonder, kaydet, d.chip])

  /*
   * ⚠️ Sahne rengi LOBİNİN çipinden, yerel ayardan DEĞİL.
   *
   * Eskiden `chipById(settings.category)` okunuyordu: davet linkine tıklayan
   * arkadaş, düello başka bir seçkide olsa bile KENDİ son seçtiği seçkinin
   * rengini görüyordu. `useDuello` çipi zaten okuyordu ama dışa vermiyordu.
   */
  const chip = chipById((d.chip as ChipId | null) ?? settings.category)

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
          ← tahmin.in
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
                <Bitis
                  d={d}
                  satir={sarkiSatiri}
                  maliyetMetni={(n) => `${tr(Math.round(n * 10) / 10)} sn`}
                  tekBasinaYol="/"
                />
              ) : d.faz === 'bekleme' ? (
                <SonBekleme d={d} birim="şarkı" />
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
type Duello = DuelloApi<Song>

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
          hakKalan={MAX_WRONG - wrongCount(steps)}
          hakToplam={MAX_WRONG}
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
            disabled={!live || !round.havuzHazir}
            yerTutucu={live && !round.havuzHazir ? 'Liste yükleniyor…' : undefined}
            ambiguous={round.ambiguous}
            onGuess={round.guess}
            onPickAmbiguous={(song) => {
              round.clearAmbiguity()
              round.guessSong(song)
            }}
          satir={sarkiSatiri}
                      />
        </div>

        {/*
          Tahmin listesi yok — tek oyunculu kabukla aynı: tahmin kademe
          çubuğunun baloncuğunda, kalan hak çubuğun sağ üstünde.
        */}
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
        onClick={() => d.cevapGonder({ won: false, maliyet: 0, ikincil: 0 })}
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



