/**
 * E-posta normalleştirme ve yönetici listesi eşleştirmesi — SAF, testli.
 *
 * ⚠️ BU DOSYA `src/text/` ALTINDA, çünkü `.toLowerCase()` çağırıyor ve projede
 * o çağrı yalnızca bu klasörde serbest (bkz. `normalize.ts`). Buradaki kullanım
 * bilinçli olarak `turkishLower` DEĞİL: o, `"ILGAR"`'ı `"ılgar"` yapar ve
 * `bilgehanilgar@gmail.com` ile `BILGEHANILGAR@GMAIL.COM` bir daha asla
 * eşleşmezdi. E-posta adresleri ASCII, yani Türkçe küçültme kurallarının işi yok.
 *
 * ⚠️ Yönetici yetkisi bu karşılaştırmaya dayanıyor (bkz. `lib/adminAuth`), o
 * yüzden kurallar dar ve açık: tam eşleşme, liste boşsa kimse yönetici değil.
 */

/** Gmail'in nokta ve `+etiket` biçimlerini aynı hesap saydığı alan adları. */
const GMAIL_ALANLARI = new Set(['gmail.com', 'googlemail.com'])

/**
 * Karşılaştırma için e-posta anahtarı.
 *
 * ⚠️ Nokta silme ve `+` kırpma YALNIZCA Gmail alan adlarında. Gmail bu
 * biçimleri aynı kutuya düşürüyor — yani `bilgehan.ilgar@gmail.com` adresini
 * başkası alamaz ve normalleştirmek yetkiyi genişletmez, yalnızca Google bir
 * gün adresi noktalı döndürürse kilitlenmeyi önler. Diğer alan adlarında nokta
 * ANLAMLIDIR (`ad.soyad@sirket.com` başka bir kişidir), o yüzden dokunulmaz.
 */
export function epostaNormu(ham: string): string {
  const s = ham.normalize('NFC').trim().toLowerCase()
  const at = s.lastIndexOf('@')
  if (at <= 0 || at === s.length - 1) return s

  const alan = s.slice(at + 1)
  if (!GMAIL_ALANLARI.has(alan)) return s

  const yerel = s.slice(0, at).split('+')[0]!.replace(/\./g, '')
  // Nokta ve etiket silindikten sonra yerel kısım boşaldıysa adres zaten geçersiz.
  return yerel ? `${yerel}@${alan}` : s
}

/**
 * `YONETICI_EPOSTALAR` listesini okur.
 *
 * Virgülle ayrılmış, boşluklara aldırmayan bir liste. Tanımsız ya da boşsa
 * sonuç boş küme — yani KİMSE yönetici değil.
 */
export function yoneticiListesi(ham: string | undefined | null): Set<string> {
  if (!ham) return new Set()
  return new Set(
    ham
      .split(',')
      .map((e) => epostaNormu(e))
      .filter((e) => e.length > 0 && e.includes('@')),
  )
}

/**
 * Bu e-posta yönetici mi?
 *
 * ⚠️ AÇIĞA DEĞİL KAPALIYA DÜŞER: liste yoksa, boşsa ya da e-posta boşsa `false`.
 * Yanlış yazılmış bir ortam değişkeni paneli herkese açmamalı.
 *
 * ⚠️ Sabit zamanlı karşılaştırmaya gerek YOK: karşılaştırılan şey bir sır değil,
 * Google'ın doğruladığı e-posta. Saldırgan zamanı ölçerek listeyi öğrense bile
 * o adresin Google hesabına sahip olmadan hiçbir şey yapamaz.
 */
export function yoneticiMi(eposta: string | null | undefined, liste: string | undefined | null): boolean {
  if (!eposta) return false
  const norm = epostaNormu(eposta)
  if (!norm || !norm.includes('@')) return false
  return yoneticiListesi(liste).has(norm)
}
