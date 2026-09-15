'use client'

import { useEffect, useRef } from 'react'

import { CHIPS, TIERS, type ChipId, type Difficulty } from '@/data/categories'

const MONO_CAPTION = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  color: '#5c6267',
}

/** Kategori başlığı: şeridin ne olduğunu söyler, o yüzden biraz daha okunur. */
const STRIP_TITLE = { ...MONO_CAPTION, fontSize: 10, color: '#767c81' }

/**
 * Marka.
 *
 * Masaüstünde üst bandın TEK öğesi. Mobilde solunda menü düğmesi duruyor
 * (bkz. MobilMenu): ayarlar ve kurallar orada, masaüstünde yan sütunlarda.
 */
export function Header() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px 4px',
        width: '100%',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: '.01em',
          color: '#f2f4f5',
          textShadow: '0 0 28px var(--accSoft)',
          margin: 0,
        }}
      >
        tahmin
      </h1>
    </header>
  )
}

/** Şerit başlıkları — hepsi aynı mono büyük harf dili. */
function StripCaption({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...STRIP_TITLE,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      {children}
      <span style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  )
}

/**
 * Kenar soluklaşması YALNIZCA gerçekten kaydırılabilirken görünmeli.
 * Koşulsuz uygulandığında, şerit tam sığdığı hâlde sondaki çip kırpılmış
 * gibi duruyordu.
 *
 * ⚠️ Ayrı kanca: alt oyun şeridi de aynı davranışı kullanıyor.
 */
export function useKaydirilabilir(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      el.dataset.scrollable = el.scrollWidth > el.clientWidth + 1 ? 'true' : 'false'
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

/**
 * ⚠️ Çipler DIŞARIDAN geliyor, `CHIPS` doğrudan import edilmiyor: ikinci
 * oyunun (ünlü tanıma) kendi seçkileri var ve liste ikisinde de aynı.
 *
 * Kimlik tipi jenerik: şarkı `ChipId`, ünlü `UnluChipId` geçirir ve
 * `onCategory` her ikisinde de doğru tiple gelir.
 */
interface CategoryProps<Id extends string> {
  category: Id
  onCategory: (c: Id) => void
  chips: ReadonlyArray<{ id: Id; label: string; hue: number }>
  baslik?: string
}

/**
 * Seçki şeridi — YALNIZCA MOBİLDE, markanın altında.
 *
 * Masaüstünde kategoriler sol sütunda dikey liste (`KategoriListesi`). Telefonda
 * sütun yok ve yatay kaydırılan şerit en az dikey yer kaplayan biçim.
 *
 * ⚠️ Bizde 11 çip var; tek satıra sığmıyor, bu yüzden yatay kayıyor.
 */
export function CategoryStrip<Id extends string>({
  category,
  onCategory,
  chips,
  baslik = 'Kategoriler',
}: CategoryProps<Id>) {
  const stripRef = useRef<HTMLElement>(null)
  useKaydirilabilir(stripRef)

  return (
    <div
      style={{
        width: '100%',
        padding: '2px 20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 13,
      }}
    >
      {/* Başlık telefonda gizli (globals.css): çipler ne olduklarını söylüyor,
          ilk ekranda 21 px "Geç" düğmesine lazımdı. */}
      <div className="nk-serit-baslik">
        <StripCaption>{baslik}</StripCaption>
      </div>

      <nav
        ref={stripRef}
        className="no-scrollbar nk-strip"
        style={{ maxWidth: '100%', overflowX: 'auto' }}
        aria-label="Seçki"
      >
        <div
          style={{
            display: 'flex',
            gap: 9,
            padding: '4px 2px 6px',
            minWidth: 'max-content',
            justifyContent: 'center',
          }}
        >
          {chips.map((c) => {
            const on = c.id === category
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategory(c.id)}
                aria-pressed={on}
                className="nk-chip"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '11px 19px',
                  border: `1px solid ${on ? 'var(--acc)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 5,
                  background: on
                    ? 'oklch(0.81 0.12 var(--hue) / 0.13)'
                    : 'rgba(255,255,255,0.02)',
                  color: on ? 'var(--acc)' : '#8d9398',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  letterSpacing: '.03em',
                  boxShadow: on ? '0 0 30px -8px var(--accSoft)' : 'none',
                  transition: 'color .15s ease, border-color .15s ease, background .15s ease',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </nav>

      <style>{`
        .nk-chip:hover[aria-pressed='false'] {
          border-color: rgba(255,255,255,0.24) !important;
          color: #cfd3d6 !important;
        }
      `}</style>
    </div>
  )
}

/**
 * Kategoriler — masaüstünde SOL SÜTUNUN başında dikey liste.
 *
 * ⚠️ Üst banttaki yatay şerit masaüstünden kaldırıldı. Sayfa her ekranda
 * yüksekliğe takılıyor ve bant tek başına bütçenin 83 px'ini alıyordu; bu
 * doğrudan küçük metin demekti (1080p'de 13 px → 10 px). Songspot'un zorluk
 * listesi gibi sütunda duruyor.
 *
 * ⚠️ Satır yüksekliği 32 px bir BÜTÇE değeri: şarkıda 11 kategori var ve liste
 * İstatistik kartıyla aynı sütunu paylaşıyor. Satırlar büyürse sol sütun
 * sahnenin ayrılmış yüksekliğini aşar ve ilk tur bitince (istatistik kartı
 * belirince) sayfa yeniden ortalanıp kayar — bkz. `.nk-stage`, globals.css.
 *
 * Her satırdaki nokta kategorinin kendi rengi: seçilince sahnenin alacağı renk
 * önceden görünüyor.
 */
export function KategoriListesi<Id extends string>({
  category,
  onCategory,
  chips,
  baslik = 'Kategoriler',
}: CategoryProps<Id>) {
  return (
    <nav
      aria-label="Seçki"
      style={{
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.018)',
        padding: '16px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          ...MONO_CAPTION,
          padding: '0 6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {baslik}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {chips.map((c) => {
          const on = c.id === category
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategory(c.id)}
              aria-pressed={on}
              className="nk-kategori"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 32,
                padding: '0 12px',
                border: `1px solid ${on ? 'var(--acc)' : 'transparent'}`,
                borderRadius: 5,
                background: on ? 'oklch(0.81 0.12 var(--hue) / 0.12)' : 'transparent',
                color: on ? 'var(--acc)' : '#8d9398',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '.03em',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                transition: 'color .15s ease, border-color .15s ease, background .15s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  flex: 'none',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: `oklch(0.78 0.11 ${c.hue})`,
                  opacity: on ? 1 : 0.55,
                }}
              />
              {c.label}
            </button>
          )
        })}
      </div>

      <style>{`
        .nk-kategori:hover[aria-pressed='false'] {
          background: rgba(255,255,255,0.04) !important;
          color: #cfd3d6 !important;
        }
      `}</style>
    </nav>
  )
}

interface TierProps {
  tier: Difficulty
  onTier: (t: Difficulty) => void
}

/**
 * Zorluk kademesi — sahnenin içinde, ilerleme çubuğunun üstünde.
 *
 * Kategoriyle aynı blokta dururken iki seçim eziliyordu. Zorluk "şu an ne
 * çalınacak" sorusunun parçası, o yüzden oyunun kendisiyle birlikte duruyor.
 *
 * ⚠️ Her kademe kendi rengini taşır ama bu renk SAHNEYİ sürmez — sahne rengi
 * kategoriden gelir. İki bilgi de renkle okunur, çakışmaz.
 */
export function TierStrip({ tier, onTier }: TierProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <span style={MONO_CAPTION}>zorluk</span>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {TIERS.map((t) => {
          const on = t.id === tier
          const color = `oklch(0.81 0.13 ${t.hue})`
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTier(t.id)}
              aria-pressed={on}
              title={t.hint}
              style={{
                padding: '7px 13px',
                border: 0,
                borderRadius: 999,
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                background: on ? `oklch(0.81 0.13 ${t.hue} / 0.16)` : 'transparent',
                color: on ? color : `oklch(0.62 0.07 ${t.hue})`,
                boxShadow: on ? `inset 0 0 0 1px oklch(0.81 0.13 ${t.hue} / 0.4)` : 'none',
                whiteSpace: 'nowrap',
                transition: 'color .15s ease, background .15s ease',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Sayfa altı: yalnızca atıf.
 *
 * Oyun seçici logonun altına, sayfa bağlantıları sağ sütundaki kartına döndü.
 *
 * ⚠️ Atıf OYUNA GÖRE. Apple metni ToS gereği zorunlu ama YALNIZCA ses
 * önizlemesi kullanan oyun için; ünlü sayfasında hiçbir Apple içeriği yok ve
 * orada durması yanıltıcı bir iddia olurdu.
 */
export function Footer({
  atif = 'Ses önizlemeleri Apple Music / iTunes aracılığıyla sağlanmaktadır.',
}: {
  atif?: React.ReactNode
}) {
  return (
    <footer
      style={{
        padding: '0 20px 18px',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        lineHeight: 1.6,
        textAlign: 'center',
        color: '#4e5459',
      }}
    >
      <span>{atif}</span>
    </footer>
  )
}
