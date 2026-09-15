-- tahmin.net — şarkı havuzu şeması
--
-- Tek tablo yeter: 321 şarkı, birkaç filtre. İlişkisel karmaşıklığa gerek yok.
-- Kolon adları okunaklı tutuldu (panelde SQL editöründen bakılabilsin);
-- oyuna servis edilirken kompakt biçime çevriliyor (src/data/schema.ts).

create table if not exists public.songs (
  id           text primary key,          -- "itunes:1834674002"
  category     text        not null,      -- pop | rap | arabesk | ...
  title        text        not null,
  artist       text        not null,
  artwork      text        not null,      -- 100x100; istemci 600x600'e yükseltir
  preview      text        not null,      -- Apple CDN, imzasız ve kalıcı
  store_url    text        not null,      -- Apple Music bağlantısı (ToS gereği)
  clip_start   real        not null default 0.325,
  duration     real        not null default 29,
  year         int         not null,      -- ORİJİNAL çıkış yılı (küratör verir)
  era          text        not null,      -- 70 | 80 | 90 | 00 | 10 | 20
  tier         smallint    not null check (tier between 1 and 5),
  enabled      boolean     not null default true,
  norm_title   text        not null,      -- Türkçe-normalize edilmiş eşleştirme alanları
  norm_artist  text        not null,
  accept_keys  text[]      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Oyunun tek sorgu deseni: kategori + kademe + dönem, yalnızca açık şarkılar.
create index if not exists songs_category_idx on public.songs (category) where enabled;
create index if not exists songs_tier_idx     on public.songs (tier)     where enabled;
create index if not exists songs_era_idx      on public.songs (era)      where enabled;

-- updated_at kendiliğinden tazelensin.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists songs_touch_updated_at on public.songs;
create trigger songs_touch_updated_at
  before update on public.songs
  for each row execute function public.touch_updated_at();

-- --- Güvenlik ---
--
-- RLS açık. Herkes YALNIZCA açık şarkıları OKUYABİLİR; hiç kimse tarayıcıdan
-- YAZAMAZ. Yazma işlemleri yalnızca sunucu tarafındaki secret key ile yapılır
-- (service_role RLS'i baypas eder), o da yönetim paneli şifresiyle korunur.

alter table public.songs enable row level security;

drop policy if exists songs_public_read on public.songs;
create policy songs_public_read on public.songs
  for select to anon, authenticated
  using (enabled = true);

-- --- Yönetim paneli ekleri ---
--
-- Aynı şarkının yeniden basım/remaster kopyası farklı bir trackId ile gelir ve
-- `id` primary key'i onu yakalayamaz. Normalize edilmiş sanatçı+şarkı çifti
-- kategori içinde tekil olmalı: hem kopyayı engeller hem toplu eklemede
-- `on_conflict` hedefi olur.
-- ⚠️ Kopya satır varsa bu indeks kurulamaz. Bütün şemayı tek sorgu olarak
-- çalıştıran `db:migrate` böyle bir durumda komple düşmesin diye hata
-- yutuluyor: eksik bir indeks, kurulamayan bir şemadan iyidir. Kopyaları
-- panelden temizleyip tekrar çalıştır.
do $$
begin
  create unique index if not exists songs_norm_uidx
    on public.songs (category, norm_artist, norm_title);
exception when unique_violation then
  raise notice 'songs_norm_uidx kurulamadi: ayni (kategori, sanatci, sarki) birden fazla satirda var.';
end $$;

-- Panelin sıralama deseni: kategori → kademe → sanatçı.
create index if not exists songs_admin_idx on public.songs (category, tier, artist);

-- Yıl, dönem hesabının girdisi; aralık dışı bir değer `era`yı bozar.
alter table public.songs drop constraint if exists songs_year_chk;
alter table public.songs add constraint songs_year_chk
  check (year between 1900 and 2100);

-- --- İletişim mesajları ---
--
-- Site e-posta adresi yayınlamıyor; ziyaretçi formu doldurur, mesaj burada
-- birikir ve yönetim panelinden okunur. Posta gönderimi YOK — kurulum,
-- güvenlik ve maliyet olarak hiçbir karşılığı olmayan bir bağımlılık olurdu.
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  name        text        not null,
  surname     text        not null,
  body        text        not null,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists messages_new_idx on public.messages (created_at desc);

-- ⚠️ Uzunluk sınırları ŞEMADA. Uç nokta da doğruluyor ama tek savunma orası
-- olmamalı: yazma yolu secret key ile çalıştığı için RLS'i baypas ediyor.
alter table public.messages drop constraint if exists messages_len_chk;
alter table public.messages add constraint messages_len_chk check (
  length(name) between 1 and 80
  and length(surname) between 1 and 80
  and length(body) between 3 and 4000
);

-- RLS: mesajlar herkese açık DEĞİL. Ne okuma ne yazma politikası var; ikisi de
-- yalnızca sunucu tarafındaki secret key ile yapılır.
alter table public.messages enable row level security;

-- --- Düello ---
--
-- İki kişi, aynı 5 şarkı, kolaydan zora. Oyunun geri kalanı sunucuda hiçbir
-- şey saklamıyor; burası bilinçli bir istisna: iki tarayıcının aynı şarkılarda
-- buluşmasının başka yolu yok.
--
-- ⚠️ Bu, `/api/iletisim`'den sonra İKİNCİ herkese açık yazma yolu. Lobi
-- kurmak sınırsız satır üretebileceği için `expires_at` ve temizlik şart.

create table if not exists public.duels (
  code        text primary key,               -- 6 karakter, karışmayan alfabe
  chip        text        not null,
  song_ids    text[]      not null,           -- 5 şarkı, kademe 1→5 sırayla
  status      text        not null default 'bekliyor',
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  expires_at  timestamptz not null default now() + interval '2 hours',
  constraint duels_status_chk check (status in ('bekliyor', 'oynaniyor', 'bitti')),
  -- ⚠️ Şarkı sayısı ŞEMADA sabitleniyor: eksik listeyle kurulan bir lobi
  -- oyunu ortasında çökertirdi.
  constraint duels_songs_chk check (array_length(song_ids, 1) = 5)
);

create index if not exists duels_expire_idx on public.duels (expires_at);

create table if not exists public.duel_players (
  code       text    not null references public.duels(code) on delete cascade,
  slot       smallint not null check (slot in (1, 2)),
  -- Tarayıcıda saklanan gizli anahtar; başkasının yerine cevap yazmayı önler.
  secret     text    not null,
  joined_at  timestamptz not null default now(),
  primary key (code, slot)
);

create table if not exists public.duel_answers (
  code          text     not null references public.duels(code) on delete cascade,
  slot          smallint not null check (slot in (1, 2)),
  song_index    smallint not null check (song_index between 0 and 4),
  won           boolean  not null,
  heard_seconds real     not null,
  listens       smallint not null,
  at            timestamptz not null default now(),
  -- ⚠️ Tek cevap kuralı: aynı şarkıya ikinci kez yazmak skoru bozardı.
  primary key (code, slot, song_index)
);

-- RLS: üçü de tamamen kapalı. Ne okuma ne yazma politikası var; her şey
-- sunucu rotalarından, secret key ile yapılır. Tarayıcı `song_ids`'i
-- doğrudan okuyamaz.
alter table public.duels        enable row level security;
alter table public.duel_players enable row level security;
alter table public.duel_answers enable row level security;

-- Süresi dolmuş lobileri temizler; cevaplar ve oyuncular cascade ile gider.
create or replace function public.duel_temizle()
returns integer language plpgsql as $$
declare silinen integer;
begin
  delete from public.duels where expires_at < now();
  get diagnostics silinen = row_count;
  return silinen;
end $$;

-- --- Yönetim kimliği ve hız sınırı ---
--
-- ⚠️ Şifre ARTIK ORTAM DEĞİŞKENİNDE DEĞİL. Eski tasarımda oturum çerezi
-- `sha256(şifre + ":tahmin.net")` idi: tuzsuz, statik bir türev. Sonuçları
-- şunlardı — çıkış yapmak çerezi iptal etmiyordu (sunucu tarafında hâlâ
-- geçerliydi), sunucu tarafında süre sonu yoktu, ve çerezi ele geçiren biri
-- ADMIN_PASSWORD'ü çevrimdışı kırabiliyordu.
--
-- Not: burası env'den "daha güvenli" olduğu için seçilmedi — veritabanına
-- zaten env'deki secret key ile gidiliyor. Kazanç şifrenin NASIL durduğundan
-- geliyor: tuzlu scrypt + rastgele oturum kimliği, yani gerçek iptal, gerçek
-- süre sonu ve yeniden dağıtım olmadan şifre değiştirme.

create table if not exists public.admin_hesap (
  id           smallint primary key default 1 check (id = 1),
  parola_hash  text        not null,
  tuz          text        not null,
  guncellendi  timestamptz not null default now()
);

create table if not exists public.admin_oturum (
  id           text        primary key,   -- randomBytes(32), türev değil
  olusturuldu  timestamptz not null default now(),
  son_gorulme  timestamptz not null default now(),
  biter        timestamptz not null default now() + interval '30 days'
);

create index if not exists admin_oturum_biter_idx on public.admin_oturum (biter);

-- Herkese açık yazma yollarının sayacı. Ham IP TUTULMAZ, yalnızca özeti.
create table if not exists public.hiz_sinir (
  anahtar  text        primary key,
  sayac    integer     not null default 0,
  pencere  timestamptz not null default now()
);

create index if not exists hiz_sinir_pencere_idx on public.hiz_sinir (pencere);

alter table public.admin_hesap  enable row level security;
alter table public.admin_oturum enable row level security;
alter table public.hiz_sinir    enable row level security;

/*
 * Atomik hız sınırı: tek gidiş-dönüş, yarışa kapalı.
 *
 * `true` = isteğe izin var. Sayaç pencere dolduğunda sıfırlanır. Sayma ve
 * karar aynı deyimde olduğu için iki eşzamanlı istek aynı sayacı okuyup
 * ikisi birden geçemez.
 */
create or replace function public.hiz_sinir_dene(
  p_anahtar text,
  p_limit   integer,
  p_pencere interval
) returns boolean language plpgsql security definer as $$
declare v_sayac integer;
begin
  insert into public.hiz_sinir as h (anahtar, sayac, pencere)
  values (p_anahtar, 1, now())
  on conflict (anahtar) do update
    set sayac   = case when h.pencere < now() - p_pencere then 1 else h.sayac + 1 end,
        pencere = case when h.pencere < now() - p_pencere then now() else h.pencere end
  returning h.sayac into v_sayac;

  return v_sayac <= p_limit;
end $$;

/*
 * Sayacı ARTIRMADAN bakar: "bu kova şu an kilitli mi?"
 *
 * ⚠️ Giriş uç noktasında saymak ile bakmak AYRILMAK ZORUNDA. `hiz_sinir_dene`
 * her çağrıda artırıyor, yani BAŞARILI girişler de kaba kuvvet bütçesini
 * yiyordu: doğru şifreyle üç kez giren kendini kilitliyordu. Doğrusu, denemeden
 * önce bakmak ve yalnızca şifre YANLIŞ çıkınca saymak.
 *
 * Pencere geçmişse kova boşalmış sayılır; silme işini bir sonraki sayım yapar.
 */
create or replace function public.hiz_sinir_bak(
  p_anahtar text,
  p_limit   integer,
  p_pencere interval
) returns boolean language sql security definer as $bak$
  select coalesce(
    (select h.sayac < p_limit or h.pencere < now() - p_pencere
       from public.hiz_sinir h
      where h.anahtar = p_anahtar),
    true)
$bak$;

/*
 * Kovayı sıfırlar — başarılı girişten sonra çağrılır.
 *
 * Doğru şifreyi giren kişinin önceki başarısız denemeleri onu bir sonraki
 * oturumda kilitlememeli.
 */
create or replace function public.hiz_sinir_sil(p_anahtar text)
returns void language sql security definer as $sil$
  delete from public.hiz_sinir where anahtar = p_anahtar
$sil$;

/*
 * Düellonun beş şarkısını TEK sorguda seçer: her kademeden bir tane, rastgele.
 *
 * ⚠️ Bunun yerine beş ayrı `limit=400` sorgusu atılıyordu ve her biri TAM
 * satırı (başlık, sanatçı, kapak, önizleme URL'i, accept_keys) çekiyordu:
 * ~200 baytlık bir istek 2000 satır okutuyor, 5'i kullanılıyordu. Kimlik
 * doğrulaması olmayan bir uç nokta için bu, ücretsiz kademenin aylık çıkışını
 * birkaç bin istekte bitirebilecek bir yükselteçti.
 *
 * ⚠️ Aynı sorgu ikinci bir hatayı da kapatıyor: o `limit=400`'ün ORDER BY'ı
 * yoktu, yani düellolar hep aynı ~400 en eski satırdan seçiliyordu.
 */
create or replace function public.duello_sec(
  p_kategori text default null,
  p_donemler text[] default null
) returns table (id text, tier smallint) language sql stable as $$
  select distinct on (s.tier) s.id, s.tier
  from public.songs s
  where s.enabled
    and (p_kategori is null or s.category = p_kategori)
    and (p_donemler is null or s.era = any(p_donemler))
  order by s.tier, random()
$$;

/*
 * Süresi dolmuş satırları toplar: lobiler, oturumlar, hız sınırı sayaçları.
 *
 * ⚠️ Bunu ÇAĞIRAN bir zamanlayıcı yok. `duel_temizle` da aynı durumdaydı.
 * Supabase'de pg_cron varsa oraya bağlanmalı; yoksa lobi kurulurken seyrek
 * (1/50) tetikleniyor (bkz. `duelloKur`).
 */
create or replace function public.temizle()
returns integer language plpgsql as $$
declare silinen integer;
begin
  delete from public.duels where expires_at < now();
  get diagnostics silinen = row_count;
  delete from public.admin_oturum where biter < now();
  delete from public.hiz_sinir where pencere < now() - interval '1 day';
  return silinen;
end $$;

-- ---------------------------------------------------------------------------
-- Ünlü havuzu (ikinci oyun: görselden tanıma)
-- ---------------------------------------------------------------------------
--
-- ⚠️ `songs` tablosuna EKLENEMEZ: orada `artwork`, `preview` ve `store_url`
-- NOT NULL ve üçü de iTunes'a özgü. Ünlünün ne önizlemesi ne mağaza linki var.
--
-- Oyun: görsel beş eşit yatay şeride bölünür, başta yalnızca saç açıktır.
-- Yanlış tahmin ya da pas bir şerit daha açar; beşinci açılınca tur biter.

create table if not exists public.unluler (
  id           text primary key
                 default ('unlu:' || replace(gen_random_uuid()::text, '-', '')),
  category     text        not null,      -- sarkici | oyuncu | sporcu | tarihi | dunya
  name         text        not null,      -- gösterim adı
  norm_name    text        not null,      -- cleanKey(name)
  aliases      text[]      not null default '{}',
  accept_keys  text[]      not null default '{}',
  tier         smallint    not null check (tier between 1 and 5),
  enabled      boolean     not null default true,
  -- ⚠️ Görsel YOLU için kolon YOK: yol id'den TÜRETİLİR (`<id sonrası>.webp`).
  -- İki kaynak olsaydı yeniden kırpmada biri güncellenip diğeri eski kalabilir
  -- ve oyun var olmayan bir dosyayı isteyebilirdi.
  -- `image_ver` yalnızca önbellek kırmak için (`?v=2`).
  image_ver    smallint    not null default 1,
  -- Küratör notu ("futbolcu", "1980'ler"). Oyunda GÖSTERİLMEZ, cevabı ele verir.
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists unluler_category_idx on public.unluler (category) where enabled;
create index if not exists unluler_tier_idx     on public.unluler (tier)     where enabled;
create index if not exists unluler_admin_idx    on public.unluler (category, tier, name);

-- Aynı kategoride aynı ad iki kez olmasın. `songs_norm_uidx` ile aynı desen:
-- kurulamıyorsa (veri zaten kirliyse) migration'ı düşürmeden uyarı bırak.
do $uidx$
begin
  create unique index if not exists unluler_norm_uidx
    on public.unluler (category, norm_name);
exception when unique_violation then
  raise notice 'unluler_norm_uidx kurulamadi: ayni (kategori, ad) birden fazla satirda var.';
end $uidx$;

drop trigger if exists unluler_touch_updated_at on public.unluler;
create trigger unluler_touch_updated_at
  before update on public.unluler
  for each row execute function public.touch_updated_at();

-- RLS: `songs` ile aynı duruş — herkes yalnızca AÇIK satırları okur, kimse
-- tarayıcıdan yazamaz.
alter table public.unluler enable row level security;
drop policy if exists unluler_public_read on public.unluler;
create policy unluler_public_read on public.unluler
  for select to anon, authenticated
  using (enabled = true);

-- --- Görsel deposu ---
--
-- ⚠️ Kova HERKESE AÇIK. Özel kova imzalı URL demek: her tur için ek bir sunucu
-- gidiş-dönüşü, süresi dolan önyükleme adayları ve kenar önbelleğinin işe
-- yaramaması. Üstelik gizlilik kazancı yok — havuz yanıtı zaten adları
-- taşıyor, cevabı saklayan şey görselin URL'i değil.
--
-- ⚠️ `storage.objects` üzerine YAZMA POLİTİKASI EKLENMİYOR. Politika yokken
-- RLS her şeyi reddeder ve yalnızca secret key (service_role) geçer — yani
-- varsayılan zaten istediğimiz şey.
insert into storage.buckets (id, name, public)
values ('unluler', 'unluler', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Düellonun ikinci oyuna açılması
-- ---------------------------------------------------------------------------
--
-- ⚠️ Lobi kaydında oyunun hangisi olduğunu söyleyen HİÇBİR ŞEY yoktu:
-- `/duello/<kod>` hangi kabuğu açacağını bilemiyordu.
--
-- `default 'sarki'` mevcut satırları güvene alıyor. Lobiler 2 saatte zaten
-- geçersizleşiyor, yani riskli pencere dar; yine de varsayılan şart.
alter table public.duels add column if not exists oyun text not null default 'sarki';
alter table public.duels drop constraint if exists duels_oyun_chk;
alter table public.duels add constraint duels_oyun_chk check (oyun in ('sarki', 'unlu'));

-- ⚠️ `duels_songs_chk (= 5)` ve `song_index between 0 and 4` GEVŞETİLMİYOR.
-- İki oyun da beş turluk (kademe 1→5). Çalışan bir kısıtı sebepsiz açmak,
-- ileride beş olmayan bir dizinin sessizce yazılmasına kapı aralardı.
--
-- ⚠️ `song_ids` ve `song_index` adları da DEĞİŞMİYOR. `oge_ids`'e yeniden
-- adlandırmak dört API rotasını, `duelStore`'u, `useDuello`'yu ve testleri aynı
-- anda kırar; kazanç yalnızca isimlendirme.
comment on column public.duels.song_ids is
  'Tur kimlikleri — oyuna göre itunes:* ya da unlu:*. Ad tarihsel.';

-- Oyundan BAĞIMSIZ sıralama ölçütü.
--
-- ⚠️ `heard_seconds` ve `listens` ses metriği; ünlü turunda karşılıkları yok.
-- Onları "şerit sayısı" anlamında kullanmak sessiz bir aşırı yükleme olurdu.
-- `maliyet` az olan iyidir: şarkıda duyulan saniye, ünlüde açılan şerit.
alter table public.duel_answers add column if not exists maliyet real not null default 0;
alter table public.duel_answers add column if not exists ikincil smallint not null default 0;

-- Ünlü düellosunun beş kişisi: her kademeden bir tane, rastgele.
--
-- ⚠️ `duello_sec` parametrize edilmedi, İKİNCİ fonksiyon yazıldı. SQL'de
-- dinamik tablo adı `execute` demek; o da `distinct on (tier)` planını ve
-- `stable` işaretini kaybettirirdi.
create or replace function public.duello_sec_unlu(p_kategori text default null)
returns table (id text, tier smallint) language sql stable as $secunlu$
  select distinct on (u.tier) u.id, u.tier
  from public.unluler u
  where u.enabled
    and (p_kategori is null or u.category = p_kategori)
  order by u.tier, random()
$secunlu$;

-- ---------------------------------------------------------------------------
-- Kapaktan Albüm oyunu
-- ---------------------------------------------------------------------------
-- Albüm adı: iTunes `collectionName` HAM hâliyle ("… - Single", "(Deluxe)").
-- Temizleme kodda (`src/text/album.ts`); ham veri saklanıyor ki temizleme
-- kuralı değişince 15 bin şarkıyı Apple'a yeniden sormak gerekmesin.
--
-- ⚠️ `null` = henüz sorulmadı · `''` = Apple'da bulunamadı (mağazadan kalkmış).
-- Ayrım doldurma betiğinin yeniden çalıştırılabilir olması için şart:
-- `null` olanlar tekrar sorulur, `''` olanlar sorulmaz ve oyuna girmez.
alter table public.songs add column if not exists album text;

-- Kapaktan Albüm düellosu.
--
-- ⚠️ `song_ids` bu oyunda `kapak:<albüm kimliği>` taşıyor (bkz. `lib/kapakHavuzSunucu.ts`).
-- Albüm tablosu yok; albüm kaydı şarkı satırlarından türetiliyor.
alter table public.duels drop constraint if exists duels_oyun_chk;
alter table public.duels add constraint duels_oyun_chk check (oyun in ('sarki', 'unlu', 'kapak'));

-- Lobiyi kuranın Kolay mod tercihi: iki oyuncuya AYNI kabul kuralı uygulanır.
-- Her oyuncu kendi ayarıyla oynasaydı biri sanatçı adıyla, diğeri yalnızca
-- albüm adıyla bilebilirdi. Diğer oyunlarda `null`.
alter table public.duels add column if not exists kolay boolean;
