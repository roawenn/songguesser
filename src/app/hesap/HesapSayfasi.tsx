'use client'

import Link from 'next/link'
import { useState } from 'react'
import { girisAdresi, useHesap } from '@/hooks/useHesap'
import { HarfAvatari } from '@/components/hesap/HesapDugmesi'

/**
 * Hesap sayfası: ad, çıkış, hesabı silme.
 *
 * ⚠️ AD FORMU YOK. Ad Google profilinden geliyor (bkz.
 * `api/giris/google/donus`); burada yalnızca gösteriliyor. Eskiden burada
 * zorunlu bir "kullanıcı adı seç" adımı vardı ve giriş akışı oyuncuyu araya
 * sıkışan bir forma düşürüyordu.
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
  const { yuklendi, girisAcik, kullanici } = useHesap()
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)
  const [silOnay, setSilOnay] = useState(false)

  if (!yuklendi) return <p className="mt-8 text-ink-3">Yükleniyor…</p>

  if (!kullanici) {
    return (
      <div className={KUTU}>
        <p className="text-ink-2 leading-relaxed">
          İstatistiklerinin cihazdan bağımsız saklanması ve günlük sıralamada yer alman için Google
          hesabınla giriş yap. E-posta adresin ve Google profilindeki adın saklanır; adın yalnızca
          sana gösterilir, başka oyuncular göremez. Profil fotoğrafın alınmaz.
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

  return (
    <>
      <div className={`${KUTU} flex items-center gap-4`}>
        <HarfAvatari ad={kullanici.ad ?? kullanici.email} boyut={44} />
        <div className="min-w-0">
          <div className="text-lg text-ink-0">{kullanici.ad ?? 'Adsız hesap'}</div>
          <div className="truncate text-sm text-ink-3">{kullanici.email}</div>
        </div>
      </div>

      <div className={KUTU}>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Adın</div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {kullanici.ad
            ? 'Adın Google hesabından geliyor. Değiştirmek için Google hesabındaki adını düzelt, sonra çıkıp tekrar giriş yap.'
            : 'Bu hesapta görünen bir ad yok, bu yüzden günlük sıralamada yer almıyorsun. Google hesabındaki adını düzeltip tekrar giriş yapabilirsin.'}
        </p>
        <p className="mt-2 text-sm text-ink-3">Adını yalnızca sen görüyorsun; sıralamada diğer oyunculara gösterilmez.</p>
      </div>

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
              Hesabın, adın, istatistiklerin ve sıralamadaki bütün sonuçların kalıcı olarak silinir. Bu geri alınamaz.
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

      {hata && <p className="mt-4 text-sm text-[#d09a9a]" role="alert">{hata}</p>}

      <p className="mt-6 text-sm text-ink-3">
        <Link href="/gizlilik" className="underline underline-offset-4">Gizlilik ve KVKK aydınlatma metni</Link>
      </p>
    </>
  )
}
