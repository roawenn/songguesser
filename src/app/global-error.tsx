'use client'

/**
 * Kök düzen (`layout.tsx`) render edilirken patlarsa devreye giren son sınır.
 *
 * ⚠️ Kendi `<html>` ve `<body>`'sini basmak ZORUNDA: bu noktada kök düzen
 * çalışmadığı için Next'inki yok. Aynı sebeple Tailwind sınıfına da
 * güvenilmiyor — stil satır içi. Burası neredeyse hiç görülmemeli;
 * gündelik hatalar `error.tsx`'e düşer.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: 24,
          background: '#0a0b0d',
          color: '#e6e8ea',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Bir şeyler ters gitti</h1>
        <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.6, color: '#8c9297' }}>
          Sayfa yüklenirken beklenmedik bir hata oldu.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '10px 20px',
            fontSize: 14,
            cursor: 'pointer',
            background: '#e6e8ea',
            color: '#0a0b0d',
          }}
        >
          Tekrar dene
        </button>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '.14em', color: '#6a7075' }}>
            HATA KODU: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
