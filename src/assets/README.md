# Gömülü yazı tipleri

Bunlar yalnızca **paylaşım görselinin** üretiminde kullanılır (`ImageResponse`
/ Satori). Tarayıcıya gitmezler; sayfa fontları `next/font` ile yüklenir.

⚠️ Neden depoda duruyorlar: Satori bir `ArrayBuffer` ister ve `next/font`'un
indirdiği dosyalar çalışma zamanında adreslenemez. Çalışma anında Google'dan
çekmek görselin üretimini dış bir servise bağımlı hâle getirirdi — paylaşım
kartı, tweet atıldığı anda üretilmek zorunda.

Üçü de SIL Open Font License 1.1 altında; yeniden dağıtım serbest.

- `InstrumentSerif-Italic.ttf` — marka yazısı
- `IBMPlexMono-Regular.ttf` — etiketler

Not: IBM Plex Sans yalnızca değişken font olarak yayınlanıyor ve Satori onu
güvenilir işlemiyor; görselde bilinçli olarak serif + mono ikilisi kullanıldı.
