'use client'

import { useEffect, type ReactNode } from 'react'
import { Backdrop } from '../stage/Backdrop'
import { Header, CategoryStrip, Footer } from './Chrome'
import { OyunSeridi } from './OyunSeridi'
import { useOlcek } from './useOlcek'

/**
 * İki oyunun paylaştığı dış iskelet.
 *
 * ⚠️ `DuelloShell.tsx`'in kuralı ("ikinci bir kabuk YAZ, yaprak bileşenleri
 * paylaş") bozulmuyor: bu da bir yaprak — slot alan, oyun durumu tutmayan bir
 * sunum bileşeni. Kabuklar (`GameShell`, `UnluShell`) kendi durumlarını kendi
 * tutmaya devam ediyor.
 *
 * ⚠️ `DuelloShell` bunu KULLANMAZ: onun kendi ortalanmış düzeni var, `.nk-scale`
 * ızgarası yok. Tüketici sayısı iki ve bu yeterli — çünkü paylaşılan şey bir
 * ÖLÇÜLMÜŞ sabitin (`TASARIM_Y`) tüketicisi. Kopyalansaydı alt oyun şeridi iki
 * yerde ayrı bakım isteyecek ve ölçek bütçesi sessizce ikiye ayrılacaktı; ikinci
 * kabuk 1920×1080'de taşardı ve bunu kimse fark etmezdi.
 */

interface Props {
  /** Sahnenin tek renk değişkeni — seçili kategoriden gelir. */
  hue: number
  reduce: boolean
  /** Ekran okuyucuya turun gidişatını bildiren metin. */
  anons: string

  /** Kategori şeridi. Kimlik tipi oyuna göre değişir. */
  cipler: ReadonlyArray<{ id: string; label: string; hue: number }>
  secili: string
  onSecki: (id: string) => void

  /** Sol sütun: ayarlar + istatistik. */
  sol: ReactNode
  /** Orta sütun — kendi `<main className="nk-stage">`'ini içermeli. */
  orta: ReactNode
  /** Sağ sütun: nasıl oynanır + klavye + bağlantılar. */
  sag: ReactNode

  /** Alt şeritte hangi oyun seçili. */
  aktifOyun: 'sarki' | 'unlu'
}

export function SahneCercevesi({
  hue,
  reduce,
  anons,
  cipler,
  secili,
  onSecki,
  sol,
  orta,
  sag,
  aktifOyun,
}: Props) {
  /**
   * ⚠️ Sistemin `prefers-reduced-motion` tercihi KASITLI olarak okunmuyor.
   *
   * Windows'ta "Animasyon efektleri" kapalı olan makinelerde Chrome bunu
   * bildiriyor ve makara dönüşü, konfeti, kart patlaması — oyunun bütün geri
   * bildirimi tek bayrakla ölüyordu. Kısıtlamak isteyen Ayarlar'dan kapatır.
   */
  useEffect(() => {
    const root = document.documentElement
    if (reduce) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reduce])

  // Sahneyi 1920 tasarımına göre orantılı küçültür.
  useOlcek()

  return (
    <div
      className="themed"
      style={{
        ['--hue' as string]: String(hue),
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
        {anons}
      </div>

      {/*
        ⚠️ Ölçek YALNIZCA içeriğe uygulanır, arka plana değil.
        `Backdrop` tam ekran kalmalı; ölçeklenseydi kenarlarda boş bant
        kalırdı. Detay için `useOlcek.ts`.
      */}
      <div
        className="nk-scale"
        style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column' }}
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
          <CategoryStrip chips={cipler} category={secili} onCategory={onSecki} />
        </div>

        {/*
          ⚠️ `paddingBottom` YOK.

          Burada `flex: 1` ile birlikte 176px'lik bir alt dolgu duruyordu.
          `flex: 1` kalan alanı zaten dolduruyor; dolgu onun ÜSTÜNE biniyor ve
          footer'ı ekranın dışına itiyordu. Sonuç: sayfa her zaman tam olarak o
          kadar kayıyordu — içerik sığsa bile kaydırma çubuğu çıkıyordu.
        */}
        <div style={{ flex: 1, display: 'flex', width: '100%' }}>
          <div className="nk-center">
            {/* Üç sütun: ayarlar · sahne · kurallar. */}
            <div className="nk-stage-grid">
              <div className="nk-side">{sol}</div>
              {orta}
              <div className="nk-side">{sag}</div>
            </div>
          </div>
        </div>

        <Footer oyunlar={<OyunSeridi aktif={aktifOyun} />} />
      </div>
    </div>
  )
}
