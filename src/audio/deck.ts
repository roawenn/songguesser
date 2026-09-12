/**
 * İki şeritli <audio> havuzu.
 *
 * ⚠️ TUZAK 1: `createMediaElementSource(el)` bir eleman için YALNIZCA BİR KEZ
 * çağrılabilir; ikincisi InvalidStateError fırlatır. Bu yüzden elemanlar sabit
 * ve yeniden kullanılır — her turda yeni <audio> yaratılmaz, sadece .src değişir.
 *
 * ⚠️ TUZAK 2: Bir eleman MediaElementAudioSourceNode'a bağlandığında kendi
 * `.volume` ve `.muted` özellikleri devre dışı kalır. `el.volume = 0` sesi
 * KESMEZ. Tüm kazanç kontrolü GainNode'lar üzerinden yapılmalıdır.
 *
 * ⚠️ TUZAK 3: `crossOrigin` mutlaka `src`'den ÖNCE atanmalıdır. Sonra atanırsa
 * istek CORS modu olmadan gider ve MediaElementSource hata fırlatmadan
 * SESSİZLİK üretir — projenin en sinsi başarısızlık modu.
 */
import { getGraph } from './context'

export interface Lane {
  el: HTMLAudioElement
  /** Klip zarfı bu düğümde uygulanır. */
  clipGain: GainNode
}

let lanes: [Lane, Lane] | null = null

function createLane(graph: NonNullable<ReturnType<typeof getGraph>>): Lane {
  const el = new Audio()
  // TUZAK 3: src'den ÖNCE.
  el.crossOrigin = 'anonymous'
  el.preload = 'auto'
  el.controls = false
  // iOS için: TS tipleri playsInline'ı yalnızca video'da tanır, ama ses
  // elemanında da geçerli ve gereklidir.
  el.setAttribute('playsinline', '')

  const source = graph.ctx.createMediaElementSource(el) // ← eleman başına bir kez
  const clipGain = graph.ctx.createGain()
  clipGain.gain.value = 0

  source.connect(clipGain)
  clipGain.connect(graph.master)

  return { el, clipGain }
}

/** Şeritleri döndürür (gerekirse oluşturur). Tarayıcı dışında null. */
export function getLanes(): [Lane, Lane] | null {
  if (lanes) return lanes
  const graph = getGraph()
  if (!graph) return null
  lanes = [createLane(graph), createLane(graph)]
  return lanes
}

/**
 * Bir şeride yeni kaynak yükler. crossOrigin sırasını korur.
 */
export function loadSource(lane: Lane, url: string): void {
  lane.clipGain.gain.cancelScheduledValues(0)
  lane.clipGain.gain.value = 0
  lane.el.pause()
  // TUZAK 3 tekrar: src değişmeden önce crossOrigin yerinde olmalı.
  lane.el.crossOrigin = 'anonymous'
  lane.el.src = url
  lane.el.load()
}
