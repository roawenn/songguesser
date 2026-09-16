import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Gizlilik ve KVKK Aydınlatma Metni',
  description: 'tahmin.net hangi kişisel verileri, hangi amaçla ve ne kadar süre işler; haklarını nasıl kullanırsın.',
  alternates: { canonical: '/gizlilik' },
}

/**
 * ⚠️ VERİ SORUMLUSU BİLGİSİ YER TUTUCU. Yayından önce site sahibinin adı ve
 * başvuru e-postası yazılmalı — KVKK md. 10 aydınlatmada veri sorumlusunun
 * kimliğini zorunlu tutuyor.
 */
const VERI_SORUMLUSU = '[Veri sorumlusunun adı soyadı]'
const BASVURU_EPOSTA = '[başvuru e-posta adresi]'
const SON_GUNCELLEME = '16 Eylül 2026'

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-ink-0">{baslik}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export default function GizlilikPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">Gizlilik ve KVKK Aydınlatma Metni</h1>
      <p className="mt-3 text-sm text-ink-3">Son güncelleme: {SON_GUNCELLEME}</p>

      <div className="mt-8 flex flex-col gap-8 text-ink-2 leading-relaxed">
        <Bolum baslik="Veri sorumlusu">
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) kapsamında veri sorumlusu{' '}
            <strong className="text-ink-0">{VERI_SORUMLUSU}</strong>&rsquo;dur (tahmin.net). Başvuru ve sorular için:{' '}
            <strong className="text-ink-0">{BASVURU_EPOSTA}</strong> ya da{' '}
            <Link href="/hakkinda" className="underline underline-offset-4">iletişim formu</Link>.
          </p>
        </Bolum>

        <Bolum baslik="Üye olmadan oynarken">
          <p>
            Oyunlar üyelik gerektirmez. İstatistiklerin ve ayarların yalnızca kendi tarayıcında
            (localStorage) durur. Günlük modda, kaldığın turdan devam edebilmen için tarayıcına
            rastgele bir cihaz anahtarı yazılır; sunucuda bu anahtarın yalnızca geri çevrilemez özeti,
            o günkü tahminlerin ve puanın saklanır.
          </p>
          <p>
            Kötüye kullanımı önlemek için IP adresinin <strong className="text-ink-0">tuzlanmış özeti</strong>{' '}
            işlenir; ham IP adresi saklanmaz.
          </p>
        </Bolum>

        <Bolum baslik="Google ile giriş yaptığında">
          <p>Sıralamaya girmek isteğe bağlıdır. Giriş yaparsan şu veriler işlenir:</p>
          <ul className="list-disc pl-5">
            <li>Google hesap kimliğin (değişmeyen bir numara) ve e-posta adresin,</li>
            <li>seçtiğin kullanıcı adı (sıralamada herkese açık görünür),</li>
            <li>günlük sonuçların (puan, bitiş zamanı) ve oturum bilgisi.</li>
          </ul>
          <p>
            Google&rsquo;daki adın, soyadın ve profil fotoğrafın <strong className="text-ink-0">alınmaz ve saklanmaz</strong>.
          </p>
        </Bolum>

        <Bolum baslik="Amaç ve hukuki sebep">
          <ul className="list-disc pl-5">
            <li>
              Üyeliğin kurulması, sıralamanın tutulması ve sonuçlarının hesabına bağlanması —
              sözleşmenin kurulması ve ifası (KVKK md. 5/2-c).
            </li>
            <li>
              Hile ve kötüye kullanımın önlenmesi, hız sınırı, uygunsuz kullanıcı adlarının
              engellenmesi — meşru menfaat (KVKK md. 5/2-f).
            </li>
          </ul>
          <p>Bu işlemler için açık rızan istenmez; yukarıdaki hukuki sebeplere dayanır.</p>
        </Bolum>

        <Bolum baslik="Aktarım">
          <p>
            Site Vercel (barındırma) ve Supabase (veritabanı) altyapısında çalışır; girişte kimlik
            doğrulaması Google tarafından yapılır. Bu hizmet sağlayıcıların sunucuları yurt dışında
            olabileceğinden veriler KVKK md. 9 kapsamında yurt dışına aktarılır. Veriler başka hiçbir
            üçüncü kişiyle paylaşılmaz, satılmaz ve reklam amacıyla kullanılmaz.
          </p>
          <p>
            Sayfa kullanımını toplu olarak görmek için çerezsiz ve kişiyi tanımlamayan Umami analitiği
            kullanılır.
          </p>
        </Bolum>

        <Bolum baslik="Saklama süresi">
          <ul className="list-disc pl-5">
            <li>Günlük oturum ayrıntıları (tahminler dahil): 120 gün.</li>
            <li>Oturum çerezi: 60 gün ya da çıkış yapana kadar.</li>
            <li>Hesap, kullanıcı adı ve sıralama sonuçları: hesabını silene kadar.</li>
            <li>Hız sınırı sayaçları: en fazla 1 gün.</li>
          </ul>
        </Bolum>

        <Bolum baslik="Çerezler">
          <p>
            Yalnızca giriş yaptığında, oturumunu sürdürmek için zorunlu bir oturum çerezi kullanılır.
            Reklam ya da takip çerezi yoktur.
          </p>
        </Bolum>

        <Bolum baslik="Hakların (KVKK md. 11)">
          <p>
            Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı
            kişileri bilme, eksik ya da yanlış işlenmişse düzeltilmesini, silinmesini isteme, itiraz
            etme ve zarara uğramışsan giderilmesini talep etme hakkın vardır.
          </p>
          <p>
            Hesabını ve bağlı bütün sonuçlarını{' '}
            <Link href="/hesap" className="underline underline-offset-4">Hesabım</Link> sayfasından
            dilediğin an silebilirsin. Diğer talepler için yukarıdaki iletişim yollarını kullan; başvurular
            en geç 30 gün içinde yanıtlanır.
          </p>
        </Bolum>
      </div>
    </main>
  )
}
