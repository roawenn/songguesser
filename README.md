# tahmin.in

Türkçe şarkı tahmin oyunu. Yarım saniyelik bir klip çalınır; her yanlış tahmin
ya da pas klibi uzatır. Hesap yok, kayıt yok — gir ve oyna.

Arayüz `theme/Nakarat.dc.html` (Claude Design) tasarımının React'e taşınmış
hâlidir: retro kaset, fare takipli spot ışığı, CRT tarama çizgileri.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Kurulum

```bash
npm install
cp .env.ornek .env.local   # değerleri doldur
npm run dev                # http://localhost:3000
```

Ortam değişkenleri (`.env.local`, git'e girmez):

| Değişken | Ne işe yarar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Herkese açık okuma anahtarı (tarayıcıya iner, sorun değil) |
| `SUPABASE_SECRET_KEY` | **Gizli.** Yalnızca sunucuda, yazma işlemleri için |
| `YONETICI_EPOSTALAR` | Yönetim paneline girebilecek Google hesapları (virgülle) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google ile giriş (oyuncu hesabı ve panel yetkisi) |
| `SUPABASE_DB_URL` | Yalnızca migration script'i için (pooler bağlantısı) |

Vercel'e deploy ederken hepsini Project Settings → Environment Variables'a ekle
(Production ve Development; Preview'a girmeyin — önizleme adresleri Google'da kayıtlı değil).

## Şarkı havuzunu yönetmek

Şarkılar **Supabase**'de. Yönetim paneli **/yonetim** adresinde — yayında da
çalışır, **Google hesabıyla** korunur: e-postası `YONETICI_EPOSTALAR` içinde
olan kişi girebilir, başka herkes **404** görür.

**Şarkı eklemek:** üstteki kutuya sanatçı ve şarkı adını yaz. iTunes sonuçları
kapağıyla ve dinlenebilir önizlemesiyle gelir; kademeyi seç, `Ekle`'ye bas.
Şarkı **anında** oynanabilir — arama sonucu preview, kapak ve mağaza
bağlantısını birlikte getirdiği için ayrı bir çözümleme adımı yok.

**Düzenlemek:** zorluk, yıl ve açık/kapalı doğrudan tablodan değiştirilir.
Ayrı bir "Kaydet" yok; her değişiklik anında yazılır ve oyunun önbelleği
tazelenir.

### Güvenlik

- Tablo **RLS** altında: herkes yalnızca *açık* şarkıları okuyabilir,
  tarayıcıdan hiç kimse yazamaz.
- Yazma işlemleri sunucu rotalarından geçer ve `SUPABASE_SECRET_KEY` ile
  yapılır. Bu anahtar **tarayıcıya hiç gitmez**.
- Panelde **parola yok**. Yetki Google hesabına bağlı ve liste ortam
  değişkeninde (`YONETICI_EPOSTALAR`) — veritabanında değil, çünkü veritabanına
  yazabilen biri kendini yönetici yapabilmemeli.
- Yetkisiz her istek **404** döner (401 değil): panelin varlığı bile sızmaz.
- Yönetici oturumu **12 saat**; uzatmak için Google'a `prompt=login` ile
  gidilir, yani Google parolayı/2FA'yı yeniden sorar. Çalınmış bir Google
  **oturum çerezi** tek başına paneli açmaz.
  ⚠️ Bu garanti Google'ın davranışına dayanıyor, imzalı bir kanıta değil:
  `auth_time` iddiası kanıt olurdu ama Google onu göndermiyor (ölçüldü).
  Gönderdiğinde denetleniyor — bkz. `authTimeUygun`.
- Panelin güvenliği artık o Google hesabının güvenliği: **2FA şart**.
- Yönetim yazma yolları `Origin` denetimi (CSRF) ister.

### Ücretsiz planı korumak

Oyunun okuduğu `/api/havuz/<çip>` rotası Next'in veri önbelleğinde
`havuz` etiketiyle tutulur ve derleme sırasında önceden üretilir. Yani
oyuncular Supabase'e değil CDN'e vurur. Panelden bir değişiklik yapıldığında
etiket geçersizleştiği için yayın yine **anında** olur.

Ücretsiz planın kotası **5 GB sıkıştırılmamış + 5 GB CDN önbellekli** egress.
Kotanın iki katına çıktığı (9,99 GB, %99,9'u PostgREST) bir ay sonrası ölçülen
dört kaynak ve alınan önlemler:

1. **Havuz okumaları veri önbelleğine HİÇ girmiyordu.** `next: { revalidate,
   tags }` yazılıydı ama Next yalnızca `200` dönen yanıtları saklıyor
   (`patch-fetch.js`), sayfalama ise `Prefer: count=exact` yüzünden
   `206 Partial Content` alıyordu. Sonuç: `.next/cache/fetch-cache` içinde tek
   bir havuz girdisi yok ve SOĞUK her istek 16 sayfalık tam okuma. Tek
   koruma, süreç ömrü kadar yaşayan bellek önbellekleriydi; HMR'de ve her yeni
   sunucu örneğinde sıfırlanıyordu. Sayım artık ~200 baytlık ayrı bir isteğe
   alındı, sayfalar `200` dönüyor ve önbelleğe giriyor (ölçüldü: aynı uç nokta
   2,8 sn → 0,03 sn, 16 sayfa önbellekte).
2. **Sıkıştırma yoktu.** Node'un `fetch`'i, tarayıcının aksine,
   `Accept-Encoding` başlığını KENDİLİĞİNDEN göndermiyor; Supabase de
   istenmedikçe sıkıştırmıyor. Yani her okuma ham JSON iniyordu. Ölçüm (1000
   satır, `POOL_COLUMNS`): **333 KB → 47 KB**. Tam "Karışık" havuz 5,1 MB →
   722 KB; yönetim panelinin listesi 12 MB → 2 MB. Başlık artık
   `restHeaders` içinde, yani BÜTÜN okuma ve yazmalar sıkıştırılmış geliyor.
3. **Zamanlayıcı fazla sıktı.** 11 seçki × (şarkı + kapak) = 22 önbellek
   anahtarı saat başı tazeleniyordu: tek başına ayda ~2,2 GB. Aralık 6 saate
   çıkarıldı (~0,4 GB). Tazelik etkilenmez — yayın `revalidateTag` ile anında.
4. **Depo görselleri `no-cache` ile duruyordu.** Supabase Storage yükleme
   sırasında `Cache-Control` verilmezse nesneye `no-cache` yazıyor: tarayıcı
   görseli her turda yeniden doğruluyor. Yükleme artık bir yıllık `immutable`
   başlık yazıyor (adreste `?v=<image_ver>` olduğu için güvenli).

⚠️ Panelden yapılan **her** kayıt `revalidateTag('havuz')` çağırıyor ve bu 22
anahtarın hepsini düşürüyor; yani yoğun küratörlük yapılan bir günde havuz
defalarca yeniden okunuyor (sıkıştırmayla okuma başına ~3 MB). Kota yine
zorlanırsa sıradaki adım etiketi seçki başına bölmek (`havuz:<çip>`).

### Veritabanı kesintisi

Supabase'e ulaşılamazsa oyun `public/data/pool/*.json` yedeğinden devam eder.
Bu dosyaları tazelemek için:

```bash
npm run pool:snapshot
```

Toplu değişiklikten sonra çalıştırıp commit et.

### Toplu şarkı eklemek

Normal yol **panel**: `/yonetim` → *Sanatçı tara* → sanatçı çipine tıkla →
Apple TR'de mevcut şarkılar listelenir → tik at → *Seçilenleri ekle*. Kaç şarkı
seçersen seç tek istek gider, kademe seçimi hepsine uygulanır ve havuzda zaten
olanlar listeye hiç girmez.

Terminal tarafındaki eski TSV akışı da duruyor ama artık **arşiv**:

```bash
npx tsx scripts/suggest.ts rap    # Apple TR'de MEVCUT adayları listeler
# beğendiklerini data/curated/rap.tsv içine taşı
npm run pool:build -- rap         # data/arsiv/pool/ altına JSON üretir
npm run db:migrate                # JSON'u Supabase'e taşır
```

⚠️ **Veri tek yönde akar: Supabase → `pool:snapshot` → `public/data/pool/`.**
`pool:build` eskiden aynı dosyalara TSV'den yazıyordu; panelden şarkı
ekledikten sonra çalıştırmak yedeği eski hâline döndürüyor ve Supabase
kesintisinde o şarkıları kaybettiriyordu. Artık `data/arsiv/pool/` altına
yazıyor, yani canlı yedeğe dokunamaz.

### Zorluk

Kategori şeridinin altındaki zorluk seçicisi (Kolay · Orta · Zor · Uzman ·
İmkansız) doğrudan şarkının kademesini filtreler. Yani panelde verdiğin kademe,
oyuncunun gördüğü zorluktur. Kademeler kendi renklerini taşır; sahne rengi ise
kategoriden gelir.

Bir kategoride o kademe çok inceyse süzgeç komşu kademeleri de alır
(`MIN_PLAYABLE`, `src/game/select.ts`).

Tahmin yardımı ayrı bir ayardır: Ayarlar sayfasındaki **Kolay arama** anahtarı
yazarken öneri listesinin çıkıp çıkmayacağını belirler.

## Mimari notlar

**Klip merdiveni** sabittir: 0,5 → 1 → 2 → 5 → 10 saniye, beş adım
(`src/game/ladder.ts`). Bir adımı üç şey tüketir — klibi **sonuna kadar
dinlemek**, yanlış tahmin, pas. Yani her Çal bir üst kademeyi açar ve aynı
uzunluk iki kez dinlenemez.

⚠️ İki incelik, ikisi de `src/game/machine.ts` içinde ve testleri var:

- **Dinlemek turu bitirmez.** Beş adımın hepsi dinlemeyle harcanırsa Çal kapanır
  ama bir tahmin hakkı kalır; tur yalnızca yanlış tahminle ya da pasla kaybedilir.
- **Takılma adım tüketmez.** Sayaç `PLAY`'de değil `CLIP_END`'de artar, bu
  yüzden ağ hatası (`CLIP_STALL`) oyuncuya hiçbir şeye mal olmaz.

İlerleme çubuğu songspot davranışındadır: her çalmada sıfırdan başlar, klip
süresince o kademenin sonuna süpürür, bitince duyulan yerde kalır.

**Animasyonlar** — `prefers-reduced-motion` KASITLI olarak okunmaz. Windows'ta
"Animasyon efektleri" kapalı olan makinelerde Chrome bu tercihi bildiriyor ve
makara dönüşünden konfetiye kadar oyunun bütün geri bildirimi tek bayrakla
ölüyordu; üstelik `globals.css`'teki `!important` kuralı yüzünden JS'ten geri
açmanın yolu yoktu. Tek kaynak artık Ayarlar'daki anahtar: `GameShell`
`<html data-motion="reduced">` yazar, CSS de o özniteliğe bakar.

**Algılanan gecikme** `PREROLL` ile doğrudan ilişkilidir (`src/audio/envelope.ts`).
Ön-yuvarlanma sessiz çalındığı için kullanıcı o kadar süre ölü hava duyar; 300 ms
denendiğinde 0,5 saniyelik klipte "sesin yarısı yok" gibi hissettiriyordu. Şu an
45 ms. Sayaç ve ilerleme çubuğu `clipPlayer.plateauStart`'ı bekler, yani sesin
gerçekten duyulmaya başladığı anı.

**Ses** — `src/audio/`. Klip zarfı `AudioContext.currentTime` üzerinde mutlak
zamanlara planlanır; `setTimeout` klibi bitirmek için asla kullanılmaz. 0,1
saniyelik klibin tık sesi çıkarmaması için zarfın omuzları klibin *dışında*
tutulur: pencereden önce 300 ms sessizlik altında ön-yuvarlanma yapılır, böylece
tam kazançtaki plato tam olarak istenen süre kadar olur. Ayrıntı:
`src/audio/envelope.ts`.

**Türkçe eşleştirme** — `src/text/`. `toLowerCase()` bu klasörün dışında
kullanılmamalıdır: `"İSTANBUL".toLowerCase()` görünmez bir birleşen nokta
(U+0307) üretir ve sonraki her karşılaştırmayı bozar; `"ILGIN"` de `"ilgin"`
olur, oysa doğrusu `"ılgın"`dır.

**Yasal** — Ses önizlemeleri doğrudan Apple sunucularından stream edilir; hiçbir
ses baytı proxy'lenmez, indirilmez veya saklanmaz. Build sırasında doğrulama bile
yalnızca 1 baytlık `Range` isteğiyle yapılır. Her turun sonunda parçanın Apple
Music bağlantısı ve sayfa altında kalıcı atıf gösterilir.

## Doğrulama

```bash
npm test                    # Türkçe normalizasyon + oyun mantığı
npm run pool:verify         # preview URL canlılığı + kapsam raporu
npm run build
```

Ses motorunu elle dinleyerek denemek için: `/dev/audio`. Geliştirme modunda
konsoldan `__tahmin.lastTiming` ve `__tahmin.lastFailure` okunabilir —
takılmalar kullanıcıya yalnızca "bağlantı takıldı" olarak gösterildiği için
gerçek sebebi görmenin tek yolu budur. Her kademede tık sesi
olmamalı ve ölçülen sapma ±10 ms içinde kalmalı. **iOS Safari'de gerçek cihazda
denenmeli** — AudioContext kilidi ve `preload` davranışı emülatörde temsil
edilmiyor.
