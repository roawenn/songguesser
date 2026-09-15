'use client'

import { useEffect, type ReactNode } from 'react'
import { Backdrop } from '../stage/Backdrop'
import { Header, CategoryStrip, KategoriListesi, Footer } from './Chrome'
import { MobilMenu } from './MobilMenu'
import { OyunSeridi, type OyunId } from './OyunSeridi'
import { useOlcek } from './useOlcek'
import { olay } from '@/lib/olay'

/**
 * İki oyunun paylaştığı dış iskelet.
 *
 * ⚠️ `DuelloShell.tsx`'in kuralı ("ikinci bir kabuk YAZ, yaprak bileşenleri
 * paylaş") bozulmuyor: bu da bir yaprak — slot alan, oyun durumu tutmayan bir
 * sunum bileşeni. Kabuklar (`GameShell`, `UnluShell`) kendi durumlarını kendi
 * tutmaya devam ediyor.
 *
 * ⚠️ `DuelloShell` bunu KULLANMAZ: onun kendi ortalanmış düzeni var, `.nk-scale`
 * ızgarası yok. Paylaşılan şey ÖLÇÜLMÜŞ bir sabitin (`TASARIM_Y`) tüketicisi;
 * kopyalansaydı ölçek bütçesi sessizce ikiye ayrılırdı.
 */

interface Props {
  /** Sahnenin tek renk değişkeni — seçili kategoriden gelir. */
  hue: number
  reduce: boolean
  /** Ekran okuyucuya turun gidişatını bildiren metin. */
  anons: string

  /**
   * Kategoriler. Kimlik tipi oyuna göre değişir.
   *
   * ⚠️ Çerçeve bunları İKİ yerde çiziyor: masaüstünde sol sütunun başında dikey
   * liste, mobilde markanın altında yatay şerit. Kabuklar kategoriyi `sol`'a
   * koymamalı, yoksa iki kez görünür.
   */
  cipler: ReadonlyArray<{ id: string; label: string; hue: number }>
  secili: string
  onSecki: (id: string) => void

  /** Sol sütun, kategori listesinin ALTINDA: istatistik. */
  sol: ReactNode
  /** Orta sütun — kendi `<main className="nk-stage">`'ini içermeli. */
  orta: ReactNode
  /** Sağ sütun: ayarlar + nasıl oynanır. */
  sag: ReactNode

  /** Oyun seçicide hangi oyun seçili. */
  aktifOyun: OyunId
  /**
   * Sanatçı modu (yalnızca şarkı oyunu). Masaüstünde kategori listesinin başlık
   * satırında, telefonda kategori şeridinin üstünde gösterilir; ✕ ile çıkılır.
   */
  sanatciModu?: { ad: string; kapat: () => void }
  /** Footer'daki atıf metni — oyuna göre değişir. */
  atif?: React.ReactNode
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
  atif,
  sanatciModu,
}: Props) {
  /**
   * ⚠️ Sistemin `prefers-reduced-motion` tercihi KASITLI olarak okunmuyor.
   *
   * Windows'ta "Animasyon efektleri" kapalı olan makinelerde Chrome bunu
   * bildiriyor ve oyunun bütün geri bildirimi tek bayrakla ölüyordu.
   * Kısıtlamak isteyen Ayarlar'dan kapatır.
   */
  useEffect(() => {
    const root = document.documentElement
    if (reduce) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reduce])

  // Orantılı ölçek — bütçe TEK, iki oyunda da aynı; yoksa oyun değiştirince
  // sayfanın tamamı büyüyüp küçülüyor.
  useOlcek()

  /*
   * Seçki değişimi TEK yerden geçiyor (liste ve mobil şerit ikisi de burayı
   * çağırıyor); analitik de burada. Zaten seçili çipe tekrar dokunmak sayılmaz.
   */
  const seckiSec = (id: string) => {
    if (id !== secili) olay('secki_degisti', { oyun: aktifOyun, secki: id })
    onSecki(id)
  }

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
         * Üst bant: masaüstünde YALNIZCA marka.
         *
         * ⚠️ Kategori şeridi masaüstünde buradan çıktı: bant 1210 px'lik
         * yükseklik bütçesinin 178 px'ini alıyordu ve sayfa her ekranda
         * yüksekliğe takıldığı için bu doğrudan küçük metin demekti.
         */}
        <div className="nk-top">
          {/* Yan kartlar mobilde bu menüde: önce ayarlar ve kurallar, sonra istatistik. */}
          <MobilMenu>
            {sag}
            {sol}
          </MobilMenu>
          <Header />
          {/*
            Oyun seçici masaüstünde logonun altında: önce "hangi oyun", sonra
            oyunun kendisi. Telefonda footer'da (aşağıda) — orada üst bant ilk
            ekranı oyundan çalıyordu.
          */}
          <div className="nk-yalniz-masaustu">
            <OyunSeridi aktif={aktifOyun} />
          </div>
          <div className="nk-yalniz-mobil" style={{ width: '100%' }}>
            {sanatciModu && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginBottom: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: 'var(--acc)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Sanatçı · {sanatciModu.ad}
                </span>
                <button
                  type="button"
                  onClick={sanatciModu.kapat}
                  aria-label="Sanatçı modundan çık"
                  style={{
                    flex: 'none',
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'transparent',
                    color: '#b6bbbf',
                    fontSize: 11,
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            <CategoryStrip chips={cipler} category={secili} onCategory={seckiSec} />
          </div>
        </div>

        {/*
          ⚠️ `paddingBottom` YOK. `flex: 1` kalan alanı zaten dolduruyor;
          üstüne binen bir dolgu footer'ı ekranın dışına itiyor ve içerik sığsa
          bile kaydırma çubuğu çıkarıyordu.
        */}
        <div style={{ flex: 1, display: 'flex', width: '100%' }}>
          <div className="nk-center">
            {/* Üç sütun: kategoriler + istatistik · sahne · ayarlar + kurallar. */}
            <div className="nk-stage-grid">
              <div className="nk-side">
                <KategoriListesi
                  chips={cipler}
                  category={secili}
                  onCategory={seckiSec}
                  sanatciModu={sanatciModu}
                />
                {sol}
              </div>
              {orta}
              <div className="nk-side">{sag}</div>
            </div>
          </div>
        </div>

        <Footer
          atif={atif}
          oyunlar={
            <div className="nk-yalniz-mobil" style={{ width: '100%' }}>
              <OyunSeridi aktif={aktifOyun} />
            </div>
          }
        />
      </div>
    </div>
  )
}
