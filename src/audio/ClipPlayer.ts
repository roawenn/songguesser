/**
 * Klip motoru. React'tan tamamen bağımsız, emirsel, tekil.
 *
 * Tasarımın özü: HASSASİYETİ KULAĞIN OLDUĞU YERE, TOLERANSI OLMADIĞI YERE KOY.
 *   - Zarf `AudioContext.currentTime` üzerinde mutlak zamanlara planlanır →
 *     duyulan sürenin doğruluğu örnek hassasiyetindedir.
 *   - Klibi bitiren JS callback'i birkaç ms geç gelebilir, çünkü o an kazanç
 *     zaten 0'dadır ve hiçbir şey duyulmaz.
 *
 * ⚠️ `setTimeout` klibi BİTİRMEK için asla kullanılmaz. Ana iş parçacığı
 * baskısı altında rutin olarak 10-40 ms geç tetiklenir; 100 ms'lik bir klipte
 * bu %40 hatadır ve turlar arası uzunluk farkı olarak DUYULUR.
 */
import { getGraph, isUnlocked, unlock } from './context'
import { getLanes, loadSource, type Lane } from './deck'
import { FADE_IN, FADE_OUT, TAIL, planClip, MAX_CLIP } from './envelope'

export type ArmResult = 'ready' | 'stalled' | 'dead-url' | 'unsupported'
export type ClipResult = 'completed' | 'stalled' | 'aborted'

export interface ArmTrack {
  id: string
  url: string
  clipStart: number
  duration: number
}

export type PlayerStatus = 'idle' | 'arming' | 'ready' | 'playing' | 'stalled'

export interface PlayerSnapshot {
  status: PlayerStatus
  trackId: string | null
  /** Çalan klibin hedef uzunluğu (sn). Çalmıyorsa 0. */
  clipLength: number
}

const ARM_TIMEOUT_MS = 8000

/** Zarf omuzlarının dışında kalan payı da içeren ölü adam şalteri. */
const DEADMAN_EXTRA_MS = 500

/**
 * Medya saati bu kadar süre ilerlemezse gerçekten takılmış sayılır.
 * Ağ tıkanması bundan uzun sürer; decoder'ın ilk kareleri hazırlaması kısa.
 */
const FREEZE_TIMEOUT_MS = 400

function nowSnapshot(status: PlayerStatus, trackId: string | null, clipLength: number): PlayerSnapshot {
  return { status, trackId, clipLength }
}

/** /dev/audio doğrulama sayfası için ölçüm kaydı. */
export interface ClipTiming {
  /** İstenen plato uzunluğu. */
  requested: number
  /** Planlanan plato başlangıcı (ctx saati). */
  t0: number
  /** `onended` gerçekte ne zaman geldi (ctx saati). */
  endedAt: number
  /** t0'dan bitişe geçen süre. Beklenen: requested + FADE_OUT + TAIL. */
  measured: number
  /** Beklenenden sapma (sn). Bu, ana iş parçacığı gecikmesini değil, ses
   *  saatinin doğruluğunu ölçer — duyulan plato zaten örnek hassasiyetindedir. */
  drift: number
}

class ClipPlayer {
  private snapshot: PlayerSnapshot = nowSnapshot('idle', null, 0)
  private listeners = new Set<() => void>()

  /** Son çalınan klibin ölçümü — yalnızca teşhis amaçlı. */
  lastTiming: ClipTiming | null = null

  /**
   * Son başarısızlığın sebebi. Takılma sessizce yutulan bir hata olduğu için
   * (kullanıcıya yalnızca "bağlantı takıldı" gösterilir) gerçek sebebi burada
   * saklıyoruz — gerçek cihazlarda teşhis için tek yol bu.
   */
  lastFailure: string | null = null

  /**
   * Platonun (tam kazançlı kısmın) başladığı an, `performance.now()` ölçeğinde.
   * Klip çalmıyorken null.
   *
   * Saat ve ilerleme çubuğu bunu bekler. Aksi hâlde görsel sayaç tıklama anında
   * başlar, ses ise hizalama kadar sonra — kullanıcı bunu "kliplerin bir kısmı
   * sessiz" diye algılar.
   */
  plateauStart: number | null = null

  /** Aktif şerit indeksi; diğer şerit sonraki turu önyükler. */
  private active = 0
  private armed: ArmTrack | null = null
  private abort: AbortController | null = null
  private tick: ConstantSourceNode | null = null
  private deadman: ReturnType<typeof setTimeout> | null = null
  private watchdog: number | null = null

  // ---------- abonelik (useSyncExternalStore) ----------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): PlayerSnapshot => this.snapshot

  private emit(status: PlayerStatus, clipLength = this.snapshot.clipLength): void {
    this.snapshot = nowSnapshot(status, this.armed?.id ?? null, clipLength)
    for (const fn of this.listeners) fn()
  }

  // ---------- kilit ----------

  /** Gesture içinden, senkron olarak çağrılmalı. */
  unlockFromGesture(): void {
    const lanes = getLanes()
    unlock(lanes ? [lanes[0].el, lanes[1].el] : [])
  }

  get analyser(): AnalyserNode | null {
    return getGraph()?.analyser ?? null
  }

  setVolume(v: number): void {
    const g = getGraph()
    if (g) g.master.gain.value = Math.max(0, Math.min(1, v))
  }

  // ---------- hazırlık ----------

  /**
   * Şarkıyı çalmaya hazırlar. Bu `'ready'` dönene kadar tur BAŞLAMAZ —
   * kullanıcı asla yüklenmemiş bir elemana basamaz.
   */
  async arm(track: ArmTrack): Promise<ArmResult> {
    const lanes = getLanes()
    if (!lanes) return 'unsupported'

    this.abort?.abort()
    this.abort = new AbortController()
    const { signal } = this.abort

    this.armed = track
    this.emit('arming', 0)

    const lane = lanes[this.active]!
    const plan = planClip(track.clipStart, MAX_CLIP)

    try {
      loadSource(lane, track.url)
      await waitForEvent(lane.el, 'loadedmetadata', ARM_TIMEOUT_MS, signal)

      // Gerçek süreyi öğrendik; merdiveni taşıyamıyorsa reddet.
      const duration = Number.isFinite(lane.el.duration) ? lane.el.duration : track.duration
      if (duration < plan.clipStart + 1 + FADE_OUT + TAIL) {
        return 'dead-url'
      }

      lane.el.currentTime = plan.seekTo
      await waitForEvent(lane.el, 'seeked', ARM_TIMEOUT_MS, signal)

      // Buffer kapısı: `canplaythrough` motorlar arası tutarsız tetiklenir,
      // bu yüzden gerçekten arabelleklenmiş aralığı doğruluyoruz.
      await waitForBuffer(lane.el, plan.seekTo, Math.min(plan.clipStart + MAX_CLIP, duration), ARM_TIMEOUT_MS, signal)

      this.emit('ready', 0)
      return 'ready'
    } catch (err) {
      if (signal.aborted) return 'stalled'
      const mediaError = lane.el.error
      if (mediaError && mediaError.code !== MediaError.MEDIA_ERR_ABORTED) return 'dead-url'
      return 'stalled'
    }
  }

  /** Sıradaki şarkıyı arka şeride önyükler (iOS için gesture içinden çağrılmalı). */
  prefetch(track: ArmTrack): void {
    const lanes = getLanes()
    if (!lanes) return
    const idle = lanes[this.active === 0 ? 1 : 0]!
    loadSource(idle, track.url)
  }

  /** Sonraki tura geçerken şeritleri takas eder. */
  swapLanes(): void {
    this.active = this.active === 0 ? 1 : 0
  }

  // ---------- çalma ----------

  async play(length: number): Promise<ClipResult> {
    const graph = getGraph()
    const lanes = getLanes()
    if (!graph || !lanes || !this.armed) return 'aborted'
    if (!isUnlocked()) this.unlockFromGesture()

    const lane = lanes[this.active]!
    const plan = planClip(this.armed.clipStart, length)
    const { ctx } = graph

    this.cleanupPlayback()
    this.plateauStart = null
    this.emit('playing', length)

    try {
      // Her kademe aynı noktadan başlar: kademeler İÇ İÇE olmalı, yoksa
      // oyuncu bilgi biriktiremez ve kademeli açılım fikri çöker.
      lane.el.currentTime = plan.seekTo
      lane.clipGain.gain.cancelScheduledValues(ctx.currentTime)
      lane.clipGain.gain.setValueAtTime(0, ctx.currentTime)

      await lane.el.play()

      // İki saati hizala: el.play() çözüldüğü anda ilk örnek henüz çıkmamıştır.
      const anchor = await captureAnchor(lane.el, ctx)
      let t0 = anchor.ctxTime + (plan.clipStart - anchor.mediaTime)

      // Pencereyi kaçırdıysak (pre-roll yetmedi) bir kez telafi et.
      if (t0 <= ctx.currentTime + FADE_IN) {
        t0 = ctx.currentTime + FADE_IN + 0.01
      }

      const g = lane.clipGain.gain
      g.setValueAtTime(0, t0 - FADE_IN)
      g.linearRampToValueAtTime(1, t0) // fade-in pre-roll bölgesinde biter
      g.setValueAtTime(1, t0 + length) // plato = TAM `length`
      g.linearRampToValueAtTime(0, t0 + length + FADE_OUT)

      // Ses saatindeki t0'ı, görsellerin kullandığı performance.now() ölçeğine
      // çevir. Sayaç ve ilerleme çubuğu böylece sesle aynı anda başlar.
      this.plateauStart = performance.now() + (t0 - ctx.currentTime) * 1000

      return await this.scheduleEnd(ctx, lane, t0, length)
    } catch (err) {
      this.lastFailure = `play: ${(err as Error)?.message ?? String(err)}`
      this.plateauStart = null
      this.duck(lane)
      this.emit('stalled', 0)
      return 'stalled'
    }
  }

  /**
   * Klibin bitişini ses saatine planlar.
   *
   * Çıkışı sıfır bir ConstantSourceNode kullanılır: `onended` ses iş parçacığının
   * tamamlanmasından tetiklenir, yani güvenilir ve kazanç sıfıra indikten SONRA
   * sıralanmıştır. Birkaç ms geç gelse bile hiçbir şey duyulmaz.
   */
  private scheduleEnd(
    ctx: AudioContext,
    lane: Lane,
    t0: number,
    length: number,
  ): Promise<ClipResult> {
    return new Promise<ClipResult>((resolve) => {
      let settled = false
      const finish = (result: ClipResult) => {
        if (settled) return
        settled = true
        this.plateauStart = null
        this.cleanupPlayback()
        lane.el.pause()
        this.emit(result === 'stalled' ? 'stalled' : 'ready', 0)
        resolve(result)
      }

      const tick = ctx.createConstantSource()
      tick.offset.value = 0 // duyulabilir hiçbir katkı yok
      tick.connect(ctx.destination)
      tick.start(t0)
      tick.stop(t0 + length + FADE_OUT + TAIL)
      tick.onended = () => {
        const endedAt = ctx.currentTime
        const expected = length + FADE_OUT + TAIL
        const measured = endedAt - t0
        this.lastTiming = { requested: length, t0, endedAt, measured, drift: measured - expected }
        finish('completed')
      }
      this.tick = tick

      // Ölü adam şalteri: onended hiç gelmezse.
      this.deadman = setTimeout(
        () => {
          this.lastFailure = 'deadman: onended hiç gelmedi'
          finish('stalled')
        },
        (length + FADE_OUT + TAIL) * 1000 + DEADMAN_EXTRA_MS + (t0 - ctx.currentTime) * 1000,
      )

      // Takılma gözcüsü.
      //
      // ⚠️ Kare SAYISI değil, SÜRE ölçülür. Kare sayısı ekran tazeleme hızına
      // bağlıdır ve medya saati her rAF karesinde ilerlemek zorunda değildir;
      // 4 karelik eşik 120Hz bir ekranda 33 ms'ye düşer ve sağlıklı çalmayı
      // takılma sanır. Ayrıca `seeking` sırasında currentTime zaten durur.
      let last = lane.el.currentTime
      let lastAdvanceAt = performance.now()
      const watch = () => {
        if (settled) return
        const t = lane.el.currentTime
        const now = performance.now()

        if (t > last) {
          last = t
          lastAdvanceAt = now
        } else if (!lane.el.paused && !lane.el.seeking) {
          if (now - lastAdvanceAt > FREEZE_TIMEOUT_MS) {
            this.lastFailure =
              `watchdog: currentTime ${FREEZE_TIMEOUT_MS}ms ilerlemedi (t=${t.toFixed(3)})`
            this.duck(lane)
            finish('stalled')
            return
          }
        } else {
          // Duraklamış ya da seek hâlindeyken sayaç işlemez.
          lastAdvanceAt = now
        }

        this.watchdog = requestAnimationFrame(watch)
      }
      this.watchdog = requestAnimationFrame(watch)
    })
  }

  /** Hızlı, tıksız kısma — takılma anında. */
  private duck(lane: Lane): void {
    const g = getGraph()
    if (!g) return
    const now = g.ctx.currentTime
    lane.clipGain.gain.cancelScheduledValues(now)
    lane.clipGain.gain.setTargetAtTime(0, now, 0.004)
  }

  private cleanupPlayback(): void {
    if (this.tick) {
      this.tick.onended = null
      try {
        this.tick.stop()
      } catch {
        // zaten durmuş olabilir
      }
      this.tick.disconnect()
      this.tick = null
    }
    if (this.deadman) {
      clearTimeout(this.deadman)
      this.deadman = null
    }
    if (this.watchdog !== null) {
      cancelAnimationFrame(this.watchdog)
      this.watchdog = null
    }
  }

  stop(): void {
    const lanes = getLanes()
    this.cleanupPlayback()
    if (lanes) {
      const lane = lanes[this.active]!
      this.duck(lane)
      lane.el.pause()
    }
    this.emit('ready', 0)
  }
}

// ---------- yardımcılar ----------

function waitForEvent(
  el: HTMLAudioElement,
  type: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener(type, ok)
      el.removeEventListener('error', fail)
      signal.removeEventListener('abort', fail)
      clearTimeout(timer)
    }
    const ok = () => {
      cleanup()
      resolve()
    }
    const fail = () => {
      cleanup()
      reject(new Error(`${type} başarısız`))
    }
    const timer = setTimeout(fail, timeoutMs)
    el.addEventListener(type, ok, { once: true })
    el.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', fail, { once: true })
  })
}

/** `el.buffered` aralıklarını yürüyerek pencerenin gerçekten hazır olduğunu doğrular. */
function bufferedCovers(el: HTMLAudioElement, from: number, to: number): boolean {
  const ranges = el.buffered
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= from + 0.01 && ranges.end(i) >= to - 0.01) return true
  }
  return false
}

function waitForBuffer(
  el: HTMLAudioElement,
  from: number,
  to: number,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup()
      resolve()
    }
    const check = () => {
      if (el.readyState >= 3 && bufferedCovers(el, from, to)) done()
    }
    const cleanup = () => {
      el.removeEventListener('progress', check)
      el.removeEventListener('canplaythrough', done)
      el.removeEventListener('error', fail)
      signal.removeEventListener('abort', fail)
      clearTimeout(timer)
    }
    const fail = () => {
      cleanup()
      reject(new Error('buffer zaman aşımı'))
    }
    const timer = setTimeout(fail, timeoutMs)

    el.addEventListener('progress', check)
    el.addEventListener('canplaythrough', done, { once: true })
    el.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', fail, { once: true })
    check()
  })
}

/**
 * İki saati aynı tick içinde okur.
 *
 * `el.currentTime`'ın ardışık iki karede KESİNLİKLE arttığını görene kadar
 * bekler — decoder'ın gerçekten çalıştığının kanıtı budur; `paused === false`
 * yeterli değildir.
 */
function captureAnchor(
  el: HTMLAudioElement,
  ctx: AudioContext,
): Promise<{ ctxTime: number; mediaTime: number }> {
  return new Promise((resolve, reject) => {
    let prev = el.currentTime
    let frames = 0
    const step = () => {
      const media = el.currentTime
      if (media > prev) {
        resolve({ ctxTime: ctx.currentTime, mediaTime: media })
        return
      }
      prev = media
      if (++frames > 90) {
        reject(new Error('hizalama zaman aşımı'))
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

export const clipPlayer = new ClipPlayer()

// Geliştirme köprüsü: konsoldan `__nakarat.lastFailure` ile takılma sebebine
// bakılabilir. Üretim derlemesinde yer almaz.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __nakarat?: unknown }).__nakarat = clipPlayer
}
