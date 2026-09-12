/**
 * AudioContext yaşam döngüsü ve iOS/Safari kilidi.
 *
 * Dört ayrı gerçek sorun var, hepsi burada çözülüyor:
 *   1. AudioContext `suspended` başlar — ilk kullanıcı dokunuşunda resume gerekir.
 *   2. <audio> elemanı da AYRI bir gesture aktivasyonuna ihtiyaç duyar.
 *   3. iOS `preload="auto"`'yu fiilen yok sayar; medya baytlarını ancak bir
 *      gesture içinde çekmeye başlar. Sessiz "priming" çalması indirmeyi başlatır.
 *   4. `ctx.state === 'interrupted'` yalnızca Safari'de olur (telefon araması, Siri).
 */

export interface AudioGraph {
  ctx: AudioContext
  /** Kullanıcı ses seviyesi. */
  master: GainNode
  /** Dalga formu görselleştirmesi buradan beslenir. */
  analyser: AnalyserNode
}

type Ctor = typeof AudioContext

let graph: AudioGraph | null = null
let unlocked = false

function resolveCtor(): Ctor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** Grafi oluşturur (gerekirse). Tarayıcı dışında null döner. */
export function getGraph(): AudioGraph | null {
  if (graph) return graph
  const Ctor = resolveCtor()
  if (!Ctor) return null

  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0.8

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.75

  // master -> analyser -> destination
  // Analyser zincirin içinde: çıkışı aynen geçirir, sadece okuma yapar.
  master.connect(analyser)
  analyser.connect(ctx.destination)

  graph = { ctx, master, analyser }
  return graph
}

/**
 * ⚠️ Bir kullanıcı gesture'ının AYNI çağrı yığınından çağrılmalıdır.
 * Öncesinde `await` OLMAMALI — yoksa iOS gesture'ı saymaz.
 */
export function unlock(elements: HTMLAudioElement[] = []): void {
  const g = getGraph()
  if (!g) return

  void g.ctx.resume()

  // 1 örneklik sessiz buffer — bazı iOS sürümlerinde context'i gerçekten açan şey.
  try {
    const buf = g.ctx.createBuffer(1, 1, g.ctx.sampleRate)
    const src = g.ctx.createBufferSource()
    src.buffer = buf
    src.connect(g.ctx.destination)
    src.start(0)
  } catch {
    // önemli değil
  }

  // Elemanların kendi gesture aktivasyonu + iOS'ta indirmeyi başlatan priming.
  //
  // ⚠️ İKİ KURAL:
  //
  // 1. `pause()` SENKRON çağrılmalı. `play().then(() => pause())` yazılırsa
  //    duraklatma bir mikro-göreve ertelenir ve asıl klip çalma çağrısını
  //    ortasından keser: "The play() request was interrupted by a call to
  //    pause()". Kullanıcı bunu "bağlantı takıldı" olarak görür.
  //
  // 2. Yalnızca BİR KEZ yapılır. Her tıklamada tekrarlansa arabelleği
  //    boşuna yeniden kurar.
  if (!unlocked) {
    for (const el of elements) {
      const p = el.play()
      el.pause()
      if (p && typeof p.catch === 'function') p.catch(() => undefined)
    }
  }

  // Kilit ekranı bildirimi cevabı SIZDIRMASIN.
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Nakarat', artist: '' })
    } catch {
      // MediaMetadata yoksa sorun değil
    }
  }

  unlocked = true
}

export function isUnlocked(): boolean {
  return unlocked
}

/** Safari kesintilerinden (arama, Siri, sekme değişimi) toparlanma. */
export function installResumeHandlers(): () => void {
  if (typeof document === 'undefined') return () => {}

  const resume = () => {
    const g = getGraph()
    if (!g) return
    const state = g.ctx.state as AudioContextState | 'interrupted'
    if (state === 'suspended' || state === 'interrupted') void g.ctx.resume()
  }

  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  document.addEventListener('touchend', resume, { passive: true })

  return () => {
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('pageshow', resume)
    document.removeEventListener('touchend', resume)
  }
}
