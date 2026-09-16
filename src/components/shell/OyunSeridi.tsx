'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, type MouseEvent } from 'react'
import { kapakHavuzuIsit } from '@/data/loadKapakPool'
import { havuzuIsit } from '@/data/loadPool'
import { unluHavuzuIsit } from '@/data/loadUnluPool'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useKaydirilabilir } from './Chrome'

/**
 * Oyun seçici — segmentli bir anahtar.
 *
 * İKİ yerde çiziliyor, görünürlüğü CSS seçiyor (bkz. `SahneCercevesi`):
 *   - masaüstünde logonun altında, markayla birlikte ("tahmin" → hangi tahmin)
 *   - telefonda footer'da, yatay kaydırılabilir — üst bantta ilk ekranı
 *     oyundan çalıyordu
 *
 * ⚠️ Kaydırma altyapısı (`useKaydirilabilir` + kenar soluklaşması) telefonda
 * gerçekten iş görüyor: iki segment açıklamalarıyla dar ekrana sığmıyor.
 *
 * ⚠️ Masaüstündeki kopyanın YÜKSEKLİĞİ ÖLÇEK BÜTÇESİNE GİRİYOR
 * (`useOlcek.ts`). Dolgu ya da yazı boyutu değişirse `TASARIM_Y` yeniden
 * ölçülmeli.
 */

/** İki oyunun ikonu — dışarıdan ikon paketi çekmemek için elde çizildi. */
function NotaIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M9 18V5.5l10-2V16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function YuzIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      {/* Saç — oyunun ilk açılan şeridi. */}
      <path d="M5 11a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5.6 11v3.2a6.4 6.4 0 0 0 12.8 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 13.4h.01M14.5 13.4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M4 21c1.8-2.4 4.6-3.6 8-3.6s6.2 1.2 8 3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Kapak: pikselden netleşen kare — oyunun kendi mekaniği. */
function KapakIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 9.2h5.7V3.5M9.2 9.2v5.6h5.6v5.7M14.8 14.8h5.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  )
}

/** Günlük: takvim yaprağı — herkese aynı gün. */
function TakvimIkonu() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 14.5h2M13.5 14.5h2M8.5 17.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export const OYUNLAR = [
  {
    id: 'sarki',
    yol: '/',
    ad: 'Şarkı Tahmini',
    aciklama: 'Yarım saniyelik klipten başla',
    Ikon: NotaIkonu,
  },
  {
    id: 'unlu',
    yol: '/unlu',
    ad: 'Ünlü Bilmece',
    aciklama: 'Yalnızca saçından tanı',
    Ikon: YuzIkonu,
  },
  {
    id: 'kapak',
    yol: '/kapak',
    ad: 'Kapaktan Albüm',
    aciklama: 'Pikselden netleşen kapağı tanı',
    Ikon: KapakIkonu,
  },
  {
    id: 'gunluk',
    yol: '/gunluk',
    ad: 'Günlük',
    aciklama: 'Herkese aynı 6 soru',
    Ikon: TakvimIkonu,
  },
] as const

export type OyunId = (typeof OYUNLAR)[number]['id']

/**
 * Yeni oyunun sahnesi en geç bu sürede çizilmezse geçiş yine de tamamlanır.
 *
 * ⚠️ Tarayıcılar güncelleme adımını ~4 sn sonra kendisi iptal ediyor; ondan önce
 * bırakmak, yavaş bağlantıda ekranın donuk kalıp sonra sertçe atlamasını önler.
 */
const HAZIR_ZAMAN_ASIMI = 2500

/**
 * Hedef oyunun kod parçasını ve havuzunu önden ısıtır.
 *
 * ⚠️ Geçiş, yeni sahne çizilene kadar ESKİ görüntüyü tutuyor. Parça ve havuz
 * üzerine gelince inmeye başlarsa tıklandığında çoğu zaman hazır oluyor ve
 * donma hissedilmiyor. Aynı modül yolları `Client*` bileşenlerinin dinamik
 * içe aktarmalarıyla aynı parçaya çözülüyor.
 */
function isit(id: OyunId) {
  const ayar = useSettingsStore.getState()
  if (id === 'sarki') {
    void import('@/components/GameShell').catch(() => {})
    havuzuIsit(ayar.category, ayar.tier)
  } else if (id === 'unlu') {
    void import('@/components/UnluShell').catch(() => {})
    unluHavuzuIsit(ayar.unluCategory)
  } else if (id === 'kapak') {
    void import('@/components/KapakShell').catch(() => {})
    kapakHavuzuIsit(ayar.kapakCategory)
  } else {
    // ⚠️ Açık dal: eskiden son `else` kapaktı ve bilinmeyen her oyun kapağı ısıtıyordu.
    // Havuzlar burada ISITILMAZ — Günlük sayfası tur türüne göre kendisi indiriyor.
    void import('@/components/GunlukShell').catch(() => {})
  }
}

type GecisliBelge = Document & { startViewTransition?: (guncelle: () => Promise<void>) => unknown }

/** Yeni oyunun kabuğu DOM'a geldiğinde çözülür (ya da zaman aşımında). */
function sahneHazir(id: OyunId): Promise<void> {
  const secici = `.themed[data-oyun="${id}"] .nk-stage`
  return new Promise((coz) => {
    if (document.querySelector(secici)) return coz()
    /*
     * ⚠️ `requestAnimationFrame` İLE BEKLENMİYOR: geçişin güncelleme adımında
     * tarayıcı boyamayı askıya alıyor ve rAF geri çağrıları gelmiyor — söz hiç
     * çözülmez, geçiş zaman aşımına kadar donardı. DOM gözlemcisi boyamadan bağımsız.
     */
    const gozcu = new MutationObserver(() => {
      if (document.querySelector(secici)) bitir()
    })
    const zaman = setTimeout(() => bitir(), HAZIR_ZAMAN_ASIMI)
    function bitir() {
      gozcu.disconnect()
      clearTimeout(zaman)
      coz()
    }
    gozcu.observe(document.body, { childList: true, subtree: true })
  })
}

export function OyunSeridi({ aktif }: { aktif: OyunId }) {
  const ref = useRef<HTMLElement>(null)
  useKaydirilabilir(ref)
  const router = useRouter()

  /**
   * Oyunlar arası YUMUŞAK geçiş (View Transitions API).
   *
   * Eskiden tıklama sayfayı önce boş iskelete, sonra yeni oyuna atlatıyordu:
   * her oyun `ssr: false` ile tembel yükleniyor. Artık eski sayfanın görüntüsü,
   * yeni oyunun sahnesi çizilene kadar ekranda tutuluyor ve ikisi arasında
   * çapraz geçiş yapılıyor — iskelet hiç görünmüyor. Marka ve oyun seçici
   * yerinde kalıyor (bkz. globals.css `view-transition-name`).
   *
   * ⚠️ API yoksa (eski tarayıcı) ya da "Azaltılmış animasyon" açıksa normal
   * `Link` gezinmesi olur. Yeni sekmede açma (Ctrl/Cmd/orta tık) bozulmaz.
   */
  function gec(e: MouseEvent<HTMLAnchorElement>, id: OyunId, yol: string) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (id === aktif) {
      e.preventDefault()
      return
    }
    const belge = document as GecisliBelge
    const azaltilmis = document.documentElement.getAttribute('data-motion') === 'reduced'
    if (typeof belge.startViewTransition !== 'function' || azaltilmis) return

    e.preventDefault()
    isit(id)
    belge.startViewTransition(async () => {
      router.push(yol)
      await sahneHazir(id)
    })
  }

  return (
    <>
      <nav
        ref={ref}
        className="no-scrollbar nk-strip"
        style={{ maxWidth: '100%', overflowX: 'auto', flex: 'none' }}
        aria-label="Oyunlar"
      >
        {/*
          Tek çerçeve içinde iki segment: iki ayrı kart değil, TEK bir seçimin
          iki seçeneği olduğu görünsün. Seçili segment sahne renginde dolu.
        */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            minWidth: 'max-content',
            margin: '0 auto',
            width: 'max-content',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {OYUNLAR.map((o) => {
            const on = o.id === aktif
            return (
              <Link
                key={o.id}
                href={o.yol}
                aria-current={on ? 'page' : undefined}
                className="nk-oyun"
                data-on={on ? '1' : undefined}
                onClick={(e) => gec(e, o.id, o.yol)}
                onPointerEnter={() => !on && isit(o.id)}
                onFocus={() => !on && isit(o.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 16px 6px 6px',
                  borderRadius: 9,
                  background: on ? 'oklch(0.81 0.12 var(--hue) / 0.11)' : 'transparent',
                  boxShadow: on ? 'inset 0 0 0 1px oklch(0.81 0.12 var(--hue) / 0.5)' : 'none',
                  textDecoration: 'none',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  /*
                   * ⚠️ Geçiş YALNIZCA seçili olmayanda (üzerine gelme). Seçili
                   * segmentin arka planı `--hue`'dan hesaplanıyor ve `--hue` zaten
                   * kayıyor; üstüne kendi geçişi binince her karede yeniden başlıyordu.
                   */
                  transition: on ? 'none' : 'background .15s ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    display: 'grid',
                    placeContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: on ? 'oklch(0.81 0.12 var(--hue) / 0.16)' : 'rgba(255,255,255,0.04)',
                    color: on ? 'var(--acc)' : '#7b8186',
                  }}
                >
                  <o.Ikon />
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    className="nk-oyun-ad"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: on ? 'var(--acc)' : '#a9aeb3',
                      lineHeight: 1.1,
                    }}
                  >
                    {o.ad}
                  </span>
                  {/*
                    Açıklama BÜYÜK HARF DEĞİL: iki satır da versal olsaydı
                    hangisinin ad hangisinin açıklama olduğu okunmuyordu.
                  */}
                  <span
                    className="nk-oyun-aciklama"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 10.5,
                      color: '#6a7075',
                      lineHeight: 1.25,
                    }}
                  >
                    {o.aciklama}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <style>{`
        .nk-oyun:not([data-on]):hover { background: rgba(255,255,255,0.04) !important; }
        .nk-oyun:not([data-on]):hover .nk-oyun-ad { color: #cfd3d6 !important; }
      `}</style>
    </>
  )
}
