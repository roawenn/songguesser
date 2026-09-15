'use client'

import { memo, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'

export interface CassetteHandle {
  /** Yanlış tahminde kaseti sarsar. */
  shake: () => void
}

interface Props {
  categoryLabel: string
  /** Etiketteki kayıt numarası, örn. "NK-014". */
  tapeCode: string
  playing: boolean
  reduce: boolean
  handleRef?: Ref<CassetteHandle>
}

const BAR_COUNT = 18

/** Makara tekeri: 26 dilimli konik gradyan. */
function reelSpokes(from: number): string {
  const stops: string[] = []
  for (let i = 0; i < 26; i++) {
    const a = i * 14
    stops.push(`${i % 2 === 0 ? '#efe9da' : '#cdc6b5'} ${a}deg ${a + 14}deg`)
  }
  return `conic-gradient(from ${from}deg, ${stops.join(', ')})`
}

function Reel({
  innerRef,
  hubInset,
  spokesFrom,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>
  hubInset: string
  spokesFrom: number
}) {
  return (
    <div style={{ position: 'relative', height: '82%', aspectRatio: '1', flex: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 ${hubInset}, #2b2f35 ${hubInset} 100%)`,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 2px 5px rgba(0,0,0,0.5)',
        }}
      />
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          inset: '30%',
          borderRadius: '50%',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.45), inset 0 0 4px rgba(90,75,50,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: reelSpokes(spokesFrom),
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '26%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 42% 36%, #1b1e22, #0d1012)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Sahnenin merkez parçası: kaset.
 *
 * Çal düğmesinin yerini almaz — onunla birlikte çalışır. Klip çalarken
 * makaralar döner ve pencere içindeki çubuklar oynar; klip bitince ikisi de durur.
 *
 * ⚠️ Makara dönüşü ve sarsıntı doğrudan DOM'a yazılır (ref ile), React state'e
 * değil: klip başlayıp bitince tüm ağacın yeniden render edilmesi gereksiz.
 */
function CassetteBase({
  categoryLabel,
  tapeCode,
  playing,
  reduce,
  handleRef,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const reelA = useRef<HTMLDivElement>(null)
  const reelB = useRef<HTMLDivElement>(null)
  /** Dönen rAF'ın kimliği; 0 = döngü duruyor. */
  const rafRef = useRef(0)
  /** Durmuş döngüyü yeniden ateşleyen işlev. */
  const baslatRef = useRef<(() => void) | null>(null)

  // Çalma durumu ref'e yansır: rAF döngüsü her durum değişiminde yeniden
  // kurulmasın, makaranın ivmesi korunsun.
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useImperativeHandle(handleRef, () => ({
    shake() {
      const el = shellRef.current
      if (!el || reduce) return
      el.style.animation = 'none'
      // Yeniden akış zorlamadan aynı animasyon ikinci kez tetiklenmez.
      void el.offsetWidth
      el.style.animation = 'nk-shake .4s ease'
    },
  }))

  /**
   * Makara dönüşü.
   *
   * ⚠️ CSS animasyonu DEĞİL. Önceden `nk-spin 2.6s linear infinite` kullanılıyordu
   * ama klip 0,5 saniye sürünce makara turun yalnızca %19'unu dönüyor ve hareket
   * fark edilmiyordu. Üstelik klip bitince animasyon aniden kesiliyordu — teyp
   * öyle durmaz.
   *
   * Bunun yerine açısal hız rAF içinde hedefe doğru yumuşatılıyor: çalınca
   * hızlanır, bitince serbest bırakılıp yavaşlayarak durur. Kısa kliplerde bile
   * görünür bir hareket olur.
   */
  useEffect(() => {
    if (reduce) {
      for (const ref of [reelA, reelB]) {
        if (ref.current) ref.current.style.transform = ''
      }
      return
    }

    let last = performance.now()
    let angle = 0
    let speed = 0 // derece / ms

    const TARGET = 0.42 // ~0,86 sn / tur: kısa klipte bile yarım turdan fazla
    const SPIN_UP = 0.012
    const SPIN_DOWN = 0.0028 // durma, kalkıştan yavaş: makaranın ataleti

    const tick = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now

      const target = playingRef.current ? TARGET : 0
      const rate = target > speed ? SPIN_UP : SPIN_DOWN
      speed += (target - speed) * Math.min(1, rate * dt)

      if (speed > 0.0008) {
        angle = (angle + speed * dt) % 360
        const css = `rotate(${angle.toFixed(2)}deg)`
        for (const ref of [reelA, reelB]) {
          if (ref.current) ref.current.style.transform = css
        }
      } else if (target === 0) {
        /**
         * ⚠️ Makara durdu: DÖNGÜ DE DURUR.
         *
         * Buranın çıkışı yoktu ve döngü tüm oturum boyunca 60 Hz çalışıyordu.
         * Kare başına yapılan aritmetik önemsiz; asıl maliyet zamanlayıcının
         * kendisi: sürekli planlanmış bir rAF, Chromium'u her vsync'te
         * `BeginFrame` üretmeye ve ana iş parçacığını saniyede 60 kez
         * uyandırmaya zorluyor. Dizüstünde boşta kalmayı engelliyor ve
         * önemsediğimiz her karenin (konfeti dahil) yanında yarışıyor.
         *
         * Yeniden başlatma aşağıdaki `playing` etkisinde.
         */
        speed = 0
        rafRef.current = 0
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    // `last` sıfırlanmadan başlatılırsa durmuş döngü uyanırken kocaman bir
    // `dt` görür ve makara birden fırlar.
    const baslat = () => {
      if (rafRef.current !== 0) return
      last = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }

    baslatRef.current = baslat
    baslat()
    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      baslatRef.current = null
    }
  }, [reduce])

  /** Çalma başlayınca durmuş döngüyü yeniden ateşle. */
  useEffect(() => {
    if (playing && !reduce) baslatRef.current?.()
  }, [playing, reduce])


  // Her çubuğa farklı süre ve gecikme: tek tip nabız yerine canlı bir hareket.
  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => ({
        dur: `${(0.7 + (i % 5) * 0.16).toFixed(2)}s`,
        delay: `${((i % 7) * 0.09).toFixed(2)}s`,
      })),
    [],
  )

  const screw = {
    position: 'absolute' as const,
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 40% 35%, #3d4247, #15181c)',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05)',
  }

  const labelRow = {
    display: 'flex',
    alignItems: 'baseline' as const,
    gap: 9,
    paddingBottom: 5,
  }
  const labelKey = {
    fontFamily: 'var(--font-mono)',
    fontSize: 8.5,
    letterSpacing: '.18em',
    textTransform: 'uppercase' as const,
    color: 'rgba(70,58,40,0.55)',
  }

  return (
    <div
      ref={shellRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 440,
        aspectRatio: '10 / 6.2',
        borderRadius: 8,
        background:
          'linear-gradient(163deg, #2c3137 0%, #1e2227 34%, #14171b 72%, #0f1216 100%)',
        /*
         * ⚠️ Vurgu parıltısının yarıçapı 90px'ten 40px'e indirildi. `--accSoft`
         * içerdiği için kategori geçişinin her karesinde yeniden rasterize
         * ediliyor; 90px'lik bulanıklık 440×273'lük bir kutuda ~620×450'lik iki
         * geçişli bir Gaussian demekti. Görsel fark neredeyse yok.
         */
        boxShadow:
          '0 46px 96px -42px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -2px 4px rgba(0,0,0,0.6), 0 0 40px -20px var(--accSoft)',
      }}
    >
      {/* köşe vidaları */}
      <div style={{ ...screw, top: 8, left: 8 }} />
      <div style={{ ...screw, top: 8, right: 8 }} />
      <div style={{ ...screw, bottom: 8, left: 8 }} />
      <div style={{ ...screw, bottom: 8, right: 8 }} />

      {/* --- kağıt etiket --- */}
      <div
        style={{
          position: 'absolute',
          left: '5.5%',
          right: '5.5%',
          top: '7%',
          height: '51%',
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(168deg, #f4f0e5 0%, #ece6d8 52%, #ddd6c4 100%)',
          boxShadow:
            'inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 -8px 16px rgba(126,106,74,0.16), 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* kağıt lekeleri */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.55,
            background: `
              radial-gradient(52% 60% at 4% 4%, rgba(150,128,92,0.5), rgba(0,0,0,0) 72%),
              radial-gradient(46% 54% at 97% 96%, rgba(140,118,86,0.45), rgba(0,0,0,0) 70%),
              linear-gradient(97deg, rgba(0,0,0,0) 78%, rgba(120,100,70,0.22) 100%)
            `,
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '38%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 13px',
            background: 'var(--acc)',
            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.22)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 17,
              color: 'rgba(12,14,16,0.82)',
            }}
          >
            tahmin
          </span>
          {/*
            ⚠️ textTransform YOK. lang="tr" altında `uppercase` İngilizce
            kelimeleri bozar: "side" → "SİDE". Metin zaten büyük yazılıyor.
          */}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '.26em',
              color: 'rgba(12,14,16,0.6)',
            }}
          >
            SIDE A
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 7,
            padding: '0 13px',
          }}
        >
          <div style={{ ...labelRow, borderBottom: '1px solid rgba(60,50,35,0.28)' }}>
            <span style={labelKey}>seçki</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: 'rgba(34,28,20,0.86)',
              }}
            >
              {categoryLabel}
            </span>
          </div>
          <div style={{ ...labelRow, borderBottom: '1px solid rgba(60,50,35,0.22)' }}>
            <span style={labelKey}>kayıt</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: 'rgba(34,28,20,0.6)',
                letterSpacing: '.12em',
              }}
            >
              {tapeCode}
            </span>
          </div>
        </div>
      </div>

      {/* --- pencere: makaralar + dalga çubukları --- */}
      <div
        style={{
          position: 'absolute',
          left: '11%',
          right: '11%',
          top: '62%',
          height: '24%',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'linear-gradient(#0b0e11, #0e1215)',
          boxShadow:
            'inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 3px 7px rgba(0,0,0,0.75), 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6%',
          }}
        >
          <Reel innerRef={reelA} hubInset="46%" spokesFrom={0} />

          <div
            style={{
              flex: 1,
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 3,
              padding: '0 8px 16%',
              opacity: playing ? 1 : 0.45,
              transition: 'opacity .25s ease',
            }}
          >
            {bars.map((b, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: '62%',
                  borderRadius: 1,
                  transformOrigin: 'bottom',
                  background: 'var(--acc)',
                  opacity: 0.55,
                  animation: reduce ? undefined : `nk-bar ${b.dur} ease-in-out infinite`,
                  animationDelay: b.delay,
                  animationPlayState: playing ? 'running' : 'paused',
                }}
              />
            ))}
          </div>

          {/* Sağ makara daha dolu: bant soldan sağa sarılıyor. */}
          <Reel innerRef={reelB} hubInset="62%" spokesFrom={11} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 2,
            marginTop: -1,
            background: '#1a1d21',
            opacity: 0.9,
          }}
        />
      </div>

      {/* --- alt yuvalar --- */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '4.5%',
          display: 'flex',
          justifyContent: 'center',
          gap: '13%',
        }}
      >
        {['7%', '11%', '7%'].map((w, i) => (
          <div
            key={i}
            style={{
              width: w,
              height: 6,
              borderRadius: 3,
              background: '#0c0f12',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
            }}
          />
        ))}
      </div>

      {/* --- plastik parlaklığı --- */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          pointerEvents: 'none',
          background:
            'linear-gradient(112deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.035) 100%)',
          boxShadow: 'inset 0 0 42px rgba(0,0,0,0.45)',
        }}
      />
    </div>
  )
}

/**
 * ⚠️ `memo` gerekli: `GameShell` ses ayarını da içeren store'a abone, yani
 * ses kaydırıcısı sürüklenirken saniyede onlarca kez render oluyor. Kasetin
 * girdileri (kategori, kayıt numarası, çalıyor mu) o sırada hiç değişmiyor.
 */
export const Cassette = memo(CassetteBase)
