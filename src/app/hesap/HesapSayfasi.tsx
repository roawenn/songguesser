'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AD_EN_UZUN, AD_HATA_METNI, adDenetle } from '@/text/kullaniciAdi'
import { donusYolu } from '@/lib/googleKimlik'
import { girisAdresi, useHesap } from '@/hooks/useHesap'
import { HarfAvatari } from '@/components/hesap/HesapDugmesi'

/**
 * Hesap sayfası: kullanıcı adı, çıkış, hesabı silme.
 *
 * Ad denetimi burada ÖN DOĞRULAMA (biçim + kök listesi); asıl karar sunucuda
 * (terlik sözlüğü, benzersizlik, yasaklı adlar).
 */

const KUTU = 'mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-5'
const DUGME = 'rounded-md border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40'

async function gonder(yol: string, yontem: string, govde?: unknown): Promise<{ ok: boolean; veri: { error?: string } }> {
  const res = await fetch(yol, {
    method: yontem,
    headers: govde === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  })
  return { ok: res.ok, veri: await res.json().catch(() => ({})) }
}

export function HesapSayfasi() {
  const { yuklendi, girisAcik, kullanici, yenile } = useHesap()
  const [ad, setAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)
  const [silOnay, setSilOnay] = useState(false)
  const girdi = useRef<HTMLInputElement>(null)

  const adSec = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ad') === 'sec'
  const donus = typeof window !== 'undefined' ? donusYolu(new URLSearchParams(window.location.search).get('donus')) : '/gunluk'

  useEffect(() => {
    if (kullanici?.ad) setAd(kullanici.ad)
    if (kullanici?.adGerekli) girdi.current?.focus()
  }, [kullanici?.ad, kullanici?.adGerekli])

  if (!yuklendi) return <p className="mt-8 text-ink-3">Yükleniyor…</p>

  if (!kullanici) {
    return (
      <div className={KUTU}>
        <p className="text-ink-2 leading-relaxed">
          Günlük sıralamasına girmek için Google hesabınla giriş yap. Yalnızca e-posta adresin ve
          seçtiğin kullanıcı adı saklanır; adın ve fotoğrafın alınmaz.
        </p>
        {girisAcik ? (
          <a href={girisAdresi()} className={`${DUGME} mt-5 inline-block border-white/20 text-ink-0 hover:border-white/40`}>
            Google ile giriş yap
          </a>
        ) : (
          <p className="mt-4 text-sm text-ink-3">Giriş şu an kapalı.</p>
        )}
        <p className="mt-4 text-sm text-ink-3">
          Ayrıntılar: <Link href="/gizlilik" className="underline underline-offset-4">Gizlilik ve KVKK</Link>
        </p>
      </div>
    )
  }

  const onDenetim = ad.trim() ? adDenetle(ad) : null

  async function adKaydet(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setBilgi(null)
    const d = adDenetle(ad)
    if (!d.ok) return setHata(AD_HATA_METNI[d.hata])
    setBekliyor(true)
    const r = await gonder('/api/hesap/ad', 'POST', { ad: d.ad }).catch(() => null)
    setBekliyor(false)
    if (!r) return setHata('Bağlantı kurulamadı.')
    if (!r.ok) return setHata(r.veri.error ?? 'Ad kaydedilemedi.')
    await yenile()
    if (adSec) window.location.assign(donus)
    else setBilgi('Kaydedildi.')
  }

  async function cikis() {
    setBekliyor(true)
    await gonder('/api/cikis', 'POST').catch(() => null)
    window.location.assign('/gunluk')
  }

  async function sil() {
    setBekliyor(true)
    const r = await gonder('/api/hesap', 'DELETE', { onay: true }).catch(() => null)
    setBekliyor(false)
    if (!r?.ok) return setHata(r?.veri.error ?? 'Hesap silinemedi.')
    window.location.assign('/gunluk')
  }

  const kilitliTarih = kullanici.adDegisebilir ? new Date(kullanici.adDegisebilir) : null

  return (
    <>
      <div className={`${KUTU} flex items-center gap-4`}>
        {kullanici.ad ? <HarfAvatari ad={kullanici.ad} boyut={44} /> : null}
        <div className="min-w-0">
          <div className="text-lg text-ink-0">{kullanici.ad ?? 'Kullanıcı adı seçilmedi'}</div>
          <div className="truncate text-sm text-ink-3">{kullanici.email}</div>
        </div>
      </div>

      <form onSubmit={adKaydet} className={KUTU}>
        <label htmlFor="kullanici-adi" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Kullanıcı adı
        </label>
        {kullanici.adGerekli && (
          <p className="mt-2 text-sm text-ink-2">Sıralamada görünecek adını seç. Sonradan 30 günde bir değiştirebilirsin.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            ref={girdi}
            id="kullanici-adi"
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            maxLength={AD_EN_UZUN}
            autoComplete="off"
            spellCheck={false}
            disabled={bekliyor || kilitliTarih !== null}
            className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2.5 text-ink-0 outline-none focus:border-white/40"
            aria-describedby="ad-ipucu"
          />
          <button type="submit" disabled={bekliyor || kilitliTarih !== null || !onDenetim?.ok} className={`${DUGME} border-white/20 text-ink-0`}>
            Kaydet
          </button>
        </div>
        <p id="ad-ipucu" className="mt-2 text-sm text-ink-3" role={hata ? 'alert' : undefined}>
          {hata ? (
            <span className="text-[#d09a9a]">{hata}</span>
          ) : bilgi ? (
            <span className="text-[#8fc9a3]">{bilgi}</span>
          ) : kilitliTarih ? (
            `Adını ${kilitliTarih.toLocaleDateString('tr-TR')} tarihinden sonra değiştirebilirsin.`
          ) : onDenetim && !onDenetim.ok ? (
            AD_HATA_METNI[onDenetim.hata]
          ) : (
            '3-20 karakter: harf, rakam ve alt çizgi.'
          )}
        </p>
      </form>

      <div className={`${KUTU} flex flex-wrap gap-3`}>
        <button type="button" onClick={cikis} disabled={bekliyor} className={`${DUGME} border-white/20 text-ink-1`}>
          Çıkış yap
        </button>
        {!silOnay ? (
          <button type="button" onClick={() => setSilOnay(true)} disabled={bekliyor} className={`${DUGME} border-[#d09a9a]/40 text-[#d09a9a]`}>
            Hesabımı sil
          </button>
        ) : (
          <div className="w-full rounded-md border border-[#d09a9a]/40 p-4">
            <p className="text-sm text-ink-2">
              Hesabın, kullanıcı adın ve sıralamadaki bütün sonuçların kalıcı olarak silinir. Bu geri alınamaz.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={sil} disabled={bekliyor} className={`${DUGME} border-[#d09a9a] text-[#d09a9a]`}>
                Evet, sil
              </button>
              <button type="button" onClick={() => setSilOnay(false)} disabled={bekliyor} className={`${DUGME} border-white/20 text-ink-1`}>
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-ink-3">
        <Link href="/gizlilik" className="underline underline-offset-4">Gizlilik ve KVKK aydınlatma metni</Link>
      </p>
    </>
  )
}
