'use client'

import { useGunluk } from '@/hooks/useGunluk'
import { useSettingsStore } from '@/store/useSettingsStore'
import { GunlukGiris, GunlukOzet } from './gunluk/GunlukEkranlar'
import { GunlukIlerlemeKarti, GunlukNasilKarti } from './gunluk/GunlukKartlari'
import { LiderlikKarti } from './gunluk/Liderlik'
import Link from 'next/link'
import { TurSeridi, gunEtiketi } from './gunluk/GunlukParcalar'
import { KapakTuru, SarkiTuru, TurBasligi, TurSonu, UnluTuru } from './gunluk/GunlukTur'
import { SahneCercevesi } from './shell/SahneCercevesi'
import { LinksCard, SettingsCard } from './shell/SidePanels'

/**
 * Günlük modun kabuğu.
 *
 * ⚠️ KATEGORİ YOK: set herkese aynı, `SahneCercevesi` kategori listesini
 * çizmiyor. Renk sabit (kehribar) — günlük, oyunlardan ayrı bir "etkinlik".
 *
 * Sahne durumları: yükleniyor → giriş ("Başla") → tur → tur sonu → … → özet.
 */

const GUNLUK_TON = 62

export function GunlukShell({ arsivGun = null }: { arsivGun?: string | null }) {
  const g = useGunluk(arsivGun)
  const settings = useSettingsStore()
  const { gorunum, aktif, aktifIndex } = g

  const anons = (() => {
    if (!aktif) return ''
    if (gorunum?.durum === 'bitti') return `Günlük bitti. ${gorunum.puan ?? 0} puan.`
    if (aktif.durum === 'kazandi') return `Doğru! ${aktif.sonuc?.puan ?? 0} puan.`
    if (aktif.durum === 'kaybetti') return 'Bilemedin.'
    const son = aktif.steps[aktif.steps.length - 1]
    const bas = son?.kind === 'wrong' ? 'Yanlış.' : son?.kind === 'skip' ? 'Pas geçildi.' : son?.kind === 'hint' ? 'İpucu alındı.' : ''
    return `${bas} ${aktifIndex + 1}. tur. ${aktif.hakKalan} tahmin hakkın kaldı.`.trim()
  })()

  const turSurer = aktif?.durum === 'oynaniyor' && gorunum?.durum === 'oynaniyor'
  const gorselTuru = turSurer && aktif.oyun !== 'sarki'

  return (
    <SahneCercevesi
      hue={GUNLUK_TON}
      reduce={settings.reduce}
      anons={anons}
      aktifOyun="gunluk"
      atif="Şarkı önizlemeleri ve albüm kapakları Apple Music / iTunes aracılığıyla sağlanmaktadır."
      sol={
        <>
          <GunlukIlerlemeKarti g={g} />
          {/* Sol sütun kısa; sıralama buraya sığıyor (sağ sütun ölçek bütçesinin sınırında). */}
          <LiderlikKarti tazele={gorunum?.durum === 'bitti' ? gorunum.puan : null} />
        </>
      }
      sag={
        <>
          <SettingsCard
            volume={settings.volume}
            reduce={settings.reduce}
            easySearch={settings.easySearch}
            onVolume={settings.setVolume}
            onReduce={settings.setReduce}
            onEasySearch={settings.setEasySearch}
          />
          <GunlukNasilKarti />
          <LinksCard />
        </>
      }
      orta={
        <main
          className={`nk-stage nk-gunluk${gorselTuru ? ' nk-unlu nk-kapak' : ''}`}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 18 }}
        >
          {/* Telefonda yan kartlar menüde; ilerleme sahnede de görünsün. */}
          {gorunum && gorunum.turlar.length > 0 && gorunum.durum === 'oynaniyor' && (
            <div className="nk-yalniz-mobil">
              <TurSeridi gorunum={gorunum} aktifIndex={aktifIndex} />
            </div>
          )}

          {arsivGun && (
            <div
              role="status"
              style={{ display: 'flex', gap: 12, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#d5b477' }}
            >
              <span>Arşiv · {gunEtiketi(arsivGun, false)} · sıralamasız</span>
              <Link href="/gunluk" style={{ color: '#8c9297' }}>bugüne dön →</Link>
            </div>
          )}

          {g.arsivYok ? (
            <div role="status" style={{ color: '#8c9297', fontSize: 14, padding: 30, textAlign: 'center', lineHeight: 1.7 }}>
              Bu gün arşivde yok.{' '}
              <Link href="/gunluk/arsiv" style={{ color: 'var(--acc)' }}>Geçmiş günler</Link>
            </div>
          ) : !g.hazir ? (
            <div role="status" style={{ color: '#6a7075', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 40 }}>
              Yükleniyor…
            </div>
          ) : !gorunum || gorunum.turlar.length === 0 ? (
            <GunlukGiris g={g} />
          ) : gorunum.durum === 'bitti' ? (
            <GunlukOzet g={g} />
          ) : aktif && turSurer ? (
            <>
              <TurBasligi tur={aktif} index={aktifIndex} />
              {aktif.oyun === 'sarki' ? (
                <SarkiTuru key={aktif.medyaVerildi} g={g} tur={aktif} />
              ) : aktif.oyun === 'unlu' ? (
                <UnluTuru key={aktif.medyaVerildi} g={g} tur={aktif} />
              ) : (
                <KapakTuru key={aktif.medyaVerildi} g={g} tur={aktif} />
              )}
            </>
          ) : aktif ? (
            // ⚠️ Başlık kartla AYNI kapta: `.nk-stage` dikeyde ortalıyor, ayrı
            // kalsaydı başlık tepede, kart ortada kopuk dururdu.
            <div style={{ marginBlock: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
              <TurBasligi tur={aktif} index={aktifIndex} />
              <TurSonu key={aktifIndex} g={g} tur={aktif} index={aktifIndex} />
            </div>
          ) : null}

          {g.hata && (
            <div role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#d09a9a', textAlign: 'center', maxWidth: 380 }}>
              {g.hata}
            </div>
          )}

          <style>{`
            .nk-pass:hover:not(:disabled) {
              border-color: rgba(201,162,94,0.7) !important;
              color: #e8c98c !important;
              background: rgba(201,162,94,0.14) !important;
            }
          `}</style>
        </main>
      }
    />
  )
}
