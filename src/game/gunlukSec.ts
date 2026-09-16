import type { Difficulty } from '@/data/categories'
import type { Kapak } from '@/data/kapak'
import type { Song } from '@/data/schema'
import type { Unlu } from '@/data/unlu'
import {
  GUNLUK_KADEMELER, GUNLUK_SIRASI, YEDEK_SAYISI, type GunlukOyun, type GunlukZorluk,
} from './gunluk'

/**
 * Günün setini seçer — saf, tohumlu `rand` ile deterministik.
 *
 * Kurallar:
 *   · Her slot kendi kademe bandından (kolay 1-2, zor 3-5): önce banttan bir
 *     kademe rastgele seçilir, o kademe boşsa bandın tamamına genişler.
 *   · Son günlerde çıkmış öğeler dışarıda — boşalırsa bu kural gevşer, set
 *     yine kurulur.
 *   · ALTI SLOTTA AYNI SANATÇI YOK. Şarkı turunda Tarkan çıkıp kapak turunda
 *     Tarkan albümü çıksaydı bir tur diğerini ele verirdi. Ünlünün adı da
 *     sanatçı sayılır (şarkıcı ünlüler).
 *   · Slot başına asıl + `YEDEK_SAYISI` yedek: sunucu medyayı denetleyip ölü
 *     olanı eler, oyun sırasında ölen medya da sıradaki yedeğe geçer.
 */

export interface GunlukHavuzlar {
  sarkilar: readonly Song[]
  unluler: readonly Unlu[]
  kapaklar: readonly Kapak[]
}

export type SecilenOge =
  | { oyun: 'sarki'; oge: Song }
  | { oyun: 'unlu'; oge: Unlu }
  | { oyun: 'kapak'; oge: Kapak }

export interface SecilenSlot {
  oyun: GunlukOyun
  zorluk: GunlukZorluk
  /** 0 asıl, sonrakiler yedek. */
  adaylar: SecilenOge[]
}

type Aday = { id: string; d: Difficulty; sanatci: string; sec: SecilenOge }

function adaylar(havuzlar: GunlukHavuzlar, oyun: GunlukOyun): Aday[] {
  switch (oyun) {
    case 'sarki':
      return havuzlar.sarkilar.map((s) => ({ id: s.id, d: s.d, sanatci: s.nA, sec: { oyun, oge: s } }))
    case 'unlu':
      return havuzlar.unluler.map((u) => ({ id: u.id, d: u.d, sanatci: u.nT, sec: { oyun, oge: u } }))
    case 'kapak':
      return havuzlar.kapaklar.map((k) => ({ id: k.id, d: k.d, sanatci: k.nA, sec: { oyun, oge: k } }))
  }
}

/** Girdiyi bozmadan, tohumla karıştırıp ilk `n` tanesini alır. */
function orneklem<T>(liste: readonly T[], n: number, rand: () => number): T[] {
  const out = [...liste]
  const sinir = Math.min(n, out.length)
  for (let i = 0; i < sinir; i++) {
    const j = i + Math.floor(rand() * (out.length - i))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out.slice(0, sinir)
}

export function gunlukSec(
  havuzlar: GunlukHavuzlar,
  haric: ReadonlySet<string>,
  rand: () => number,
  yedek = YEDEK_SAYISI,
): SecilenSlot[] | null {
  const kullanilanSanatci = new Set<string>()
  const kullanilanId = new Set<string>()
  const slotlar: SecilenSlot[] = []

  const havuzOnbellek = new Map<GunlukOyun, Aday[]>()
  const havuzu = (oyun: GunlukOyun) => {
    let h = havuzOnbellek.get(oyun)
    if (!h) havuzOnbellek.set(oyun, (h = adaylar(havuzlar, oyun)))
    return h
  }

  for (const { oyun, zorluk } of GUNLUK_SIRASI) {
    const bant = GUNLUK_KADEMELER[zorluk]
    const kademe = bant[Math.floor(rand() * bant.length)]!

    const uygun = (a: Aday, haricUygula: boolean) =>
      !kullanilanId.has(a.id) &&
      !(a.sanatci && kullanilanSanatci.has(a.sanatci)) &&
      !(haricUygula && haric.has(a.id))

    const tum = havuzu(oyun)
    const denemeler: Aday[][] = [
      tum.filter((a) => a.d === kademe && uygun(a, true)),
      tum.filter((a) => bant.includes(a.d) && uygun(a, true)),
      // Son günlerin öğeleri tekrar serbest — ince havuzda set yine kurulsun.
      tum.filter((a) => bant.includes(a.d) && uygun(a, false)),
    ]
    if (denemeler.every((l) => l.length === 0)) return null

    /*
     * Asıl öncelikle seçilen kademeden; yedekler o kademe yetmezse bandın
     * geri kalanından, o da yetmezse gevşetilmiş listeden tamamlanır.
     */
    const sirali: Aday[] = []
    const gorulen = new Set<string>()
    for (const l of denemeler) {
      for (const a of orneklem(l, l.length, rand)) {
        if (gorulen.has(a.id)) continue
        gorulen.add(a.id)
        sirali.push(a)
      }
    }

    const secilen: Aday[] = []
    const slotSanatci = new Set<string>()
    for (const a of sirali) {
      if (secilen.length > yedek) break
      // Yedekler de asılın yerine geçebileceği için aynı kurala tabi; kendi
      // aralarında da sanatçı tekrarlanmasın ki takas bir ipucuna dönmesin.
      if (a.sanatci && slotSanatci.has(a.sanatci)) continue
      secilen.push(a)
      if (a.sanatci) slotSanatci.add(a.sanatci)
    }

    for (const a of secilen) {
      kullanilanId.add(a.id)
      if (a.sanatci) kullanilanSanatci.add(a.sanatci)
    }
    slotlar.push({ oyun, zorluk, adaylar: secilen.map((a) => a.sec) })
  }

  return slotlar
}
