'use client'

import type { Step } from '@/game/machine'

/**
 * Turda yapılmış yanlış tahminler ve kalan hak.
 *
 * ⚠️ Yalnızca YANLIŞ TAHMİNLER listelenir, paslar değil. Sayaç tahmin hakkını
 * gösteriyor; pas geçmek bu haktan yemiyor (merdiveni ilerletiyor), dolayısıyla
 * pasları aynı listeye koymak sayacı yalan söyler hâle getirirdi.
 *
 * ⚠️ Hak sayısı DIŞARIDAN geliyor, `MAX_WRONG`'tan değil. İki oyunun sayısı
 * farklı: şarkıda 3 yanlış hakkı var, ünlüde 4 (beşinci şerit açılınca tur
 * biter). Bileşen kuralı bilmez, yalnızca çizer.
 *
 * ⚠️ Liste, oyuncunun YAZDIĞI ham metni gösterir — normalize edilmiş hâlini
 * değil. "Gulpembe" yazdıysa "gülpembe" değil "Gulpembe" görür; aksi hâlde
 * kendi yazdığını tanıyamaz ve aynı şarkıyı tekrar denemesi kolaylaşır.
 */
/** Bir tahmin satırının yüksekliği (px) — ayrılan yer bununla hesaplanıyor. */
const SATIR = 18
const SATIR_ARA = 4

interface Props {
  steps: readonly Step[]
  /** Turdaki toplam tahmin hakkı. */
  hakToplam: number
  /** Şu an kalan hak. */
  hakKalan: number
  /**
   * Yakınlık rozetinin metni; `null` ise rozet hiç basılmaz.
   *
   * ⚠️ Ünlü oyununda `null` olmalı: orada `Step.sameArtist` hep `false` ama
   * alan paylaşıldığı için duruyor.
   */
  yakinlikEtiketi?: string | null
}

export function GuessLog({ steps, hakToplam, hakKalan, yakinlikEtiketi = null }: Props) {
  const yanlislar = steps.filter((s) => s.kind === 'wrong')

  return (
    /*
     * ⚠️ Genişlik TAHMİN SATIRIYLA aynı olmalı, kendi `maxWidth`'i değil.
     * 430px sabitiyle liste giriş kutusundan dar kalıyor, "Tahminlerin"
     * başlığı kutunun soluyla, "N hak kaldı" da Tahmin düğmesinin sağıyla
     * hizalanmıyordu — aynı bloğun parçası olduğu okunmuyordu.
     */
    <div
      className="nk-tahminler"
      /*
       * Ayrılan yükseklik CSS'e değişkenle veriliyor: mobil düzen onu
       * sıfırlıyor (bkz. globals.css). Orada sayfa zaten kaydırılabilir,
       * dolayısıyla ortalama kaynaklı kayma yok — ama ilk ekranda 62 px
       * altın değerinde.
       */
      style={{
        width: '100%',
        ['--nk-liste-y' as string]: `${hakToplam * SATIR + (hakToplam - 1) * SATIR_ARA}px`,
      }}
      aria-label="Yanlış tahminlerin"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: '#5c6267',
        }}
      >
        <span>Tahminlerin</span>
        <span style={{ color: hakKalan === 0 ? '#c08a8a' : '#5c6267' }}>
          {yanlislar.length === 0 ? `${hakToplam} yanlış hakkın var` : `${hakKalan} hak kaldı`}
        </span>
      </div>

      {/*
        ⚠️ Yükseklik SABİT: `hakToplam` satırlık yer baştan ayrılıyor.

        Liste büyüdükçe sahne de büyüyordu. Sayfa kaydırılabilir değilken
        (uzun pencere) `.nk-center`'ın dikey ortalaması yeniden hesaplanıyor
        ve blok, büyümenin YARISI kadar yukarı kaçıyordu: her tahminden sonra
        kaset, kademe çubuğu ve çal düğmesi yerinden oynuyordu. Ölçüldü:
        2508x1276'da iki tahminde −34 px. Sayfa kaydırılabilirken hiç
        görünmüyordu, bu yüzden ilk turda fark edilmedi.

        Yer baştan ayrılınca sahnenin toplam yüksekliği hiç değişmiyor —
        ne yukarısı ne aşağısı oynuyor.
      */}
      <ul
        style={{
          listStyle: 'none',
          margin: '8px 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: SATIR_ARA,
        }}
      >
        {yanlislar.map((s, i) => (
          <li
            key={`${i}-${s.text}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              // Satır yüksekliği ayrılan yerle BİREBİR aynı olmalı.
              height: SATIR,
              color: '#8d9398',
            }}
          >
            <span aria-hidden style={{ color: '#a05a5a', flex: 'none' }}>
              ✕
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {s.text}
            </span>
            {/* Sanatçıyı tutturmak yakınlığı gösterir; oyuncuya ipucu olsun. */}
            {s.sameArtist && yakinlikEtiketi !== null && (
              <span
                style={{
                  flex: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#6a7075',
                }}
              >
                {yakinlikEtiketi}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
