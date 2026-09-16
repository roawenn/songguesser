'use client'

import { useEffect, useMemo, useState } from 'react'
import { yuzdelik, toplamOyuncu, type DagilimSatiri } from '@/game/dagilim'
import { GUNLUK_SIRASI } from '@/game/gunluk'
import { seriHesapla } from '@/game/gunlukGecmis'
import { EN_YUKSEK_PUAN } from '@/game/gunlukPuan'
import type { GunlukApi } from '@/hooks/useGunluk'
import { girisAdresi, useHesap } from '@/hooks/useHesap'
import { useGunlukStore } from '@/store/useGunlukStore'
import { ANA_DUGME, CAPTION, OYUN_ADI, PuanDagilimi, gunEtiketi, sureYaz, useGeriSayim } from './GunlukParcalar'
import { cevapBilgisi } from './GunlukTur'
import { SiraSatiri } from './Liderlik'

/**
 * Seri — girişliyse SUNUCU geçmişinden (cihazlar arasında aynı), değilse
 * yerel geçmişten. Kural tek: `seriHesapla`.
 *
 * `tazele` değişince sunucu geçmişi yeniden okunur (oyun bitince).
 */
export function useSeri(bugun: string | null, tazele?: unknown): { seri: number; enIyi: number } {
  const yerel = useGunlukStore((s) => s.gecmis)
  const { yuklendi, kullanici } = useHesap()
  const [sunucu, setSunucu] = useState<string[] | null>(null)
  const eposta = kullanici?.email ?? null

  useEffect(() => {
    if (!yuklendi || !eposta) {
      setSunucu(null)
      return
    }
    let iptal = false
    void fetch('/api/gunluk/gecmis', { cache: 'no-store' })
      .then((r) => r.json())
      .then((v: { gecmis?: { gun: string }[] | null }) => !iptal && setSunucu(v.gecmis ? v.gecmis.map((g) => g.gun) : null))
      .catch(() => undefined)
    return () => {
      iptal = true
    }
  }, [yuklendi, eposta, tazele])

  return useMemo(() => {
    if (!bugun) return { seri: 0, enIyi: 0 }
    return seriHesapla(sunucu ?? yerel.filter((k) => !k.arsiv).map((k) => k.gun), bugun)
  }, [sunucu, yerel, bugun])
}

/** Gün dönünce durumu yeniden okur — sayfa açık kalan oyuncuya yeni gün gelsin. */
function useGunDonumu(g: GunlukApi) {
  const kalan = useGeriSayim(g.sonrakiGun, g.saatFarki)
  const { yenile } = g
  useEffect(() => {
    if (kalan === 0) {
      // Sunucu saatiyle hizalı gece yarısından hemen sonra; küçük pay.
      const t = setTimeout(yenile, 1500)
      return () => clearTimeout(t)
    }
  }, [kalan, yenile])
  return kalan
}

/**
 * Sıralama durumu satırı.
 *
 * ⚠️ Giriş oyun BAŞLAMADAN yapılmalı (oturum açılışta hesaba bağlanıyor);
 * metin bunu açıkça söylüyor ki oyuncu bitirdikten sonra girip şaşırmasın.
 */
function SiralamaNotu({ kullanicili, bitti }: { kullanicili: boolean | null; bitti: boolean }) {
  const { yuklendi, girisAcik, kullanici } = useHesap()
  if (!yuklendi) return null
  const stil = { margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, color: '#8c9297', textAlign: 'center' as const }
  const bag = { color: 'var(--acc)', textDecoration: 'underline', textUnderlineOffset: 3 }

  if (kullanicili) {
    return kullanici && !kullanici.ad ? (
      <p style={stil}>
        Sonucun kaydedildi. Sıralamada görünmek için <a href="/hesap?ad=sec&donus=/gunluk" style={bag}>kullanıcı adını seç</a>.
      </p>
    ) : (
      <p style={stil}>Sonucun {kullanici?.ad ? <strong style={{ color: '#d5d9dc' }}>{kullanici.ad}</strong> : 'hesabın'} adıyla sıralamaya yazıldı.</p>
    )
  }
  if (kullanici) {
    return bitti ? <p style={stil}>Bu oyun giriş yapmadan başladığı için sıralamaya girmedi. Yarın giriş yapmış olarak başla.</p> : null
  }
  if (!girisAcik) return null
  return (
    <p style={stil}>
      {bitti ? 'Sıralamaya girmek için yarın oyuna başlamadan ' : 'Sıralamaya girmek için başlamadan önce '}
      <a href={girisAdresi()} style={bag}>Google ile giriş yap</a>.
    </p>
  )
}

export function GunlukGiris({ g }: { g: GunlukApi }) {
  const devam = g.gorunum !== null && g.gorunum.turlar.length === 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, maxWidth: 440, textAlign: 'center', padding: '10px 4px' }}>
      {g.gun && <div style={{ ...CAPTION, color: '#8c9297' }}>{gunEtiketi(g.gun)}</div>}
      <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 38, color: '#f2f4f5' }}>
        Günün altı sorusu
      </h2>
      <p style={{ margin: 0, color: '#9aa0a5', fontSize: 14.5, lineHeight: 1.7 }}>
        İki şarkı, iki ünlü, iki albüm kapağı. Bugün herkes aynı soruları çözüyor.
        Ne kadar erken bilirsen o kadar çok puan; hızlı olana bonus.
      </p>
      <ul style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
        {GUNLUK_SIRASI.map((s, i) => (
          <li
            key={i}
            style={{
              width: 46,
              padding: '8px 0',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.10)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: '#a9aeb3',
            }}
          >
            {OYUN_ADI[s.oyun]}
            <div style={{ color: s.zorluk === 'kolay' ? '#8fc9a3' : '#d9a37a', marginTop: 3 }}>{s.zorluk}</div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={devam ? g.sonraki : g.basla} disabled={g.bekliyor} style={{ ...ANA_DUGME, opacity: g.bekliyor ? 0.5 : 1 }}>
        {g.bekliyor ? 'Hazırlanıyor…' : devam ? 'Devam et →' : 'Başla →'}
      </button>
      <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5c6267', lineHeight: 1.7 }}>
        Her gün bir kez oynanır. Süre, her turun görseli ya da klibi geldiğinde başlar.
      </p>
      {!devam && <SiralamaNotu kullanicili={null} bitti={false} />}
    </div>
  )
}

export function GunlukOzet({ g }: { g: GunlukApi }) {
  const gorunum = g.gorunum!
  const puan = gorunum.puan ?? 0
  const [dagilim, setDagilim] = useState<DagilimSatiri[] | null>(null)
  const { seri, enIyi } = useSeri(g.gun, gorunum.puan)
  const kalan = useGunDonumu(g)

  useEffect(() => {
    let iptal = false
    void fetch(`/api/gunluk/dagilim?gun=${gorunum.gun}`)
      .then((r) => r.json())
      .then((v: { dagilim?: DagilimSatiri[] }) => !iptal && setDagilim(v.dagilim ?? []))
      .catch(() => !iptal && setDagilim([]))
    return () => {
      iptal = true
    }
  }, [gorunum.gun])

  const oran = dagilim && !gorunum.zamanAsimi ? yuzdelik(dagilim, puan) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 460 }}>
      <div style={{ ...CAPTION, color: '#8c9297' }}>{gunEtiketi(gorunum.gun)} · bitti</div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 54, lineHeight: 1, color: 'var(--acc)' }}>{puan}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075', marginTop: 6 }}>/ {EN_YUKSEK_PUAN} puan</div>
      </div>

      {gorunum.zamanAsimi ? (
        <p style={{ margin: 0, color: '#c9a25e', fontSize: 13.5, textAlign: 'center' }}>
          Gün bittikten sonra tamamlandığı için bu sonuç sıralamaya girmedi.
        </p>
      ) : oran !== null ? (
        <p style={{ margin: 0, color: '#d5d9dc', fontSize: 15, textAlign: 'center' }}>
          Bugün oynayanların <strong style={{ color: 'var(--acc)' }}>%{oran}</strong>’inden iyisin
        </p>
      ) : dagilim ? (
        <p style={{ margin: 0, color: '#8c9297', fontSize: 13.5, textAlign: 'center' }}>
          Bugünün ilk oyuncularındansın — sıralama birkaç kişi daha oynayınca belirir.
        </p>
      ) : null}

      {!gorunum.zamanAsimi && gorunum.kullanicili && <SiraSatiri tazele={gorunum.puan} />}
      {!gorunum.zamanAsimi && <SiralamaNotu kullanicili={gorunum.kullanicili} bitti />}

      {dagilim && dagilim.length > 0 && (
        <div style={{ width: '100%' }}>
          <PuanDagilimi dagilim={dagilim} puan={gorunum.zamanAsimi ? null : puan} />
          <div style={{ ...CAPTION, textAlign: 'center', marginTop: 8 }}>{toplamOyuncu(dagilim)} oyuncu</div>
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {gorunum.turlar.map((t, i) => {
          const b = cevapBilgisi(t)
          return (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.025)',
                fontSize: 13.5,
              }}
            >
              <span style={{ width: 16, color: t.durum === 'kazandi' ? '#8fc9a3' : '#d09a9a' }} aria-label={t.durum === 'kazandi' ? 'bildin' : 'bilemedin'}>
                {t.durum === 'kazandi' ? '✓' : '✕'}
              </span>
              <span style={{ ...CAPTION, width: 50, flex: 'none' }}>{OYUN_ADI[t.oyun]}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#d5d9dc' }}>
                {b?.ad}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: t.sonuc?.puan ? '#e6e8ea' : '#5c6267' }}>{t.sonuc?.puan ?? 0}</span>
            </li>
          )
        })}
      </ol>

      <div style={{ display: 'flex', gap: 28, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 22, color: '#e6e8ea' }}>{seri}</div>
          <div style={CAPTION}>seri</div>
        </div>
        <div>
          <div style={{ fontSize: 22, color: '#e6e8ea' }}>{enIyi}</div>
          <div style={CAPTION}>en iyi</div>
        </div>
        <div>
          <div style={{ fontSize: 22, color: '#e6e8ea' }}>{kalan === null ? '—' : sureYaz(kalan)}</div>
          <div style={CAPTION}>yeni sorular</div>
        </div>
      </div>
    </div>
  )
}
