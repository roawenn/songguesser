/**
 * Çerezsiz analitik — Umami Cloud.
 *
 * Betik `layout.tsx`'te, yalnızca üretimde ve `NEXT_PUBLIC_UMAMI_ID` tanımlıysa
 * yükleniyor; veri kendi alan adımızdan (`/u/*`, bkz. `next.config.ts`)
 * geçerek gidiyor. Betik yoksa (geliştirme, engelleyici, kimlik tanımsız) bu
 * dosyadaki her çağrı sessizce hiçbir şey yapmaz.
 *
 * ⚠️ OLAY BÜTÇESİ: ücretsiz plan ayda 100.000 olay. Katalog bilerek kaba —
 * tur başına TEK olay. Dinleme, tuş basışı, her yanlış tahmin gibi ince olaylar
 * eklenirse kota birkaç bin oyuncuda biter ve toplama ay sonuna kadar durur.
 *
 * ⚠️ Kişisel veri YOK: yazılan tahmin metni, şarkı ya da kişi kimliği
 * gönderilmez. Soru "hangi seçki ve zorluk oynanıyor, nerede bırakılıyor";
 * bunun için bu alanlar yetiyor.
 *
 * ⚠️ Olay adı en fazla 50 karakter (Umami sınırı).
 */

export type OyunAdi = 'sarki' | 'unlu' | 'kapak'

interface OlayKatalogu {
  /** Bir tur bitti — tek oyunculu ya da düello. */
  tur_bitti: {
    oyun: OyunAdi
    secki: string
    zorluk: number
    sonuc: 'kazandi' | 'kaybetti'
    /** Şarkıda harcanan kademe, ünlüde açılan şerit. */
    adim: number
    duello: boolean
  }
  secki_degisti: { oyun: OyunAdi; secki: string }
  duello_kuruldu: { oyun: OyunAdi; secki: string }
  story_indirildi: { oyun: OyunAdi }
  /** `sira`: turda kaçıncı ipucu (1 = yıl, 2 = baş harf). */
  ipucu_alindi: { oyun: OyunAdi; sira: number }
  /**
   * Yayıncı modunda oyun başlatıldı. ⚠️ Kanal adı GÖNDERİLMEZ (kişisel veri);
   * tur başına olay da yok — bir yayın saatlerce sürüp kotayı yakabilir.
   */
  yayin_basladi: { platform: 'twitch' | 'kick'; secki: string; zorluk: number; tur: number }
}

declare global {
  interface Window {
    umami?: { track: (ad: string, veri?: Record<string, unknown>) => void }
  }
}

export function olay<A extends keyof OlayKatalogu>(ad: A, veri: OlayKatalogu[A]): void {
  if (typeof window === 'undefined') return
  try {
    window.umami?.track(ad, veri)
  } catch {
    // Analitik oyunu ASLA bozmamalı.
  }
}

/** Bu oturumda gönderilmiş tek seferlik olay anahtarları. */
const gonderilen = new Set<string>()

/**
 * Aynı anahtarla yalnızca BİR kez gönderir.
 *
 * ⚠️ Tur sonu olayları efektlerden çağrılıyor ve efektler aynı tur için birden
 * fazla çalışabiliyor (StrictMode, kademe yükselince yeniden çalışma). İstatistik
 * deposu bu yüzden `sonTur` koruması taşıyor; analitik de aynı anahtarı kullanıp
 * aynı turu iki kez saymıyor — yoksa kota boşuna yanar, oranlar da yalan söyler.
 */
export function olayBirKez<A extends keyof OlayKatalogu>(
  anahtar: string,
  ad: A,
  veri: OlayKatalogu[A],
): void {
  if (gonderilen.has(anahtar)) return
  gonderilen.add(anahtar)
  olay(ad, veri)
}
