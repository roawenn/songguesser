'use client'

import { girisAdresi, useHesap } from '@/hooks/useHesap'
import { useIstatistikDurum } from '@/hooks/useIstatistikSenkron'

/**
 * İstatistik kartının paylaşılan parçaları — üç oyun kartı da bunları kullanır.
 *
 * ⚠️ SAYAÇLAR YALNIZCA GİRİŞLİ OYUNCUDA GÖSTERİLİR. Girişsiz oyuncuda da
 * sayılıyorlar (tur bitince depo doluyor) ama çizilmiyorlar: o sayılar hiçbir
 * yere yazılmıyor ve sayfa yenilenince kayboluyor. Yarım bir sayacı gösterip
 * sonra sıfırlanmış hâlde göstermek, hiç göstermemekten daha çok yanıltıyor —
 * zaten tarayıcı deposunun kaldırılma sebebi de buydu (bkz.
 * `store/useStatsStore`).
 */

const CAGRI_BAG = {
  color: 'var(--acc)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
} as const

/**
 * Kart BAŞLIĞINDAKİ metin düğmesi (sıfırla, sil, vazgeç).
 *
 * ⚠️ Her şeyi `inherit` alıyor: başlık satırı mono, küçük ve harf aralıklı;
 * düğme oradan ayrı bir yazı tipiyle çıksa "düğme" gibi değil "yama" gibi
 * görünürdü.
 */
export const BASLIK_DUGME = {
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit' as const,
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
}

/**
 * Kartın ne göstereceği.
 *
 * `misafir`     → giriş çağrısı, sayaç yok
 * `yukleniyor`  → hesaptan okuma sürüyor; yer tutucu
 * `hazir`       → kart kendi sayaçlarını çizebilir
 */
export type IstatistikGorunum = 'misafir' | 'yukleniyor' | 'hazir'

export function useIstatistikGorunum(): IstatistikGorunum {
  const { yuklendi, kullanici } = useHesap()
  const okundu = useIstatistikDurum((s) => s.okundu)
  if (!yuklendi) return 'yukleniyor'
  if (!kullanici) return 'misafir'
  return okundu ? 'hazir' : 'yukleniyor'
}

/**
 * Girişsiz oyuncunun kartın yerinde gördüğü çağrı.
 *
 * ⚠️ Giriş kapalıysa (anahtar yok, önizleme ortamı) hiç çizilmez: yapılamayan
 * bir şeye davet etmenin anlamı yok.
 */
export function IstatistikCagrisi({ stil }: { stil: React.CSSProperties }) {
  const { girisAcik } = useHesap()
  if (!girisAcik) return null
  return (
    <section style={stil} aria-label="İstatistik">
      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#8c9297' }}>
        İstatistiklerin hesabında tutuluyor.{' '}
        <a href={girisAdresi()} style={CAGRI_BAG}>Giriş yap</a>, istatistiklerin hep seninle olsun.
      </div>
    </section>
  )
}

/**
 * Hesaptan okuma sürerken kartın yerini tutan satır.
 *
 * ⚠️ Yer tutucu ŞART. Sayaçlar artık tarayıcıda durmadığı için sayfa her
 * açıldığında kart bir an boş kalıyor; hiçbir şey çizmemek oyuncuya tam da
 * kaçınmak istediğimiz "istatistiklerim gitmiş" anını yaşatırdı.
 */
export function IstatistikYukleniyor({ stil }: { stil: React.CSSProperties }) {
  return (
    <section style={stil} aria-label="İstatistik" aria-busy="true">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075' }}>İstatistikler yükleniyor…</div>
    </section>
  )
}
