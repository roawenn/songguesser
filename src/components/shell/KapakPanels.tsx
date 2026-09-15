'use client'

import { KAPAK_ADIM, KAPAK_BOYUTLARI } from '@/data/kapak'
import { TIER_LABELS, TIERS } from '@/data/categories'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useKapakStatsStore } from '@/store/useKapakStatsStore'

/**
 * Kapaktan Albüm oyununun yan kartları.
 *
 * ⚠️ `UnluPanels.tsx`'in kardeşi. Kartların çerçevesi aynı; içerik oyuna özgü
 * (kolay mod anahtarı, netlik merdiveni, kapak istatistiği deposu). Ünlü
 * kartlarını parametreye boğmak yerine kopya — ~200 satır ve çalışan ünlü
 * kartlarına dokunmuyor.
 */

const CAPTION = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  color: '#5c6267',
}

const CARD = {
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.018)',
  padding: '20px 20px 22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 24,
}

function Baslik({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...CAPTION, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function Anahtar({
  baslik, ipucu, acik, onChange,
}: {
  baslik: string
  ipucu: string
  acik: boolean
  onChange: (b: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#d5d9dc' }}>{baslik}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6, color: '#6a7075', marginTop: 3 }}>
          {ipucu}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={acik}
        aria-label={baslik}
        onClick={() => onChange(!acik)}
        style={{
          flex: 'none',
          width: 38,
          height: 21,
          borderRadius: 11,
          border: `1px solid ${acik ? 'var(--acc)' : 'rgba(255,255,255,0.14)'}`,
          background: acik ? 'oklch(0.81 0.12 var(--hue) / 0.35)' : 'rgba(255,255,255,0.04)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: acik ? 'var(--acc)' : '#6a7075',
            // `left` değil `translateX`: `left` her karede düzen tetikler.
            transform: acik ? 'translateX(17px)' : 'translateX(0)',
            transition: 'transform .18s ease, background .18s ease',
          }}
        />
      </button>
    </div>
  )
}

export function KapakAyarKarti() {
  const kolay = useSettingsStore((s) => s.kapakKolay)
  const setKolay = useSettingsStore((s) => s.setKapakKolay)
  const easySearch = useSettingsStore((s) => s.easySearch)
  const setEasySearch = useSettingsStore((s) => s.setEasySearch)
  const reduce = useSettingsStore((s) => s.reduce)
  const setReduce = useSettingsStore((s) => s.setReduce)

  return (
    <section style={CARD} aria-label="Ayarlar">
      <Baslik>Ayarlar</Baslik>
      {/* ⚠️ Kolay mod EN ÜSTTE: bu oyunun kuralını değiştiren tek ayar. */}
      <Anahtar
        baslik="Kolay mod"
        ipucu={kolay ? 'Sanatçı adı da kabul' : 'Yalnızca albüm adı kabul'}
        acik={kolay}
        onChange={setKolay}
      />
      <Anahtar
        baslik="Kolay arama"
        ipucu="Yazarken öneri listesi çıkar"
        acik={easySearch}
        onChange={setEasySearch}
      />
      <Anahtar
        baslik="Azaltılmış animasyon"
        ipucu="Geçiş, sarsıntı ve konfeti durur"
        acik={reduce}
        onChange={setReduce}
      />
    </section>
  )
}

export function KapakIstatistikKarti() {
  const s = useKapakStatsStore()
  if (s.oynanan === 0) return null

  const isabet = Math.round((s.kazanilan / s.oynanan) * 100)
  const enCok = Math.max(1, ...s.kademeDagilimi)

  return (
    <section style={CARD} aria-label="İstatistik">
      <div style={{ ...CAPTION, display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span>İstatistik</span>
        <span>Bu tarayıcıda</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Kutu buyuk={`%${isabet}`} alt="isabet" vurgu />
        <Kutu buyuk={String(s.oynanan)} alt="tur" />
        <Kutu buyuk={s.enIyiSerit === null ? '—' : `${s.enIyiSerit}/${KAPAK_ADIM}`} alt="en iyi" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {TIERS.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 54, fontSize: 11, color: '#7b8186' }}>{TIER_LABELS[t.id]}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'var(--acc)',
                  transformOrigin: 'left',
                  transform: `scaleX(${(s.kademeDagilimi[i] ?? 0) / enCok})`,
                }}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6a7075', width: 18, textAlign: 'right' }}>
              {s.kademeDagilimi[i] ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', ...CAPTION, fontSize: 9 }}>
        <span>
          {s.seri} seri · rekor {s.enIyiSeri}
        </span>
        <button
          type="button"
          onClick={() => {
            if (confirm('Kapak istatistiklerin sıfırlansın mı?')) s.sifirla()
          }}
          style={{ ...CAPTION, fontSize: 9, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
        >
          sıfırla
        </button>
      </div>
    </section>
  )
}

function Kutu({ buyuk, alt, vurgu = false }: { buyuk: string; alt: string; vurgu?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '10px 6px',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.07)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: vurgu ? 'var(--acc)' : '#d5d9dc' }}>
        {buyuk}
      </div>
      <div style={{ ...CAPTION, fontSize: 8.5, marginTop: 3 }}>{alt}</div>
    </div>
  )
}

export function KapakNasilKarti() {
  return (
    <section style={CARD} aria-label="Nasıl oynanır">
      <Baslik>Nasıl oynanır</Baslik>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {[
          { n: '1', t: 'Bak', d: 'Kapak 8×8 pikselle başlar. Tanıdın mı?' },
          { n: '2', t: 'Yaz', d: `Albümün adını yaz. ${KAPAK_ADIM - 1} yanlış hakkın var.` },
          { n: '3', t: 'Geç', d: 'Bilemediysen pas geç; kapak biraz daha netleşir.' },
        ].map((x) => (
          <div key={x.n} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span
              style={{
                flex: 'none',
                width: 20,
                height: 20,
                borderRadius: 4,
                display: 'grid',
                placeContent: 'center',
                border: '1px solid var(--acc)',
                color: 'var(--acc)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
              }}
            >
              {x.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#d5d9dc' }}>{x.t}</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: '#7b8186', marginTop: 2 }}>{x.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={CAPTION}>Netlik</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8d9398' }}>
          {KAPAK_BOYUTLARI.map((b, i) => (
            <span key={b} style={{ display: 'flex', gap: 5 }}>
              {i > 0 && <span style={{ color: '#4e5459' }}>→</span>}
              <span>{i === KAPAK_BOYUTLARI.length - 1 ? 'net' : b}</span>
            </span>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#7b8186' }}>
        Kolay mod açıkken sanatçının adı da kabul edilir. &ldquo;- Single&rdquo; gibi ekleri
        yazman gerekmez; Türkçe karakter de şart değil.
      </p>
    </section>
  )
}
