/**
 * Sahne renk tonunun (`--hue`) bir sonraki değeri — EN KISA YOLDAN.
 *
 * ⚠️ `--hue` CSS'te `<number>` olarak kaydırılıyor (`@property`, bkz.
 * globals.css). Sayı olarak kaymak renk dairesinde UZUN yolu seçebiliyor:
 * Pop (330) → Rap (80) geçişi 330 → 205 → 80 diye mavi ve yeşilden geçiyordu.
 * Kategoriler art arda değiştirilince başlıktaki yazı gökkuşağı gibi yanıp
 * sönüyordu (ölçüldü: 326 → 172 → 98 → 34).
 *
 * Çözüm hedefi bir önceki DEĞERE en yakın eşdeğere taşımak: 330'dan 80'e
 * gidilirken hedef 440 olur. `oklch()` tonu 360'a göre sardığı için 440 ile 80
 * aynı renk; kayma 250 derece yerine 110 derece sürer.
 *
 * ⚠️ Değer sınırsız büyüyebilir (her tur en fazla 180 derece). Normalize
 * edilmiyor: 440'tan 80'e atlamak kendisi bir geçiş başlatır ve renk bir tur döner.
 */
export function enKisaTon(onceki: number, hedef: number): number {
  const fark = ((((hedef - onceki) % 360) + 540) % 360) - 180
  return onceki + fark
}
