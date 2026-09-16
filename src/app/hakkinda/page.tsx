import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactForm } from './ContactForm'

export const metadata: Metadata = {
  title: 'Hakkında',
  description:
    'tahmin.net nasıl çalışır, şarkı önizlemeleri nereden gelir ve içerik kaldırma talepleri nasıl iletilir.',
}

export default function HakkindaPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">
        Hakkında
      </h1>

      <div className="mt-8 flex flex-col gap-8 text-ink-2 leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">tahmin.net nedir?</h2>
          <p>
            tahmin.net, Türkçe şarkıları çok kısa ses kliplerinden tahmin etmeye dayanan bir
            oyundur. Yarım saniyeyle başlar; her harcadığın adımda biraz daha uzun
            dinlersin. Üyelik gerekmez — gir ve oyna. Günlük sıralamaya girmek istersen Google ile
            giriş yapabilirsin.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">Şarkılar nereden geliyor?</h2>
          <p>
            Şarkı adları, sanatçı bilgileri, albüm kapakları ve ses önizlemeleri{' '}
            <strong className="text-ink-0">Apple Music / iTunes Search API</strong>{' '}
            aracılığıyla sağlanmaktadır. Önizlemeler doğrudan Apple sunucularından yayınlanır;
            bu site hiçbir ses dosyasını indirmez, kopyalamaz veya saklamaz.
          </p>
          <p className="mt-3">
            Her turun sonunda şarkının Apple Music sayfasına bir bağlantı gösterilir. Beğendiğin
            bir parçayı oradan tamamını dinleyebilirsin.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">Şarkılar nasıl seçiliyor?</h2>
          <p>
            Havuzdaki her şarkı elle seçilir — otomatik liste çekme yoktur. Kategori, zorluk
            seviyesi ve orijinal çıkış yılı tek tek atanır. Bunun sebebi şu: müzik servislerinin
            verdiği çıkış tarihi çoğu zaman yeniden basımın ya da bir derlemenin tarihidir. 1978
            tarihli bir parça, 2015 arşiv albümünde yer aldığı için 2015 görünebilir. &ldquo;Eskiler&rdquo;
            filtresinin anlamlı olması için bu bilginin doğru olması gerekiyor.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">Çerezler ve veriler</h2>
          <p>
            Üye olmadan oynarken çerez kullanmıyoruz. İstatistiklerin (isabet, seri, kademe
            dağılımı) yalnızca kendi tarayıcında durur, bize gönderilmez. Google ile giriş
            yaparsan yalnızca oturumunu sürdüren zorunlu bir çerez kullanılır.
          </p>
          <p className="mt-3">
            Hangi verilerin neden işlendiği:{' '}
            <Link href="/gizlilik" className="text-ink-0 underline underline-offset-4">
              Gizlilik ve KVKK aydınlatma metni
            </Link>
            .
          </p>
          <p className="mt-3">
            Sitenin hangi bölümlerinin oynandığını görmek için çerezsiz ve kişiyi
            tanımlamayan <strong className="text-ink-0">Umami</strong> analitiği kullanıyoruz.
            Gönderilen yalnızca toplu bilgiler: hangi seçki ve zorluk oynandı, tur bilindi mi.
            Yazdığın tahminler ve düello kodları gönderilmez.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">
            İçerik kaldırma ve telif
          </h2>
          <p>
            Hak sahibiyseniz ve bir parçanın havuzdan çıkarılmasını istiyorsanız, şarkı ve
            sanatçı adıyla birlikte bize ulaşın; talebi aldığımızda parça havuzdan kaldırılır.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink-0">Bize yaz</h2>
          <p className="mb-4">
            Kaldırma talebi, hatalı bir kademe, eksik bir şarkı ya da aklına gelen
            herhangi bir şey — buradan yaz, hepsini okuyoruz.
          </p>
          <ContactForm />
        </section>
      </div>
    </main>
  )
}
