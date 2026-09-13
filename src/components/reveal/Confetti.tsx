'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** 0 = en geç kulvar, 1 = ilk kulvar. Ne kadar erken bildiyse o kadar coşkulu. */
  intensity: number
  reduce: boolean
  /** Patlamanın merkezi — cevap kartı. Yoksa ekran ortası kullanılır. */
  originRef?: RefObject<HTMLElement | null>
}

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vrot: number
  /** Palet indeksi — çizimde renge göre gruplamak için. */
  renk: number
  born: number
  life: number
}

const GRAVITY = 0.0016
const DRAG = 0.9975
const TAU = Math.PI * 2

/**
 * Kutlama patlaması.
 *
 * ⚠️ Parçacıklar kartın MERKEZİNDEN dışarı fırlar. Önceki sürümde okunurluğu
 * korumak için ekranın iki kenarına itilmişlerdi; teknik olarak çalışıyordu ama
 * göz merkeze baktığı için pratikte görünmüyordu. Okunurluk artık hızla
 * çözülüyor: minimum çıkış hızı yüksek, yani hiçbir parçacık metnin üstünde
 * oyalanmıyor.
 *
 * ⚠️ PORTAL ZORUNLU. Sonuç kartının giriş animasyonu `transform` kullanıyor;
 * transform'lu bir ata `position: fixed` için yeni kapsayıcı blok yaratır ve
 * canvas ekranı değil kartı kaplar.
 */
export function Confetti({ intensity, reduce, originRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (reduce || !mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Vurgu rengini CSS'ten çöz: tarayıcı hangi renk uzayını kullanıyorsa
    // canvas da aynısını ayrıştırabilir.
    const probe = document.createElement('span')
    probe.style.cssText = 'color: var(--acc); position:absolute; visibility:hidden'
    const themed = document.querySelector('.themed') ?? document.body
    themed.appendChild(probe)
    const accent = getComputedStyle(probe).color || '#7dd3fc'
    probe.remove()

    /*
     * Vurgu rengi ağırlıklı, kasetin krem tonlarıyla kırılmış bir palet.
     *
     * ⚠️ Renkler ÖNCEDEN sayısal biçime çevriliyor. `fillStyle`'a bir CSS renk
     * METNİ atamak, tarayıcının renk ayrıştırıcısını çalıştırır; palet
     * parçacık başına rastgele seçildiği için Blink'in son-değer önbelleği
     * sürekli ıskalıyordu ve karede ~434 ayrıştırma yapılıyordu. Üstelik
     * `getComputedStyle` vurgu rengini `oklch(...)` olarak döndürüyor, yani en
     * pahalı biçimde. Canvas'a bir kez yazıp geri okumak hepsini `#rrggbb`ye
     * normalleştiriyor.
     */
    const palette = [accent, accent, accent, '#efe9da', '#cdc6b5', '#ffffff'].map((c) => {
      ctx.fillStyle = c
      return ctx.fillStyle as string
    })

    let W = window.innerWidth
    let H = window.innerHeight
    /**
     * ⚠️ Piksel bütçesi, sabit bir çarpan değil.
     *
     * Her kare bütün arka tampon temizleniyor. `min(dpr, 2)` bir 4K HiDPI
     * ekranda 8,3 milyon piksel, yani kare başına 33 MB — GPU rasterizasyonu
     * kapalı makinelerde (eski Intel iGPU'lar, RDP/VM oturumları, SwiftShader)
     * saniyede ~2 GB bellek trafiği. "Bazı sistemlerde takılıyor" tarifinin
     * kaynağı buydu. Konfeti hızla hareket eden, bulanık bir nesne; 4 milyon
     * pikselin üstünde çözünürlük göze hiçbir şey katmıyor.
     */
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, Math.sqrt(4_000_000 / (W * H))))

    const resize = () => {
      // Önceki turda bırakılmış olabilir; katmanı geri getir.
      canvas.style.display = ''
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    // Patlama merkezi: cevap kartı.
    const box = originRef?.current?.getBoundingClientRect()
    const cx = box ? box.left + box.width / 2 : W / 2
    const cy = box ? box.top + box.height / 2 : H / 2

    const pieces: Piece[] = []
    const now0 = performance.now()

    /** Merkezden dışarı, her yöne. */
    function burst(count: number, delay: number, power: number) {
      for (let i = 0; i < count; i++) {
        // Açıyı eşit dağıt, sonra biraz bozarak doğal göster.
        const angle = (i / count) * TAU + (Math.random() - 0.5) * 0.35
        // Yatay biraz daha geniş: kart yatay bir dikdörtgen.
        const speed = power * (0.55 + Math.random() * 0.75)
        pieces.push({
          x: cx + Math.cos(angle) * 6,
          y: cy + Math.sin(angle) * 6,
          vx: Math.cos(angle) * speed * 1.35,
          vy: Math.sin(angle) * speed - 0.22, // hafif yukarı önyargı
          w: 4 + Math.random() * 6,
          h: 8 + Math.random() * 12,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.03,
          renk: Math.floor(Math.random() * palette.length),
          born: now0 + delay,
          life: 1900 + Math.random() * 900,
        })
      }
    }

    const base = Math.round(150 + intensity * 130)
    burst(base, 0, 0.95) // ana patlama
    burst(Math.round(base * 0.55), 130, 0.7) // ikinci dalga: dolgunluk

    /*
     * Renge göre sırala: çizim döngüsü `fillStyle`'ı parçacık başına değil,
     * renk değiştikçe — yani karede en fazla 6 kez — yazıyor. Sıralama
     * parçacıkların çizim sırasını değiştiriyor ama renkler zaten rastgele
     * dağıldığı için görsel bir fark yok.
     */
    pieces.sort((a, b) => a.renk - b.renk)

    let raf = 0
    let last = now0

    const frame = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      let alive = 0
      let sonRenk = -1
      for (const p of pieces) {
        if (now < p.born) {
          alive++
          continue
        }
        const age = now - p.born
        if (age > p.life) continue

        p.vy += GRAVITY * dt
        p.vx *= DRAG
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vrot * dt

        /**
         * ⚠️ Ekran dışına çıkan parçacık ÖLÜ sayılır.
         *
         * Yatay hız ~1,28 px/ms, yani bir parça 960 px'i ~750 ms'de geçiyor;
         * ömür ise 1900-2800 ms. Yani 2,9 saniyenin son ~2 saniyesinde
         * parçacıkların çoğu görünmez olduğu hâlde hâlâ integre ediliyor,
         * matris dönüşümünden geçiriliyor ve çizim çağrısı kuruluyordu —
         * Skia sonunda kırpma testinde eliyordu ama JS ve çağrı kurulumu boşa
         * çalışıyordu. Ölü saymak döngüyü de erken bitiriyor.
         *
         * Yukarı çıkanlar elenmez: yerçekimi onları geri getirir.
         */
        if (p.x < -60 || p.x > W + 60 || p.y > H + 60) continue
        alive++

        const t = age / p.life
        ctx.globalAlpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35

        if (p.renk !== sonRenk) {
          ctx.fillStyle = palette[p.renk]!
          sonRenk = p.renk
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        // Dönerken incelme: düz kağıt yerine bant kırpıntısı hissi.
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(Math.cos(p.rot)), p.h)
        ctx.restore()
      }

      if (alive > 0) {
        raf = requestAnimationFrame(frame)
        return
      }

      /*
       * ⚠️ Patlama bitince katman BIRAKILIR. Eskiden oyuncu "Sıradaki şarkı"ya
       * basana kadar — ki bu dakikalar sürebilir — tam ekran, `position: fixed`
       * bir canvas 8-33 MB'lık arka tamponuyla compositor'ın katman listesinde
       * duruyordu. Kare hızını düşürmüyordu ama küçük VRAM'li makinelerde
       * boşuna yer kaplıyordu.
       *
       * ⚠️ React durumuyla söküp `null` döndürmek CAZİP ama yanlış: canvas
       * gitince `canvasRef.current` boşalır ve bir sonraki tur için çalışan
       * efekt erkenden çıkar — konfeti bir daha hiç patlamaz. Elemanı yerinde
       * bırakıp yalnızca kaynağını bırakmak bu tuzağı tamamen atlıyor.
       */
      raf = 0
      canvas.width = 0
      canvas.height = 0
      canvas.style.display = 'none'
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [intensity, reduce, mounted, originRef])

  if (reduce || !mounted) return null

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />,
    document.body,
  )
}
