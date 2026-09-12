const fs = require('fs')

/**
 * nakarat -> tahmin.net
 *
 * Kurallar:
 *  - Görsel marka (üst bant, kaset, OG görselleri): "tahmin"  (kullanıcı tercihi)
 *  - Site adı / metinler / metadata:                "tahmin.net"
 *  - Alan adı:                    nakarat.app    -> tahmin.net
 *  - Tanımlayıcılar (çerez, depo anahtarı, UA):    tahmin
 *  - ⚠️ `theme/Nakarat.dc.html` GERÇEK BİR DOSYA — ona giden yollar DEĞİŞMEZ.
 */
const düzenlemeler = [
  ['package.json', [[/"name": "nakarat"/, '"name": "tahmin-net"']]],

  ['scripts/lib/itunes.ts', [[/https:\/\/nakarat\.app/g, 'https://tahmin.net']]],
  ['scripts/lib/throttle.ts', [[/Nakarat\/0\.1/, 'tahmin.net/1.0']]],
  ['scripts/supabase/schema.sql', [[/^-- Nakarat —/m, '-- tahmin.net —']]],

  ['src/app/ClientGame.tsx', [[/nakarat:ayarlar:v3/g, 'tahmin:ayarlar:v3']]],
  ['src/game/challenge.ts', [[/nakarat:ayarlar:v3/g, 'tahmin:ayarlar:v3']]],
  ['src/hooks/useRound.ts', [[/nakarat:ayarlar:v3/g, 'tahmin:ayarlar:v3']]],
  ['src/store/useSettingsStore.ts', [[/nakarat:ayarlar:v3/, 'tahmin:ayarlar:v3']]],

  ['src/app/hakkinda/page.tsx', [[/\bNakarat\b/g, 'tahmin.net']]],
  ['src/app/nasil-oynanir/page.tsx', [[/\bNakarat\b/g, 'tahmin.net']]],

  ['src/app/layout.tsx', [
    [/https:\/\/nakarat\.app/g, 'https://tahmin.net'],
    [/\bNakarat\b/g, 'tahmin.net'],
    [/'nakarat',/, "'tahmin.net',"],
  ]],

  ['src/app/robots.ts', [[/https:\/\/nakarat\.app/g, 'https://tahmin.net']]],
  ['src/app/sitemap.ts', [[/https:\/\/nakarat\.app/g, 'https://tahmin.net']]],

  // OG görselleri: marka yazısı "tahmin", alt metin ve alan adı "tahmin.net".
  ['src/app/opengraph-image.tsx', [
    [/^ {14}Nakarat$/m, '              tahmin'],
    [/'Nakarat — Türkçe şarkı tahmin oyunu'/, "'tahmin.net — Türkçe şarkı tahmin oyunu'"],
    [/"nakarat · Pop/, '"tahmin.net · Pop'],
  ]],
  ['src/app/paylas/[kod]/opengraph-image.tsx', [
    [/^ {14}nakarat$/m, '              tahmin'],
    [/'Nakarat sonucu'/, "'tahmin.net sonucu'"],
    [/'nakarat\.app'/, "'tahmin.net'"],
  ]],
  ['src/app/meydan/[kod]/opengraph-image.tsx', [
    [/^ {14}nakarat$/m, '              tahmin'],
    [/'Nakarat meydan okuması'/, "'tahmin.net meydan okuması'"],
    [/'nakarat\.app'/, "'tahmin.net'"],
  ]],

  ['src/app/paylas/[kod]/page.tsx', [
    [/`nakarat · \$\{title\}`/g, '`tahmin.net · ${title}`'],
    [/^ {8}nakarat$/m, '        tahmin'],
  ]],
  ['src/app/meydan/[kod]/page.tsx', [[/`nakarat · \$\{title\}`/g, '`tahmin.net · ${title}`']]],

  // Görsel marka: üst bant ve kaset etiketi.
  ['src/components/shell/Chrome.tsx', [[/^ {8}nakarat$/m, '        tahmin']]],
  ['src/components/stage/Cassette.tsx', [[/^ {12}nakarat$/m, '            tahmin']]],

  ['src/audio/ClipPlayer.ts', [[/__nakarat/g, '__tahmin']]],
  ['src/audio/context.ts', [[/title: 'Nakarat'/, "title: 'tahmin.net'"]]],
  ['src/lib/itunesSearch.ts', [[/'Nakarat\/1\.0 \(song quiz\)'/, "'tahmin.net/1.0 (song quiz)'"]]],
  ['src/lib/adminAuth.ts', [
    [/'nakarat_yonetim'/, "'tahmin_yonetim'"],
    [/\$\{pw\}:nakarat/, '${pw}:tahmin.net'],
  ]],
]

let toplam = 0
for (const [dosya, kurallar] of düzenlemeler) {
  let s = fs.readFileSync(dosya, 'utf8')
  const önce = s
  for (const [ara, yaz] of kurallar) {
    if (!ara.test(s)) throw new Error(`${dosya}: eşleşmedi -> ${ara}`)
    s = s.replace(ara, yaz)
  }
  if (s !== önce) {
    fs.writeFileSync(dosya, s)
    toplam++
  }
}
console.log(`${toplam} dosya güncellendi`)
