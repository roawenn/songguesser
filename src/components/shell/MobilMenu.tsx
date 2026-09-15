'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Mobil menü — 900 px altında yan kartların yeri.
 *
 * ⚠️ Kartlar eskiden oyunun ALTINA diziliyordu: sayfa ~1950 px uzuyordu ve
 * ünlü oyununda "Geç" hiçbir telefonda ilk ekrana sığmıyordu (390×750'de
 * 889 px). Songspot'taki gibi köşede bir düğme ve alttan açılan bir panel.
 *
 * ⚠️ İçerik YALNIZCA açıkken bağlanıyor. Aynı kartlar masaüstü sütunlarında
 * zaten bağlı (mobilde CSS ile gizli); panel kapalıyken ikinci bir kopyayı da
 * bağlı tutmak istatistik ve ayar kartlarını boşuna iki kez çizerdi.
 *
 * ⚠️ Animasyon yalnızca `transform` ve `opacity` (globals.css) — bu projede
 * boya özelliği animasyonları kare hızını düşürdüğü için kaldırılmıştı.
 */
export function MobilMenu({ children }: { children: ReactNode }) {
  const [acik, setAcik] = useState(false)
  const dugme = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const kapatDugmesi = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!acik) return
    const acan = dugme.current
    const oncekiTasma = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    kapatDugmesi.current?.focus()

    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcik(false)
    }
    // Pencere masaüstü genişliğine büyürse panelin orada karşılığı yok.
    const mq = window.matchMedia('(min-width: 900px)')
    const genisledi = () => {
      if (mq.matches) setAcik(false)
    }

    window.addEventListener('keydown', tus)
    mq.addEventListener('change', genisledi)
    return () => {
      document.body.style.overflow = oncekiTasma
      window.removeEventListener('keydown', tus)
      mq.removeEventListener('change', genisledi)
      // Odak açan düğmeye döner: klavyeyle gezen oyuncu yerini kaybetmesin.
      acan?.focus()
    }
  }, [acik])

  /** Tab paneli terk etmesin — `aria-modal` bunu tarayıcıya bırakmıyor. */
  const odakTuzagi = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return
    const odaklanabilir = panel.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input, [tabindex]:not([tabindex="-1"])',
    )
    if (odaklanabilir.length === 0) return
    const ilk = odaklanabilir[0]!
    const son = odaklanabilir[odaklanabilir.length - 1]!
    if (e.shiftKey && document.activeElement === ilk) {
      e.preventDefault()
      son.focus()
    } else if (!e.shiftKey && document.activeElement === son) {
      e.preventDefault()
      ilk.focus()
    }
  }

  return (
    <>
      <button
        ref={dugme}
        type="button"
        className="nk-menu-dugme"
        aria-label="Menü: ayarlar, istatistik ve kurallar"
        aria-expanded={acik}
        aria-controls="nk-menu"
        onClick={() => setAcik(true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {acik && (
        <div className="nk-menu-ortu" onClick={() => setAcik(false)}>
          <div
            id="nk-menu"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menü"
            className="nk-menu-panel"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={odakTuzagi}
          >
            <div className="nk-menu-baslik">
              <span>Menü</span>
              <button
                ref={kapatDugmesi}
                type="button"
                className="nk-menu-kapat"
                aria-label="Menüyü kapat"
                onClick={() => setAcik(false)}
              >
                ✕
              </button>
            </div>
            <div className="nk-menu-icerik">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
