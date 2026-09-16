'use client'

import Link from 'next/link'
import { HIZ_BONUSU_EN_COK } from '@/game/gunlukPuan'
import type { GunlukApi } from '@/hooks/useGunluk'
import { Baslik, CAPTION, CARD, TurSeridi, sureYaz, useGeriSayim } from './GunlukParcalar'
import { useSeri } from './GunlukEkranlar'

/** Sol sütun: bugünün ilerlemesi, seri ve geri sayım. */
export function GunlukIlerlemeKarti({ g }: { g: GunlukApi }) {
  const { seri, enIyi } = useSeri(g.gun, g.gorunum?.durum)
  const kalan = useGeriSayim(g.sonrakiGun, g.saatFarki)
  const toplam = g.gorunum?.turlar.reduce((t, k) => t + (k.sonuc?.puan ?? 0), 0) ?? 0

  return (
    <section style={CARD} aria-label={g.arsivGun ? 'Arşiv' : 'Bugün'}>
      <Baslik>{g.arsivGun ? 'Arşiv' : 'Bugün'}</Baslik>
      <TurSeridi gorunum={g.gorunum} aktifIndex={g.aktifIndex} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <div>
          <div style={{ fontSize: 22, color: 'var(--acc)' }}>{toplam}</div>
          <div style={CAPTION}>puan</div>
        </div>
        <div>
          <div style={{ fontSize: 22, color: '#e6e8ea' }}>{seri}</div>
          <div style={CAPTION}>seri</div>
        </div>
        <div>
          <div style={{ fontSize: 22, color: '#e6e8ea' }}>{enIyi}</div>
          <div style={CAPTION}>en iyi</div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7075', textAlign: 'center' }}>
        yeni sorular {kalan === null ? '—' : sureYaz(kalan)} sonra
      </div>
      <Link href="/gunluk/arsiv" style={{ ...CAPTION, textAlign: 'center', color: '#8c9297', textDecoration: 'none' }}>
        geçmiş günler →
      </Link>
    </section>
  )
}

/** Sağ sütun: kurallar. */
export function GunlukNasilKarti() {
  const maddeler = [
    { n: '1', t: 'Altı tur', d: 'İki şarkı, iki ünlü, iki kapak — her çiftte önce kolay, sonra zor.' },
    { n: '2', t: 'Erken bil', d: 'İlk adımda bilmek 100 puan; her açılan adım 20 eksik.' },
    { n: '3', t: 'Hızlı ol', d: `Bildiğin turda ilk 60 saniye içinde en fazla +${HIZ_BONUSU_EN_COK} hız bonusu.` },
    { n: '4', t: 'Günde bir', d: 'Herkes aynı soruları çözer; gece yarısı yenilenir.' },
  ]
  return (
    <section style={CARD} aria-label="Nasıl oynanır">
      <Baslik>Nasıl oynanır</Baslik>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {maddeler.map((s) => (
          <div key={s.n} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
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
              {s.n}
            </span>
            <div>
              <div style={{ fontSize: 13, color: '#d5d9dc' }}>{s.t}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.6, color: '#6a7075', marginTop: 2 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
