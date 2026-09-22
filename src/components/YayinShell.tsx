'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { clipPlayer } from '@/audio/ClipPlayer'
import { CHIPS, chipById, TIER_LABELS, type ChipId, type Difficulty } from '@/data/categories'
import { artworkAt } from '@/data/schema'
import { STEPS, tr } from '@/game/ladder'
import {
  ADIM_PUANI, BEKLEME_SECENEKLERI, ILK_BILEN_EK, SON_SANS_MS, TUR_SECENEKLERI, siralama, tahminAcik,
  type SkorSatiri,
} from '@/game/yayin'
import { ACILIS_KAPAK_BOYUTU, useYayin, type YayinAyari } from '@/hooks/useYayin'
import type { BaglantiDurumu, Platform } from '@/lib/sohbet/baglanti'
import { olay } from '@/lib/olay'
import { useSettingsStore } from '@/store/useSettingsStore'
import { kanalAdiTemizle } from '@/text/kanal'
import { Backdrop } from './stage/Backdrop'
import { Cassette } from './stage/Cassette'
import { TierStrip } from './shell/Chrome'

/**
 * Yayıncı modu — Twitch ya da Kick sohbetiyle şarkı tahmini.
 *
 * ⚠️ `SahneCercevesi` KULLANILMIYOR: o çerçevenin ölçek bütçesi (`TASARIM_Y`)
 * üç oyunun yan kartlarıyla ölçüldü. Yayın sahnesi yan kart taşımıyor, OBS'te
 * tek başına duruyor; aynı bütçeye girseydi ya oyunları bozardı ya kendisi
 * boşa küçülürdü. Düello sayfasındaki gibi kendi ortalanmış düzeni var.
 *
 * ⚠️ CEVAP EKRANDA METİN OLARAK YAZILMAZ. Yalnızca bilenlerin adı görünür;
 * sohbet mesajlarının içeriği hiçbir yerde çizilmiyor.
 */

const AYAR_ANAHTARI = 'tahmin:yayin-ayar:v1'

interface Taslak {
  platform: Platform
  kanal: string
  secki: ChipId
  zorluk: Difficulty
  turSayisi: number
  beklemeSn: number
}

const VARSAYILAN: Taslak = { platform: 'twitch', kanal: '', secki: 'karisik', zorluk: 1, turSayisi: 10, beklemeSn: 10 }

function taslakOku(): Taslak {
  try {
    const h = JSON.parse(window.localStorage.getItem(AYAR_ANAHTARI) ?? 'null') as Partial<Taslak> | null
    if (!h || typeof h !== 'object') return VARSAYILAN
    return {
      platform: h.platform === 'kick' ? 'kick' : 'twitch',
      kanal: typeof h.kanal === 'string' ? h.kanal.slice(0, 80) : '',
      secki: CHIPS.some((c) => c.id === h.secki) ? (h.secki as ChipId) : 'karisik',
      zorluk: [1, 2, 3, 4, 5].includes(h.zorluk as number) ? (h.zorluk as Difficulty) : 1,
      turSayisi: (TUR_SECENEKLERI as readonly number[]).includes(h.turSayisi as number) ? h.turSayisi! : 10,
      beklemeSn: (BEKLEME_SECENEKLERI as readonly number[]).includes(h.beklemeSn as number) ? h.beklemeSn! : 10,
    }
  } catch {
    return VARSAYILAN
  }
}

function taslakYaz(t: Taslak): void {
  try {
    window.localStorage.setItem(AYAR_ANAHTARI, JSON.stringify(t))
  } catch {
    // Depolama kapalıysa ayarlar bir sonraki açılışta varsayılana döner.
  }
}

/** Geri sayımlar için saat. */
function useSimdi(ms: number): number {
  const [simdi, setSimdi] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setSimdi(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return simdi
}

export function YayinShell() {
  const reduce = useSettingsStore((s) => s.reduce)
  const [ayar, setAyar] = useState<YayinAyari | null>(null)
  const hue = chipById(ayar?.secki ?? 'karisik').hue

  return (
    <div
      className="themed"
      style={{
        ['--hue' as string]: String(hue),
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background: 'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
        color: '#e6e8ea',
      }}
    >
      <Backdrop reduce={reduce} />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          paddingBlock: '22px 40px',
          paddingInline: 'clamp(16px, 3vw, 44px)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 1320, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/" style={{ ...M, color: '#6a7075', textDecoration: 'none' }}>
            ← tahmin.in
          </Link>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: '#eceef0' }}>
            tahmin <span style={{ ...M, fontStyle: 'normal', color: 'var(--acc)' }}>yayın</span>
          </span>
        </div>

        {ayar ? (
          <Sahne ayar={ayar} reduce={reduce} onAyarlar={() => setAyar(null)} />
        ) : (
          <Kurulum onHazir={setAyar} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- kurulum

function Kurulum({ onHazir }: { onHazir: (a: YayinAyari) => void }) {
  const [taslak, setTaslak] = useState<Taslak>(taslakOku)
  const [elleOda, setElleOda] = useState('')
  const [elleGerek, setElleGerek] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  const guncelle = (p: Partial<Taslak>) => setTaslak((t) => ({ ...t, ...p }))

  async function gonder(e: FormEvent) {
    e.preventDefault()
    // ⚠️ Ses kilidi TIKLAMANIN İÇİNDE, aşağıdaki `await`'ten önce açılır.
    clipPlayer.unlockFromGesture()
    setHata(null)

    const kanal = kanalAdiTemizle(taslak.kanal, taslak.platform)
    if (!kanal) {
      setHata('Kanal adı geçersiz. Yalnızca harf, rakam ve alt çizgi' + (taslak.platform === 'kick' ? ' ya da tire.' : '.'))
      return
    }
    taslakYaz(taslak)

    let chatroomId: number | null = null
    if (taslak.platform === 'kick') {
      const elle = Number(elleOda.trim())
      if (elleGerek && Number.isInteger(elle) && elle > 0) {
        chatroomId = elle
      } else {
        setBekliyor(true)
        try {
          const res = await fetch(`/api/yayin/kick/${encodeURIComponent(kanal)}`)
          const d = (await res.json()) as { chatroomId?: number; error?: string; elle?: boolean }
          if (!res.ok || typeof d.chatroomId !== 'number') {
            setHata(d.error ?? 'Kick kanalı bulunamadı.')
            if (d.elle) setElleGerek(true)
            return
          }
          chatroomId = d.chatroomId
        } catch {
          setHata('Kick’e ulaşılamadı.')
          setElleGerek(true)
          return
        } finally {
          setBekliyor(false)
        }
      }
    }

    onHazir({
      platform: taslak.platform,
      kanal,
      chatroomId,
      secki: taslak.secki,
      zorluk: taslak.zorluk,
      turSayisi: taslak.turSayisi,
      beklemeSn: taslak.beklemeSn,
    })
  }

  return (
    <form
      onSubmit={(e) => void gonder(e)}
      style={{ ...KART, width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(34px, 5vw, 46px)', margin: 0, color: '#f1f2f3' }}>
          Yayıncı modu
        </h1>
        <p style={{ margin: '8px 0 0', color: '#9aa0a5', fontSize: 14.5, lineHeight: 1.65 }}>
          İzleyicilerin sohbete şarkının adını yazar. Klip kendiliğinden uzar; erken bilen çok puan alır.
          İlk bilen +{ILK_BILEN_EK} ek puan kazanır, ardından gelen {SON_SANS_MS / 1000} saniyelik son şansta
          bilenler yarım puan alır — sohbetten kopyalamak az kazandırsın diye. Ekranda cevap değil, yalnızca
          bilenlerin adı görünür.
        </p>
      </div>

      <Alan baslik="Platform">
        <Secenekler>
          {(['twitch', 'kick'] as const).map((p) => (
            <Secenek key={p} secili={taslak.platform === p} onClick={() => { guncelle({ platform: p }); setElleGerek(false) }}>
              {p === 'twitch' ? 'Twitch' : 'Kick'}
            </Secenek>
          ))}
        </Secenekler>
      </Alan>

      <Alan baslik="Kanal" aciklama="Kanal adını ya da bağlantısını yapıştır. Hesap gerekmez; sohbet yalnızca okunur.">
        <input
          value={taslak.kanal}
          onChange={(e) => guncelle({ kanal: e.target.value })}
          placeholder={taslak.platform === 'twitch' ? 'twitch.tv/kanaladi' : 'kick.com/kanaladi'}
          aria-label="Kanal adı"
          autoComplete="off"
          spellCheck={false}
          style={GIRDI}
        />
      </Alan>

      {taslak.platform === 'kick' && elleGerek && (
        <Alan
          baslik="Sohbet odası kimliği"
          aciklama="Kick kanal bilgisini sunucumuza vermedi. Tarayıcında kick.com/api/v2/channels/KANALADI adresini aç, “chatroom” içindeki “id” sayısını buraya yaz."
        >
          <input
            value={elleOda}
            onChange={(e) => setElleOda(e.target.value)}
            inputMode="numeric"
            placeholder="örn. 25314085"
            aria-label="Sohbet odası kimliği"
            style={GIRDI}
          />
        </Alan>
      )}

      <Alan baslik="Seçki">
        <Secenekler>
          {CHIPS.map((c) => (
            <Secenek key={c.id} secili={taslak.secki === c.id} onClick={() => guncelle({ secki: c.id })}>
              {c.label}
            </Secenek>
          ))}
        </Secenekler>
      </Alan>

      {/* Başlık `TierStrip`'in içinde ("zorluk"); `Alan` sarmalı iki kez yazdırıyordu. */}
      <div style={{ display: 'flex' }}>
        <TierStrip tier={taslak.zorluk} onTier={(z) => guncelle({ zorluk: z })} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
        <Alan baslik="Tur sayısı">
          <Secenekler>
            {TUR_SECENEKLERI.map((n) => (
              <Secenek key={n} secili={taslak.turSayisi === n} onClick={() => guncelle({ turSayisi: n })}>
                {n}
              </Secenek>
            ))}
          </Secenekler>
        </Alan>
        <Alan baslik="Klipten sonra bekleme" aciklama="Yayın gecikmen yüksekse uzat.">
          <Secenekler>
            {BEKLEME_SECENEKLERI.map((n) => (
              <Secenek key={n} secili={taslak.beklemeSn === n} onClick={() => guncelle({ beklemeSn: n })}>
                {n} sn
              </Secenek>
            ))}
          </Secenekler>
        </Alan>
      </div>

      {hata && (
        <div role="alert" style={{ color: '#d09a9a', fontSize: 14 }}>
          {hata}
        </div>
      )}

      <button type="submit" disabled={bekliyor} style={{ ...ANA_DUGME, padding: '14px 20px', opacity: bekliyor ? 0.5 : 1 }}>
        {bekliyor ? 'kanal aranıyor…' : 'Sohbete bağlan'}
      </button>

      <p style={{ margin: 0, color: '#6f757a', fontSize: 12.5, lineHeight: 1.6 }}>
        OBS: bu sayfayı <b style={{ color: '#9aa0a5' }}>Tarayıcı Kaynağı</b> olarak ekle ve “Etkileşim” penceresinden
        Başlat’a bas; ya da tarayıcı penceresini yakala. Ses tarayıcıdan çalar.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------- sahne

function Sahne({ ayar, reduce, onAyarlar }: { ayar: YayinAyari; reduce: boolean; onAyarlar: () => void }) {
  const y = useYayin(ayar)
  const simdi = useSimdi(200)
  const chip = chipById(ayar.secki)
  const { tur } = y

  const baslat = () => {
    olay('yayin_basladi', { platform: ayar.platform, secki: ayar.secki, zorluk: ayar.zorluk, tur: ayar.turSayisi })
    y.baslat()
  }

  let icerik: ReactNode
  if (y.bitti) {
    icerik = <Final satirlar={siralama(y.skor)} onYeniden={baslat} />
  } else if (y.hata) {
    icerik = (
      <Uyari>
        <p style={{ margin: 0, color: '#d09a9a' }}>{y.hata}</p>
        <button type="button" onClick={baslat} style={{ ...DUGME, marginTop: 14 }}>
          Tekrar dene
        </button>
      </Uyari>
    )
  } else if (y.baslamadi) {
    icerik = (
      <>
        <Cassette categoryLabel={chip.label} tapeCode="YAYIN" playing={false} reduce={reduce} />
        <p style={{ margin: 0, color: '#9aa0a5', textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
          Sohbet bağlantısının “bağlı” olduğunu kontrol et ve hazır olduğunda başlat: her tur{' '}
          {ayar.beklemeSn} saniyelik bekleme aralarıyla {tr(STEPS[0]!)} saniyeden{' '}
          {tr(STEPS[STEPS.length - 1]!)} saniyeye uzar.
        </p>
        <button type="button" onClick={baslat} disabled={!y.havuzHazir} style={{ ...ANA_DUGME, padding: '16px 34px', fontSize: 13, opacity: y.havuzHazir ? 1 : 0.5 }}>
          {y.havuzHazir ? 'Başlat' : 'şarkılar yükleniyor…'}
        </button>
      </>
    )
  } else if (tur.faz === 'acildi' && tur.sarki) {
    const kalan = y.sonrakiBitis ? Math.max(0, Math.ceil((y.sonrakiBitis - simdi) / 1000)) : null
    const son = tur.turNo >= ayar.turSayisi
    icerik = (
      <>
        <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {tur.sarki.ar && (
            <img
              src={artworkAt(tur.sarki.ar, ACILIS_KAPAK_BOYUTU)}
              alt=""
              width={180}
              height={180}
              style={{ borderRadius: 8, boxShadow: '0 18px 50px -20px var(--acc)' }}
            />
          )}
          <div style={{ minWidth: 0, maxWidth: 520, textAlign: 'left' }}>
            <div style={{ ...M, color: tur.bilenler.length ? 'var(--acc)' : '#d09a9a' }}>
              {tur.bilenler.length ? `${tur.bilenler.length} kişi bildi` : 'Kimse bilemedi'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.1, margin: '6px 0', color: '#f1f2f3' }}>
              {tur.sarki.t}
            </div>
            <div style={{ color: '#aeb3b7', fontSize: 17 }}>
              {tur.sarki.a} · {tur.sarki.y}
            </div>
          </div>
        </div>
        <Bilenler bilenler={tur.bilenler} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {kalan !== null && <span style={M}>{son ? 'sonuçlar' : 'sıradaki tur'} {kalan} sn</span>}
          <button type="button" onClick={y.sonraki} style={ANA_DUGME}>
            {son ? 'Sonuçları gör' : 'Sıradaki tur'}
          </button>
        </div>
      </>
    )
  } else {
    const bekleme = tur.faz === 'bekliyor' && tur.beklemeBitis !== null
    const sonSans = tur.sonSansBitis !== null
    const kalanMs = sonSans
      ? tur.sonSansBitis! - simdi
      : bekleme
        ? tur.beklemeBitis! - simdi
        : 0
    const toplamMs = sonSans ? SON_SANS_MS : ayar.beklemeSn * 1000
    icerik = (
      <>
        <Cassette categoryLabel={chip.label} tapeCode={`TUR ${String(tur.turNo).padStart(2, '0')}`} playing={tur.faz === 'caliyor'} reduce={reduce} />
        <Merdiven adim={tur.adim} />
        <div style={{ textAlign: 'center', minHeight: 86 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 3vw, 38px)', color: sonSans ? 'var(--acc)' : '#f1f2f3' }}>
            {tur.faz === 'hazirlaniyor' || tur.faz === 'bos'
              ? 'Şarkı hazırlanıyor…'
              : sonSans
                ? 'İlk doğru geldi! Son şans'
                : tur.faz === 'caliyor'
                  ? `Dinle · ${tr(STEPS[tur.adim]!)} saniye`
                  : 'Sohbete şarkının adını yaz!'}
          </div>
          {(bekleme || sonSans) && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <div style={{ width: 'min(320px, 60vw)', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (kalanMs / toplamMs) * 100))}%`, background: 'var(--acc)', transition: 'width .2s linear' }} />
              </div>
              <span style={{ ...M, color: '#cfd3d6', minWidth: 42 }}>{Math.max(0, Math.ceil(kalanMs / 1000))} sn</span>
            </div>
          )}
        </div>
        <Bilenler bilenler={tur.bilenler} />
      </>
    )
  }

  return (
    <div className="nk-yayin-izgara">
      <main
        style={{
          ...KART,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 22,
          minHeight: 'min(640px, 78vh)',
          paddingBlock: 28,
          paddingInline: 'clamp(16px, 3vw, 36px)',
        }}
      >
        <div style={M}>
          {y.baslamadi || y.bitti ? `${ayar.turSayisi} tur` : `Tur ${tur.turNo} / ${ayar.turSayisi}`} · {chip.label} · {TIER_LABELS[ayar.zorluk]}
        </div>
        {icerik}
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <BaglantiKarti ayar={ayar} durum={y.baglanti.durum} ayrinti={y.baglanti.ayrinti} mesajSayisi={y.mesajSayisi} />

        <section style={KART} aria-label="Liderlik tablosu">
          <div style={{ ...M, marginBottom: 12 }}>Liderlik</div>
          {Object.keys(y.skor).length === 0 ? (
            <p style={{ margin: 0, color: '#7b8186', fontSize: 13.5, lineHeight: 1.6 }}>
              Henüz puan yok. İlk doğru tahmin burada görünür.
            </p>
          ) : (
            <SkorListesi satirlar={siralama(y.skor)} />
          )}
        </section>

        <Kontroller
          tahminAcik={tahminAcik(tur) && !y.bitti}
          oyunda={!y.baslamadi && !y.bitti}
          onAc={y.ac}
          onBitir={y.bitir}
          onAyarlar={onAyarlar}
          onSifirla={() => {
            if (window.confirm('Liderlik tablosu sıfırlansın mı?')) y.skoruSifirla()
          }}
          onDene={y.yerelMesaj}
        />
      </aside>

      <style>{`
        .nk-yayin-izgara {
          width: 100%;
          max-width: 1320px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 22px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .nk-yayin-izgara { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </div>
  )
}

function Merdiven({ adim }: { adim: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: 8, width: '100%', maxWidth: 560 }}>
      {STEPS.map((sn, i) => {
        const simdiki = i === adim
        return (
          <div
            key={i}
            style={{
              paddingBlock: 10,
              paddingInline: 4,
              borderRadius: 6,
              textAlign: 'center',
              border: `1px solid ${simdiki ? 'var(--acc)' : 'rgba(255,255,255,0.1)'}`,
              background: simdiki ? 'oklch(0.81 0.12 var(--hue) / 0.1)' : 'transparent',
              opacity: i < adim ? 0.4 : 1,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: simdiki ? 'var(--acc)' : '#cfd3d6' }}>{tr(sn)} sn</div>
            <div style={{ ...M, fontSize: 9.5, marginTop: 4, letterSpacing: '.08em' }}>{ADIM_PUANI[i]} puan</div>
          </div>
        )
      })}
    </div>
  )
}

function Bilenler({ bilenler }: { bilenler: ReadonlyArray<{ id: string; ad: string; puan: number }> }) {
  if (bilenler.length === 0) return null
  return (
    <ul aria-label="Bu turu bilenler" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 640 }}>
      {bilenler.map((b, i) => (
        <li
          key={b.id}
          style={{
            display: 'inline-flex',
            gap: 8,
            alignItems: 'baseline',
            paddingBlock: 6,
            paddingInline: 12,
            borderRadius: 999,
            border: `1px solid ${i === 0 ? 'var(--acc)' : 'rgba(255,255,255,0.14)'}`,
            background: i === 0 ? 'oklch(0.81 0.12 var(--hue) / 0.1)' : 'rgba(255,255,255,0.03)',
            maxWidth: '100%',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15 }}>{b.ad}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--acc)' }}>+{b.puan}</span>
        </li>
      ))}
    </ul>
  )
}

function SkorListesi({ satirlar, buyuk = false }: { satirlar: SkorSatiri[]; buyuk?: boolean }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {satirlar.map((s, i) => (
        <li
          key={s.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '26px minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 10,
            paddingBlock: buyuk ? 11 : 7,
            paddingInline: buyuk ? 14 : 10,
            borderRadius: 6,
            background: i < 3 ? 'oklch(0.81 0.12 var(--hue) / 0.07)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: buyuk ? 15 : 12.5, color: i < 3 ? 'var(--acc)' : '#6f757a' }}>{i + 1}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: buyuk ? 19 : 14.5 }}>{s.ad}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: buyuk ? 16 : 13, color: '#e6e8ea' }}>{s.puan}</span>
        </li>
      ))}
    </ol>
  )
}

function Final({ satirlar, onYeniden }: { satirlar: SkorSatiri[]; onYeniden: () => void }) {
  return (
    <>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(34px, 4vw, 50px)', margin: 0 }}>
        Oyun bitti
      </h2>
      {satirlar.length === 0 ? (
        <p style={{ margin: 0, color: '#9aa0a5' }}>Bu oyunda kimse puan alamadı.</p>
      ) : (
        <div style={{ width: '100%', maxWidth: 560 }}>
          <SkorListesi satirlar={satirlar} buyuk />
        </div>
      )}
      <button type="button" onClick={onYeniden} style={ANA_DUGME}>
        Yeni oyun başlat
      </button>
    </>
  )
}

const DURUM_METNI: Record<BaglantiDurumu, string> = {
  baglaniyor: 'bağlanıyor…',
  bagli: 'bağlı',
  koptu: 'koptu · yeniden deneniyor',
  hata: 'bağlanamadı',
}

const DURUM_RENGI: Record<BaglantiDurumu, string> = {
  baglaniyor: '#c9a25e',
  bagli: 'oklch(0.8 0.14 150)',
  koptu: '#c9a25e',
  hata: '#d09a9a',
}

function BaglantiKarti({ ayar, durum, ayrinti, mesajSayisi }: { ayar: YayinAyari; durum: BaglantiDurumu; ayrinti?: string; mesajSayisi: number }) {
  return (
    <section style={KART} aria-label="Sohbet bağlantısı">
      <div style={{ ...M, marginBottom: 10 }}>Sohbet</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: DURUM_RENGI[durum] }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15 }}>
          {ayar.platform === 'twitch' ? 'twitch.tv' : 'kick.com'}/{ayar.kanal}
        </span>
      </div>
      <div role="status" style={{ ...M, marginTop: 8, color: DURUM_RENGI[durum], textTransform: 'none', letterSpacing: '.02em', fontSize: 12 }}>
        {DURUM_METNI[durum]}
        {durum === 'bagli' ? ` · ${mesajSayisi} mesaj okundu` : ''}
      </div>
      {ayrinti && <p style={{ margin: '8px 0 0', color: '#d09a9a', fontSize: 13 }}>{ayrinti}</p>}
    </section>
  )
}

function Kontroller({
  tahminAcik: acik, oyunda, onAc, onBitir, onAyarlar, onSifirla, onDene,
}: {
  tahminAcik: boolean
  oyunda: boolean
  onAc: () => void
  onBitir: () => void
  onAyarlar: () => void
  onSifirla: () => void
  onDene: (metin: string) => void
}) {
  const [deneme, setDeneme] = useState('')
  const girdi = useRef<HTMLInputElement>(null)
  return (
    <section style={{ ...KART, display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Yayıncı kontrolleri">
      <div style={M}>Yayıncı</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={onAc} disabled={!acik} style={{ ...DUGME, opacity: acik ? 1 : 0.4 }}>
          Şimdi aç
        </button>
        <button type="button" onClick={onBitir} disabled={!oyunda} style={{ ...DUGME, opacity: oyunda ? 1 : 0.4 }}>
          Oyunu bitir
        </button>
        <button type="button" onClick={onAyarlar} style={DUGME}>
          Ayarlar
        </button>
        <button type="button" onClick={onSifirla} style={DUGME}>
          Skoru sıfırla
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!deneme.trim()) return
          onDene(deneme)
          setDeneme('')
          girdi.current?.focus()
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          ref={girdi}
          value={deneme}
          onChange={(e) => setDeneme(e.target.value)}
          placeholder="Sohbeti dene…"
          aria-label="Sohbeti dene"
          autoComplete="off"
          style={{ ...GIRDI, fontSize: 14, paddingBlock: 9 }}
        />
        <button type="submit" style={DUGME}>
          Yaz
        </button>
      </form>
      <p style={{ margin: 0, color: '#6f757a', fontSize: 12, lineHeight: 1.55 }}>
        Deneme mesajı sohbetten gelmiş gibi işlenir ve puanı “Yayıncı” adına yazılır.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------- parçalar

function Alan({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
      <span style={M}>{baslik}</span>
      {children}
      {aciklama && <span style={{ color: '#7b8186', fontSize: 12.5, lineHeight: 1.55 }}>{aciklama}</span>}
    </div>
  )
}

function Secenekler({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
}

function Secenek({ secili, onClick, children }: { secili: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={secili}
      onClick={onClick}
      style={{
        ...DUGME,
        paddingBlock: 9,
        paddingInline: 14,
        textTransform: 'none',
        letterSpacing: '.02em',
        fontSize: 13,
        borderColor: secili ? 'var(--acc)' : 'rgba(255,255,255,0.14)',
        color: secili ? 'var(--acc)' : '#c3c7ca',
        background: secili ? 'oklch(0.81 0.12 var(--hue) / 0.1)' : 'rgba(255,255,255,0.03)',
      }}
    >
      {children}
    </button>
  )
}

function Uyari({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 420, textAlign: 'center', padding: 18, border: '1px solid rgba(160,90,90,0.35)', borderRadius: 8, background: 'rgba(160,90,90,0.06)' }}>
      {children}
    </div>
  )
}

const M: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: '#7d8388',
}

const KART: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
  padding: '20px 22px',
  minWidth: 0,
}

const DUGME: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '11px 18px',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 5,
  background: 'rgba(255,255,255,0.04)',
  color: '#dfe2e4',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const ANA_DUGME: CSSProperties = {
  ...DUGME,
  borderColor: 'var(--acc)',
  color: 'var(--acc)',
  background: 'oklch(0.81 0.12 var(--hue) / 0.1)',
}

const GIRDI: CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e6e8ea',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
}
