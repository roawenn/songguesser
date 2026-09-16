import { foldDiacritics, turkishLower } from './normalize'

/**
 * Herkese açık kullanıcı adı: biçim, ayrılmış adlar, uygunsuzluk. Saf.
 *
 * İKİ AYRI ANAHTAR:
 *   · `adNormu` — BENZERSİZLİK. "Şule", "sule" ve "su_le" aynı ad sayılır;
 *     sıralamada birbirinin taklidi görünmesin.
 *   · `denetimMetni` — yalnızca FİLTRE. Leet (0→o, 1→i…) ve harf tekrarı da
 *     açılır. Benzersizlikte kullanılsaydı "mehmet1" ile "mehmeti" çakışırdı.
 *
 * ⚠️ Terlik (`lib/uygunsuz.ts`) tek kelimelik küfürleri iyi yakalıyor ama
 * boşluksuz bileşik adları kaçırıyor ("salakbey", "shit99"). Aşağıdaki kök
 * listesi ALT DİZE olarak aranıyor; kökler yanlış pozitif vermeyecek kadar uzun
 * seçildi ("sik" değil "sikis": "sikke", "kasik", "siklet" geçmeli). Kısa
 * kökler yalnızca adın TAMAMI olunca yakalanıyor.
 */

export const AD_EN_KISA = 3
export const AD_EN_UZUN = 20
const AD_DESENI = /^[0-9A-Za-zÇĞİÖŞÜçğıöşü_]+$/u

export function adNormu(ad: string): string {
  return foldDiacritics(turkishLower(ad.normalize('NFC'))).replace(/_/g, '')
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' }

/** Leet açılmış hâl — harf tekrarı KORUNUR ("sikke" terlik'e "sike" diye gitmesin). */
export function leetAc(ad: string): string {
  return adNormu(ad).replace(/[0-9]/g, (r) => LEET[r] ?? '')
}

export function denetimMetni(ad: string): string {
  return leetAc(ad).replace(/(.)\1+/g, '$1')
}

/** Rakamsız ve tekrarsız çekirdek — kısa kökler ve ayrılmış adlar için. */
function cekirdek(ad: string): string {
  return adNormu(ad).replace(/[0-9]/g, '').replace(/(.)\1+/g, '$1')
}

/** Tam eşleşme: yönetim/sistem gibi görünen ya da rota adı olan adlar. */
const REZERVE_TAM = [
  'mod', 'bot', 'api', 'dev', 'root', 'www', 'null', 'undefined', 'anonim', 'anonymous', 'misafir',
  'guest', 'silinmis', 'deleted', 'gunluk', 'unlu', 'kapak', 'duelo', 'duello', 'paylas', 'yayin',
  'sanatci', 'seckiler', 'hakinda', 'hakkinda', 'gizlilik', 'hesap', 'giris', 'cikis', 'nasiloynanir',
  'liderlik', 'arsiv', 'sarki',
]
/** Önek: bunlarla başlayan her ad resmî görünür. */
const REZERVE_ONEK = [
  'admin', 'administrator', 'moderator', 'moderat', 'yonetim', 'yonetici', 'tahmin', 'destek', 'support',
  'sistem', 'system', 'resmi', 'official', 'staff',
]

/** Alt dize olarak aranan kökler (denetim metninde, tekrar harfler sıkıştırılmış). */
const UYGUNSUZ_KOKLER = [
  // Türkçe
  'sikis', 'sikic', 'siktir', 'sikerim', 'sikeyim', 'sokarim', 'yarak', 'yarag', 'orospu', 'orosbu',
  'amcik', 'aminak', 'aminako', 'anani', 'ananin', 'ananis', 'bacini', 'gotveren', 'gotunu', 'gotune',
  'ibne', 'kahpe', 'pust', 'kerhane', 'pezevenk', 'gavat', 'salak', 'dangalak', 'saksoc', 'yavsak',
  'kaltak', 'surtuk', 'fahise', 'penis', 'vajina', 'tasak', 'dasak',
  // İngilizce
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'pusy', 'ashole', 'fagot', 'porn', 'hitler',
]
/** Yalnızca adın tamamıyken (rakamlar hariç) uygunsuz sayılan kısa kökler. */
const KISA_KOKLER = ['sakso', 'amk', 'aq', 'mk', 'oc', 'sg', 'bok', 'mal', 'got', 'am', 'sik', 'dick', 'cock', 'sex', 'xxx']

/**
 * ⚠️ Yanlış pozitifler: kökü İÇERİP masum olan kelimeler denetimden önce
 * metinden çıkarılıyor. Kök listesinden de bu yüzden çıkarılanlar var: "niga"
 * (Nigar), "nazi" (Nazif), "fuk" (fukara), "rape"
 * (rapper), "amina" (Amina), "meme" (Memed); "sakso" yalnız tam ad (saksofon). Onları terlik yakalıyor.
 */
const BEYAZ = ['penisilin']

export function kokKontrol(ad: string): boolean {
  let m = denetimMetni(ad)
  for (const b of BEYAZ) m = m.split(b).join('·')
  if (UYGUNSUZ_KOKLER.some((k) => m.includes(k))) return true
  const c = cekirdek(ad)
  return KISA_KOKLER.includes(c)
}

export type AdHatasi = 'uzunluk' | 'karakter' | 'alt-cizgi' | 'yalniz-rakam' | 'rezerve' | 'uygunsuz'

export const AD_HATA_METNI: Record<AdHatasi, string> = {
  uzunluk: `Kullanıcı adı ${AD_EN_KISA}-${AD_EN_UZUN} karakter olmalı.`,
  karakter: 'Yalnızca harf, rakam ve alt çizgi (_) kullanılabilir.',
  'alt-cizgi': 'Alt çizgi başta, sonda ya da art arda olamaz.',
  'yalniz-rakam': 'Kullanıcı adı yalnızca rakamdan oluşamaz.',
  rezerve: 'Bu ad kullanılamaz.',
  uygunsuz: 'Bu ad uygun değil. Başka bir ad dene.',
}

export type AdSonucu = { ok: true; ad: string; norm: string } | { ok: false; hata: AdHatasi }

/**
 * Adı denetler. `uygunsuzMu` sunucuda terlik'i bağlıyor; istemcide verilmez
 * (ön doğrulama yalnızca kök listesiyle — asıl karar sunucuda).
 */
export function adDenetle(ham: string, uygunsuzMu?: (ad: string) => boolean): AdSonucu {
  const ad = ham.normalize('NFC').trim()
  const uzunluk = Array.from(ad).length
  if (uzunluk < AD_EN_KISA || uzunluk > AD_EN_UZUN) return { ok: false, hata: 'uzunluk' }
  if (!AD_DESENI.test(ad)) return { ok: false, hata: 'karakter' }
  if (/^_|_$|__/.test(ad)) return { ok: false, hata: 'alt-cizgi' }
  if (/^[0-9_]+$/.test(ad)) return { ok: false, hata: 'yalniz-rakam' }

  const c = cekirdek(ad)
  const d = denetimMetni(ad)
  if (
    REZERVE_TAM.includes(c) || REZERVE_TAM.includes(d) ||
    REZERVE_ONEK.some((r) => c.startsWith(r) || d.startsWith(r))
  ) {
    return { ok: false, hata: 'rezerve' }
  }
  if (kokKontrol(ad) || uygunsuzMu?.(ad)) return { ok: false, hata: 'uygunsuz' }

  return { ok: true, ad, norm: adNormu(ad) }
}

/** Harf avatarının tonu — addan kararlı biçimde. */
export function adTonu(ad: string): number {
  let h = 0
  for (const ch of adNormu(ad)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return ((h % 360) + 360) % 360
}

/** Avatarın harfi — ilk harf, Türkçe büyük harfe çevrilmiş. */
export function adHarfi(ad: string): string {
  const ilk = Array.from(ad.replace(/^[_0-9]+/, ''))[0] ?? Array.from(ad)[0] ?? '?'
  return ilk.toLocaleUpperCase('tr-TR')
}
