'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DUELLO_TUR, kodAyikla, type DuelloSkor } from '@/game/duel'
import type { DuelloApi } from '@/hooks/useDuello'

/**
 * İki düellonun paylaştığı ekranlar.
 *
 * ⚠️ Bunların hiçbiri OYUNA BAĞLI değil: lobi kodu, geri sayım, skor şeridi,
 * bekleme ve bitiş tablosu protokolün parçası. `DuelloShell`'de kalsalardı
 * ünlü düellosu 300 satır kopya isterdi ve iki kopya zamanla ayrışırdı.
 *
 * Oyuna bağlı KALAN tek şey, bitiş ekranındaki listenin nasıl yazıldığı ve
 * maliyetin nasıl okunduğu — ikisi de prop.
 */

export const M = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
}

export const KART = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
  padding: 26,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.02)',
  width: '100%',
}

/** Lobi ve bekleme ekranlarının üstündeki marka. */
export function Marka() {
  return (
    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 30,
        lineHeight: 1,
        color: '#f2f4f5',
        textShadow: '0 0 28px var(--accSoft)',
      }}
    >
      tahmin
    </div>
  )
}

export function Lobi({ kod }: { kod: string }) {
  const [kopyalandi, setKopyalandi] = useState(false)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/duello/${kod}`

  useEffect(() => {
    if (!kopyalandi) return
    const id = setTimeout(() => setKopyalandi(false), 2200)
    return () => clearTimeout(id)
  }, [kopyalandi])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        width: '100%',
        maxWidth: 460,
      }}
    >
      <Marka />

      <div style={{ ...KART, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ ...M, color: '#6a7075' }}>Lobi kodu</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 46,
            letterSpacing: '.22em',
            color: 'var(--acc)',
            textShadow: '0 0 30px var(--accSoft)',
          }}
        >
          {kod}
        </div>

        <p style={{ margin: 0, fontSize: 14, color: '#b6bbbf', lineHeight: 1.6 }}>
          Bu bağlantıyı ya da kodu arkadaşına gönder. O girdiği anda ikiniz aynı
          beş turu kolaydan zora oynamaya başlayacaksınız.
        </p>

        {/*
          ⚠️ Panoya kopyalama BURADA zorunlu. Düellonun tek işe yarama yolu linki
          birine göndermek; paylaşım düğmeleri kaldırıldığı için başka çıkış yok.
        */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(link)
              .then(() => setKopyalandi(true))
              .catch(() => setKopyalandi(false))
          }}
          style={{
            ...M,
            padding: '12px 22px',
            borderRadius: 5,
            border: '1px solid var(--acc)',
            background: 'oklch(0.81 0.12 var(--hue) / 0.12)',
            color: 'var(--acc)',
          }}
        >
          {kopyalandi ? 'kopyalandı ✓' : 'bağlantıyı kopyala'}
        </button>

        <div style={{ ...M, color: '#6a7075', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--acc)',
              animation: 'nk-flick 1.4s ease-in-out infinite',
            }}
          />
          arkadaşın bekleniyor
        </div>
      </div>

      <LobiyeBaglan mevcut={kod} />
    </div>
  )
}

/**
 * Başkasının lobisine kodla bağlan.
 *
 * Arkadaş bağlantı yerine yalnızca kodu gönderdiyse kod tek başına bir işe
 * yaramıyordu: girilecek bir yer yoktu.
 *
 * ⚠️ Gitmeden ÖNCE lobi gizli anahtarsız okunuyor. Bu okuma kimseyi lobiye
 * katmıyor (katılma yalnızca düello sayfasının yoklamasında, `katil` ucu ile).
 * Böylece yanlış, süresi dolmuş ya da dolu bir kod kişiyi kendi lobisinden
 * koparıp bir hata sayfasına atmıyor; hata burada, kartın içinde görünüyor.
 */
function LobiyeBaglan({ mevcut }: { mevcut: string }) {
  const router = useRouter()
  const [ham, setHam] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  async function baglan(e: FormEvent) {
    e.preventDefault()
    const kod = kodAyikla(ham)
    if (!kod) {
      setHata('Kod 6 karakter olmalı, örneğin Y8Q6S4. Bağlantının tamamını da yapıştırabilirsin.')
      return
    }
    if (kod === mevcut) {
      setHata('Bu zaten senin lobin. Kodu arkadaşına gönder.')
      return
    }

    setHata(null)
    setBekliyor(true)
    try {
      const res = await fetch(`/api/duello/${kod}`)
      const d = (await res.json().catch(() => ({}))) as { error?: string; oyuncuSayisi?: number }
      if (!res.ok) {
        setHata(d.error ?? 'Lobi bulunamadı.')
        setBekliyor(false)
        return
      }
      if ((d.oyuncuSayisi ?? 0) >= 2) {
        setHata('Bu lobi dolu — iki oyuncu da girmiş.')
        setBekliyor(false)
        return
      }
      router.push(`/duello/${kod}`)
    } catch {
      setHata('Bağlanılamadı, tekrar dene.')
      setBekliyor(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void baglan(e)}
      style={{ ...KART, alignItems: 'center', textAlign: 'center', gap: 14 }}
      aria-label="Lobiye bağlan"
    >
      <div style={{ ...M, color: '#6a7075' }}>Lobiye bağlan</div>
      <p style={{ margin: 0, fontSize: 13.5, color: '#9aa0a5', lineHeight: 1.6 }}>
        Arkadaşın sana kod verdiyse buraya yapıştır.
      </p>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <input
          value={ham}
          onChange={(e) => {
            setHam(e.target.value)
            if (hata) setHata(null)
          }}
          placeholder="Y8Q6S4"
          aria-label="Lobi kodu"
          maxLength={80}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '11px 14px',
            borderRadius: 5,
            border: `1px solid ${hata ? 'rgba(208,154,154,0.6)' : 'rgba(255,255,255,0.14)'}`,
            background: 'rgba(0,0,0,0.25)',
            color: '#e6e8ea',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        />
        <button
          type="submit"
          disabled={bekliyor || ham.trim() === ''}
          style={{
            ...M,
            flex: 'none',
            padding: '11px 18px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.05)',
            color: '#dfe2e4',
            opacity: bekliyor || ham.trim() === '' ? 0.5 : 1,
            cursor: bekliyor ? 'progress' : 'pointer',
          }}
        >
          {bekliyor ? 'bakılıyor…' : 'Bağlan'}
        </button>
      </div>
      {hata && (
        <div role="alert" style={{ fontSize: 13, color: '#d09a9a', lineHeight: 1.5 }}>
          {hata}
        </div>
      )}
    </form>
  )
}

export function GeriSayim({ n }: { n: number }) {
  return (
    <div
      role="status"
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 96,
        color: 'var(--acc)',
        textShadow: '0 0 40px var(--accSoft)',
        animation: 'nk-pop .4s cubic-bezier(.34,1.56,.64,1) both',
      }}
      key={n}
    >
      {n}
    </div>
  )
}

export function Kutu({ tone, children }: { tone: 'bad' | 'warn'; children: React.ReactNode }) {
  const c = tone === 'bad' ? '160,90,90' : '201,162,94'
  return (
    <div
      role="status"
      style={{
        padding: '14px 20px',
        borderRadius: 8,
        border: `1px solid rgba(${c},0.35)`,
        background: `rgba(${c},0.07)`,
        color: tone === 'bad' ? '#d09a9a' : '#d5b477',
        fontSize: 13.5,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

/** Tek turun sonucu: bildi · bilemedi · hiç cevaplamadı. */
export function Im({ ok }: { ok: boolean | null }) {
  const [im, renk, ad] =
    ok === null
      ? ['·', '#4e5459', 'cevaplamadı']
      : ok
        ? ['✓', '#5fb87f', 'bildi']
        : ['✕', '#a05a5a', 'bilemedi']
  return (
    <span title={ad} aria-label={ad} style={{ color: renk }}>
      {im}
    </span>
  )
}

export function Skor<T>({ d }: { d: DuelloApi<T> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, ...M }}>
      <span style={{ color: 'var(--acc)' }}>Sen {d.benim.dogru}</span>
      <span style={{ color: '#34393d' }}>—</span>
      <span style={{ color: '#b6bbbf' }}>{d.rakip.dogru} Rakip</span>
      <span style={{ color: '#4e5459' }}>
        {Math.min(d.aktif + 1, DUELLO_TUR)}/{DUELLO_TUR}
      </span>
    </div>
  )
}

/**
 * Beş turu bitirip rakibi bekleme ekranı — düellodaki TEK bekleme noktası.
 *
 * ⚠️ Liste ve kazanan BURADA GÖSTERİLMEZ. İki oyuncu sonucu aynı anda görmeli;
 * erken bitiren kişi cevapları görürse onları dışarıdan (WhatsApp vb.)
 * söyleyebilir. Yalnızca kendi doğru sayısı ve rakibin ilerlemesi var.
 */
export function SonBekleme<T>({ d, birim }: { d: DuelloApi<T>; birim: string }) {
  return (
    <div style={{ ...KART, alignItems: 'center', textAlign: 'center', maxWidth: 420, gap: 18 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: '#e6e8ea' }}>
        Sen bitirdin
      </div>

      <div style={{ ...M, color: '#8c9297' }}>
        {d.benim.dogru}/{DUELLO_TUR} doğru
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, ...M, color: '#6a7075' }}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--acc)',
            animation: 'nk-flick 1.4s ease-in-out infinite',
          }}
        />
        rakibin {d.rakipIlerleme}/{DUELLO_TUR} bitirdi
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6a7075' }}>
        {birim === 'ünlü' ? 'Ünlüler' : 'Şarkılar'} ve kazanan, ikiniz de bitirince
        aynı anda açılacak.
      </p>
    </div>
  )
}

function Satir({
  ad,
  s,
  vurgu,
  maliyetMetni,
}: {
  ad: string
  s: DuelloSkor
  vurgu: boolean
  maliyetMetni: (n: number) => string
}) {
  return (
    <tr style={{ color: vurgu ? 'var(--acc)' : '#b6bbbf' }}>
      <td style={{ textAlign: 'left', padding: '7px 0', ...M }}>{ad}</td>
      <td style={{ textAlign: 'right', padding: '7px 0' }}>
        {s.dogru}/{DUELLO_TUR} doğru
      </td>
      <td style={{ textAlign: 'right', padding: '7px 0', color: '#757b80' }}>
        {maliyetMetni(s.maliyet)}
      </td>
    </tr>
  )
}

export function Bitis<T extends { id: string }>({
  d,
  satir,
  maliyetMetni,
  birim = 'şarkılar',
}: {
  d: DuelloApi<T>
  /** Listedeki bir satır nasıl yazılır. */
  satir: (oge: T) => { ust: string; alt?: string }
  maliyetMetni: (n: number) => string
  birim?: string
}) {
  const baslik =
    d.sonuc === 'sen' ? 'Kazandın' : d.sonuc === 'rakip' ? 'Rakibin kazandı' : 'Berabere'

  return (
    <div style={{ ...KART, alignItems: 'center', textAlign: 'center', maxWidth: 460 }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 40,
          color: d.sonuc === 'sen' ? 'var(--acc)' : '#e6e8ea',
        }}
      >
        {baslik}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <tbody>
          <Satir ad="Sen" s={d.benim} vurgu={d.sonuc === 'sen'} maliyetMetni={maliyetMetni} />
          <Satir ad="Rakip" s={d.rakip} vurgu={d.sonuc === 'rakip'} maliyetMetni={maliyetMetni} />
        </tbody>
      </table>

      {d.rakip.eksik > 0 && (
        <p style={{ margin: 0, ...M, color: '#8a7448' }}>
          rakibin {d.rakip.eksik} turu bitirmedi
        </p>
      )}

      {/* Liste ancak tur bitince açılıyor; oyuncu ne çıktığını burada görür. */}
      {d.songs.length === DUELLO_TUR && (
        <div
          style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}
        >
          <div style={{ ...M, color: '#6a7075', marginBottom: 10 }}>{birim} · sen / rakip</div>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            {d.songs.map((s, i) => {
              const r = satir(s)
              return (
                <li
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left' }}
                >
                  <span style={{ ...M, color: '#4e5459', width: 14, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: '#d7dadd', lineHeight: 1.4 }}>
                    {r.ust}
                    {r.alt && <span style={{ color: '#757b80' }}> · {r.alt}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 13, display: 'inline-flex', gap: 9 }}>
                    <Im ok={d.sonuclar[i]?.benim ?? null} />
                    <Im ok={d.sonuclar[i]?.rakip ?? null} />
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <Rovans d={d} />
    </div>
  )
}

/**
 * Bitiş ekranının alt bloğu: rövanş ve çıkış.
 *
 * ⚠️ Burada "Tek başına oyna" vardı ve arkadaşıyla oynamış birine tuhaf
 * geliyordu: düello biter bitmez oyuncuyu tek kişilik oyuna yolluyordu.
 *
 * ⚠️ TEK EYLEM, İKİ ETİKET. İstek ve kabul ayrı uç noktalar değil: ilk basan
 * yeni lobiyi kurar, ikincisi aynı koda katılır (bkz.
 * `api/duello/[kod]/tekrar`). Bu yüzden düğme aynı işi yapıyor, yalnızca
 * rakip önce davrandıysa metni değişiyor.
 */
function Rovans<T extends { id: string }>({ d }: { d: DuelloApi<T> }) {
  const router = useRouter()
  const [bekliyor, setBekliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const rakipIstedi = d.tekrarKod !== null

  async function tekrar() {
    setBekliyor(true)
    setHata(null)
    const yeni = await d.tekrarIste()
    if (!yeni) {
      setBekliyor(false)
      setHata('Rövanş kurulamadı. Tekrar dene.')
      return
    }
    /*
     * ⚠️ `router.push` — `window.location` DEĞİL. Yeni lobinin gizli anahtarı
     * `localStorage` engelliyse yalnızca bellekte duruyor; tam sayfa yüklemesi
     * onu siler ve oyuncu kendi kurduğu lobiye yabancı olarak düşerdi
     * (bkz. `lib/duelloAnahtar`).
     */
    router.push(`/duello/${yeni}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
      {rakipIstedi && (
        <div style={{ fontSize: 13, color: '#8fc9a3' }}>Rakibin rövanş istiyor.</div>
      )}

      <button
        type="button"
        onClick={tekrar}
        disabled={bekliyor}
        style={{
          padding: '13px 26px',
          borderRadius: 5,
          border: '1px solid var(--acc)',
          background: 'var(--acc)',
          color: '#0a0c0e',
          fontWeight: 600,
          fontSize: 14,
          cursor: bekliyor ? 'default' : 'pointer',
          opacity: bekliyor ? 0.6 : 1,
        }}
      >
        {bekliyor ? 'Hazırlanıyor…' : rakipIstedi ? 'Kabul et, tekrar oyna' : 'Tekrar oyna'}
      </button>

      <Link href="/" style={{ fontSize: 13, color: '#8c9297', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        Ana sayfaya dön
      </Link>

      {hata && <div style={{ fontSize: 12.5, color: '#d09a9a' }}>{hata}</div>}
    </div>
  )
}
