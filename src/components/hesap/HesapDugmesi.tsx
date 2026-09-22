'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { adHarfi, adTonu } from '@/text/kullaniciAdi'
import { girisAdresi, useHesap } from '@/hooks/useHesap'

/**
 * Başlığın sağındaki hesap düğmesi: girişsizse "Giriş", girişliyse harf avatarı.
 *
 * ⚠️ GİRİŞ DÜZ BAĞLANTI (`<a href>`): CSP `form-action 'self'` form
 * gönderiminin Google'a yönlenmesini engelliyor (bkz. `api/giris/google`).
 *
 * ⚠️ Mutlak konumlu (`.nk-hesap`): üst bant ölçek bütçesine giriyor, yükseklik
 * eklememeli. Giriş kapalıysa (anahtar yok, önizleme) hiç çizilmez.
 */

const GIRIS_MESAJI: Record<string, string> = {
  hata: 'Giriş yapılamadı. Tekrar dene.',
  iptal: 'Giriş iptal edildi.',
  askida: 'Bu hesap askıya alınmış.',
  'uygunsuz-ad': 'Google hesabındaki ad uygun değil, bu hesapla giriş yapılamıyor. Google’daki ad soyadını değiştirip tekrar dene.',
  kapali: 'Giriş şu an kapalı.',
  'cok-hizli': 'Çok fazla deneme. Biraz bekle.',
}

export function HarfAvatari({ ad, boyut = 30 }: { ad: string; boyut?: number }) {
  const ton = adTonu(ad)
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        placeContent: 'center',
        width: boyut,
        height: boyut,
        borderRadius: '50%',
        background: `oklch(0.42 0.09 ${ton})`,
        border: `1px solid oklch(0.62 0.11 ${ton} / 0.7)`,
        color: '#f2f4f5',
        fontFamily: 'var(--font-sans)',
        fontSize: boyut * 0.44,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {adHarfi(ad)}
    </span>
  )
}

export function HesapDugmesi() {
  const { yuklendi, girisAcik, kullanici } = useHesap()
  const [mesaj, setMesaj] = useState<string | null>(null)

  // Google dönüşünden gelen `?giris=` bildirimi: bir kez göster, adresten sil.
  useEffect(() => {
    const url = new URL(window.location.href)
    const kod = url.searchParams.get('giris')
    if (!kod) return
    setMesaj(GIRIS_MESAJI[kod] ?? null)
    url.searchParams.delete('giris')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    const t = setTimeout(() => setMesaj(null), 6000)
    return () => clearTimeout(t)
  }, [])

  if (!yuklendi || (!girisAcik && !kullanici)) return null

  return (
    <div className="nk-hesap">
      {kullanici ? (
        <Link
          href="/hesap"
          className="nk-hesap-dugme"
          aria-label={kullanici.ad ? `Hesabım: ${kullanici.ad}` : 'Hesabım'}
          title={kullanici.ad ?? 'Hesabım'}
        >
          {/*
            ⚠️ "Ad seç" YAZISI KALKTI: ad artık Google profilinden geliyor,
            seçilecek bir şey yok. Ad yoksa (yönetim sıfırlamışsa) avatar
            e-postanın ilk harfinden türer — düğme boş kalmasın.
          */}
          <HarfAvatari ad={kullanici.ad ?? kullanici.email} />
        </Link>
      ) : (
        <a href={girisAdresi()} className="nk-hesap-dugme nk-hesap-giris">
          <GoogleG />
          <span className="nk-hesap-yazi">Giriş</span>
        </a>
      )}
      {mesaj && (
        <div role="status" className="nk-hesap-mesaj">
          {mesaj}
        </div>
      )}
    </div>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  )
}
