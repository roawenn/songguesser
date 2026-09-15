import type { Song } from '@/data/schema'

/**
 * Bir kademeyi ne tüketti?
 *
 * ⚠️ Dinlemek BU LİSTEDE YOK ve olmamalı. Oyuncu bulunduğu kademeyi istediği
 * kadar tekrar dinleyebilir; klip yalnızca yanlış tahmin ya da pas ile uzar.
 * Dinleme sayısı ayrıca tutulur (`listens`) çünkü gösterilen "N. deneme"
 * etiketi onu sayar, kademeyi değil.
 */
export type StepKind = 'wrong' | 'skip' | 'hint'

/**
 * Bir turda alınabilecek ipucu sayısı: 1. çıkış yılı, 2. sanatçının baş harfi.
 *
 * ⚠️ İpucu PAS GİBİ bir kademe yakar (klip uzar), tahmin hakkı YAKMAZ
 * (`wrongCount` yalnızca `wrong` sayar). Kullanıcı kararı: bedava ipucu şarkı
 * oyununu anlamsızlaştırırdı, hak yakan ipucu da kimsenin almayacağı kadar pahalıydı.
 */
export const IPUCU_SAYISI = 2

/** Turda alınmış ipucu sayısı. */
export function ipucuSayisi(steps: readonly Step[]): number {
  return steps.reduce((n, s) => (s.kind === 'hint' ? n + 1 : n), 0)
}

/**
 * Şu an ipucu alınabilir mi?
 *
 * ⚠️ SON KADEMEDE HAYIR: ipucu bir kademe yaktığı için orada turu doğrudan
 * kaybettirirdi — oyuncu bir bilgi için basıp cevabı göremeden kaybederdi.
 */
export function ipucuVerilebilir(state: GameState): boolean {
  if (state.s !== 'ready' && state.s !== 'playing') return false
  return ipucuSayisi(state.steps) < IPUCU_SAYISI && state.attempt + 1 < state.ladder.length
}

/**
 * Alınmış ipuçlarının METNİ, alınma sırasıyla.
 *
 * Saf ve türetilmiş: ipucu içeriği durumda saklanmıyor, şarkıdan ve kaç ipucu
 * alındığından hesaplanıyor — saklanan ile gösterilen ayrışamaz.
 *
 * ⚠️ Baş harf büyük/küçük harf DÖNÜŞTÜRÜLMEDEN alınır: görüntü adı zaten doğru
 * yazılmış ve `toLowerCase`/`toUpperCase` Türkçe İ/ı'yı bozuyor.
 */
export function ipuclari(track: Pick<Song, 'y' | 'a'>, steps: readonly Step[]): string[] {
  const n = Math.min(ipucuSayisi(steps), IPUCU_SAYISI)
  const hepsi = [String(track.y), `${Array.from(track.a.trim())[0] ?? ''}…`]
  return hepsi.slice(0, n)
}

/**
 * Bir turda en fazla kaç YANLIŞ TAHMİN yapılabilir.
 *
 * ⚠️ Merdivenin uzunluğundan (`ATTEMPTS` = 5) AYRI bir sınır. Pas geçmek
 * merdiveni ilerletir ama tahmin hakkı yakmaz; tahmin hakkı yalnızca yanlış
 * bilince gider. Üçüncü yanlışta tur biter ve şarkı açılır.
 *
 * Tur KAYIP sayılır, dolayısıyla `useRound.next()` zorluğu yükseltmez —
 * oyuncu bulunduğu zorlukta kalır.
 */
export const MAX_WRONG = 3

/** Turda şimdiye kadar yapılmış yanlış tahmin sayısı. */
export function wrongCount(steps: readonly Step[]): number {
  return steps.reduce((n, s) => (s.kind === 'wrong' ? n + 1 : n), 0)
}

export interface Step {
  kind: StepKind
  /** Kullanıcının yazdığı ham metin (pasta boş). */
  text: string
  /** Sanatçı doğru ama şarkı yanlış mıydı? */
  sameArtist: boolean
}

/** Tur boyunca biriken sayaçlar. Kademeden bağımsızdır. */
interface Round {
  track: Song
  ladder: number[]
  /** Merdivendeki konum — yalnızca yanlış tahmin ve pas ilerletir. */
  attempt: number
  steps: Step[]
  /** Kaç kez sonuna kadar dinlendi. */
  listens: number
  /** Gerçekten duyulan en yüksek kademe; -1 = hiç dinlenmedi. */
  heardIndex: number
}

export type GameState =
  | { s: 'booting' }
  | { s: 'arming'; track: Song; ladder: number[] }
  | ({ s: 'ready' } & Round)
  | ({ s: 'playing' } & Round)
  | ({ s: 'won' } & Round)
  | ({ s: 'lost' } & Round)
  | { s: 'empty' }
  | { s: 'error'; reason: 'pool' | 'audio' | 'offline' }

export type Action =
  | { type: 'ARM'; track: Song; ladder: number[] }
  | { type: 'ARM_OK' }
  | { type: 'ARM_FAIL'; reason: 'pool' | 'audio' | 'offline' }
  | { type: 'PLAY' }
  /** Klip sonuna kadar çalındı — yalnızca dinleme sayacını artırır. */
  | { type: 'CLIP_END' }
  /** ⚠️ Takılma hiçbir sayacı artırmaz. */
  | { type: 'CLIP_STALL' }
  | { type: 'WRONG'; text: string; sameArtist: boolean }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  /** İpucu: pas gibi bir kademe yakar, tahmin hakkı yakmaz (bkz. `IPUCU_SAYISI`). */
  | { type: 'HINT' }
  | { type: 'EMPTY_POOL' }
  /**
   * Elde tur kalmadı — yeni bir tur kurulana kadar hiçbir şey oynatılamaz.
   *
   * ⚠️ Seçki değişimi için ŞART. Yeni havuz ağdan gelene kadar durum ESKİ turu
   * `ready` tutuyordu: oyuncu kategoriyi değiştirip hemen çal'a bastığında
   * önceki seçkinin şarkısı çalıyordu.
   */
  | { type: 'RESET' }

/** Tur içinde miyiz? */
export function inRound(state: GameState): state is Extract<GameState, { s: 'ready' | 'playing' }> {
  return state.s === 'ready' || state.s === 'playing'
}

/** Şu an çalınacak klip uzunluğu. */
export function currentClipLength(state: GameState): number {
  if (!inRound(state) && state.s !== 'won' && state.s !== 'lost') return 0
  if (state.s === 'won' || state.s === 'lost') return 0
  return state.ladder[Math.min(state.attempt, state.ladder.length - 1)]!
}

/** Çal düğmesi basılabilir mi? Tur sürdüğü sürece evet — dinlemek bedava. */
export function canPlay(state: GameState): state is Extract<GameState, { s: 'ready' }> {
  return state.s === 'ready'
}

/** Gerçekten duyulan en uzun klip (sn). Hiç dinlenmediyse 0. */
export function heardLength(heardIndex: number, ladder: number[]): number {
  return heardIndex < 0 ? 0 : (ladder[Math.min(heardIndex, ladder.length - 1)] ?? 0)
}

/**
 * Yanlış tahmin ve pas için: kademeyi tüket, son kademeyse turu bitir.
 *
 * ⚠️ `s` spread'den SONRA yazılır. `round` çağrı yerinde tam durum nesnesidir,
 * yani içinde `s: 'ready'` de vardır; `{ s: 'lost', ...next }` yazılsaydı
 * spread onu geri ezer ve tur asla bitmezdi. TypeScript bunu yakalayamıyor
 * çünkü `Round` tipinde `s` alanı yok.
 */
function advance(round: Round, steps: Step[]): GameState {
  const next = { ...round, attempt: round.attempt + 1, steps }
  const over = round.attempt + 1 >= round.ladder.length
  return { ...next, s: over ? 'lost' : 'ready' }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'RESET':
      return { s: 'booting' }

    case 'ARM':
      return { s: 'arming', track: action.track, ladder: action.ladder }

    case 'ARM_OK':
      if (state.s !== 'arming') return state
      return {
        s: 'ready',
        track: state.track,
        ladder: state.ladder,
        attempt: 0,
        steps: [],
        listens: 0,
        heardIndex: -1,
      }

    case 'ARM_FAIL':
      return { s: 'error', reason: action.reason }

    case 'EMPTY_POOL':
      return { s: 'empty' }

    case 'PLAY':
      if (!canPlay(state)) return state
      return { ...state, s: 'playing' }

    case 'CLIP_END':
      if (state.s !== 'playing') return state
      // Kademe DEĞİŞMEZ: aynı uzunluk istendiği kadar tekrar dinlenebilir.
      return {
        ...state,
        s: 'ready',
        listens: state.listens + 1,
        heardIndex: Math.max(state.heardIndex, state.attempt),
      }

    case 'CLIP_STALL':
      // Ağ hatası oyuncuya hiçbir şeye mal olmaz — dinleme bile sayılmaz.
      if (state.s !== 'playing') return state
      return { ...state, s: 'ready' }

    case 'CORRECT':
      if (!inRound(state)) return state
      return { ...state, s: 'won' }

    case 'WRONG': {
      if (!inRound(state)) return state
      const steps: Step[] = [
        ...state.steps,
        { kind: 'wrong', text: action.text, sameArtist: action.sameArtist },
      ]
      /*
       * İki ayrı bitiş koşulu var ve ikisi de geçerli:
       *   - üç yanlış tahmin (MAX_WRONG),
       *   - merdivenin sonuna gelmek (pas geçmeler de sayar).
       * Hangisi önce dolarsa tur orada biter.
       */
      const next = { ...state, attempt: state.attempt + 1, steps }
      const bitti = wrongCount(steps) >= MAX_WRONG || next.attempt >= state.ladder.length
      return { ...next, s: bitti ? 'lost' : 'ready' }
    }

    case 'SKIP': {
      if (!inRound(state)) return state
      return advance(state, [
        ...state.steps,
        { kind: 'skip' as const, text: '', sameArtist: false },
      ])
    }

    case 'HINT': {
      // ⚠️ Aynı nesne döner: arayüz yanlışlıkla basılan düğmede yeniden çizmesin.
      if (!ipucuVerilebilir(state) || !inRound(state)) return state
      return advance(state, [
        ...state.steps,
        { kind: 'hint' as const, text: '', sameArtist: false },
      ])
    }

    default:
      return state
  }
}
