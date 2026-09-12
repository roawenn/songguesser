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
