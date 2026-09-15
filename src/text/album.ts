import { cleanKey, fullKey } from './keys'

/**
 * iTunes albüm adını (`collectionName`) oyunda gösterilecek ve kabul edilecek
 * biçime getirir — Kapaktan Albüm oyunu.
 *
 * Veritabanında HAM ad saklanıyor (bkz. `schema.sql`); temizleme burada ki kural
 * değişince 15 bin şarkıyı Apple'a yeniden sormak gerekmesin.
 *
 * ⚠️ Parantez içi YALNIZCA sürüm sözcüğü taşıyorsa silinir. Hepsini silmek
 * adın parçası olan parantezleri de götürürdü: "Aşk (Değişmem)" gibi.
 */

/** "… - Single", "… - EP": mağazanın biçim eki, adın parçası değil. */
const BICIM_EKI = /\s+-\s+(single|ep)\s*$/i

const SURUM_SOZCUGU =
  'deluxe|remaster(?:ed)?|edition|version|bonus|expanded|anniversary|live|special|acoustic|akustik|canl[ıi]|s[üu]r[üu]m|[öo]zel'

/*
 * ⚠️ `\b` KULLANILMIYOR. JavaScript'te `\b` yalnızca ASCII harfleri kelime
 * sayıyor: "Canlı"nın sonundaki "ı" ile ")" arasında sınır YOK, "Özel"in
 * başındaki "Ö" ile boşluk arasında da yok — Türkçe sözcükler hiç eşleşmiyordu
 * (test yakaladı). Yerine Unicode harf/rakam bakışları, `u` bayrağıyla.
 */
const ONCE = '(?<![\\p{L}\\p{N}])'
const SONRA = '(?![\\p{L}\\p{N}])'

/** "(Deluxe Edition)", "[2011 Remaster]", "(Canlı)" */
const SURUM_PARANTEZI = new RegExp(
  `\\s*[([][^)\\]]*${ONCE}(?:${SURUM_SOZCUGU})${SONRA}[^)\\]]*[)\\]]`,
  'giu',
)

/** "… - Remastered 2015" */
const SURUM_TIRESI = new RegExp(`\\s+-\\s+[^-]*${ONCE}(?:${SURUM_SOZCUGU})${SONRA}.*$`, 'iu')

export function albumTemizle(ham: string): string {
  return ham
    .replace(BICIM_EKI, '')
    .replace(SURUM_PARANTEZI, '')
    .replace(SURUM_TIRESI, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Temizlenmiş albüm adının kabul anahtarları.
 *
 * ⚠️ Sanatçı adı BURADA YOK. Kolay modda sanatçı da kabul ediliyor ama o karar
 * istemcide, oyuncunun ayarına göre veriliyor (bkz. `data/kapak.ts`).
 */
export function albumAnahtarlari(temizAlbum: string): string[] {
  return [...new Set([cleanKey(temizAlbum), fullKey(temizAlbum)].filter((k) => k.length > 0))]
}
