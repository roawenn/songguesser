'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Rota düzeyinde hata sınırı.
 *
 * ⚠️ Bu dosya eklenene kadar projede HİÇ error boundary yoktu: render
 * sırasındaki herhangi bir throw (örn. bozuk bir kayıttan gelen TypeError)
 * React ağacının tamamını düşürüyor ve oyuncuya BEYAZ EKRAN bırakıyordu.
 * Oyuncuların "çöktü" dediği şeyin bir kısmı buydu. Artık hata en azından
 * kendini söylüyor ve tek tıkla toparlanma şansı veriyor.
 *
 * ⚠️ `reset()` aynı rotayı yeniden RENDER eder, sayfayı yenilemez. Hata
 * geçiciyse (yarış, bir kerelik bozuk kayıt) oyun kaldığı yerden sürer.
 */
export default function Hata({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Üretimde Vercel'in sunucu günlüğüne düşer; `digest` ile eşleştirilebilir.
    console.error('[hata sınırı]', error)
  }, [error])

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center">
      <h1 className="font-serif text-3xl text-ink-0">Bir şeyler ters gitti</h1>

      <p className="mt-4 text-ink-2 leading-relaxed">
        Beklenmedik bir hata oldu. Tekrar denemek çoğu zaman yetiyor; sürerse ana sayfadan
        yeniden başlayabilirsin.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink-0 px-5 py-2 text-sm text-shell-2 transition-opacity hover:opacity-85"
        >
          Tekrar dene
        </button>
        <Link
          href="/"
          className="rounded-full border border-ink-3/40 px-5 py-2 text-sm text-ink-2 transition-colors hover:text-ink-0"
        >
          Ana sayfaya dön
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[.14em] text-ink-3">
          hata kodu: {error.digest}
        </p>
      )}
    </main>
  )
}
