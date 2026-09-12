import type { Metadata } from 'next'
import Link from 'next/link'
import { STEPS, ATTEMPTS, tr } from '@/game/ladder'

export const metadata: Metadata = {
  title: 'Nasıl Oynanır',
  description:
    'tahmin.net nasıl oynanır? Adımlar, klip uzunlukları, kategoriler, zorluk seviyeleri ve yazım kuralları.',
}

const ladder = STEPS.map((s) => `${tr(s)} sn`).join(' → ')

/**
 * ⚠️ Buradaki her sayı oyunun GERÇEK kurallarıyla aynı olmak zorunda.
 *
 * Bu içerik aynı zamanda `FAQPage` yapılandırılmış verisi olarak arama
 * motorlarına gidiyor; yanlış bir cümle yalnızca oyuncuyu değil, arama
 * sonucunu da yanıltır. Merdiven bu yüzden `STEPS`'ten okunuyor, elle
 * yazılmıyor.
 */
const faq = [
  {
    q: 'Oyun nasıl işliyor?',
    a: `Rastgele bir Türkçe şarkıdan çok kısa bir klip çalınır. Her turda ${ATTEMPTS} adım hakkın var. Adımı üç şey tüketir: bir klibi sonuna kadar dinlemek, yanlış tahmin etmek ya da pas geçmek. Her tükenen adımla bir sonraki klip uzar.`,
  },
  {
    q: 'Klip ne kadar uzuyor?',
    a: `Merdiven sabittir: ${ladder}. İlk Çal yarım saniye duyurur, ikincisi bir saniye, üçüncüsü iki saniye… Aynı uzunluğu ikinci kez dinleyemezsin.`,
  },
  {
    q: 'Bütün klipleri dinlersem kaybeder miyim?',
    a: `Hayır. ${ATTEMPTS} adımın hepsini dinleyerek harcarsan Çal düğmesi kapanır ama bir tahmin hakkın kalır. Tur yalnızca yanlış tahminle ya da pas geçmekle kaybedilir.`,
  },
  {
    q: 'Türkçe karakter yazmak zorunda mıyım?',
    a: 'Hayır. "gulpembe" yazsan da "Gülpembe" kabul edilir. Şapkalı, noktasız, eksik harfli yazımlar ve küçük yazım hataları da affedilir. Yalnızca çok kısa şarkı adlarında (Sus, Gel, Aşk gibi) tam yazım gerekir — çünkü bunlar birbirine fazla benziyor.',
  },
  {
    q: 'Sanatçı adını da yazmam gerekir mi?',
    a: 'Gerekmez, şarkı adı yeterli. İstersen ikisini birlikte de yazabilirsin.',
  },
  {
    q: 'Yazdığım ad birden fazla şarkıya uyuyorsa ne olur?',
    a: 'Hak harcanmaz. Hangisini kastettiğini soran bir liste çıkar; seçtiğin şarkı tahminin sayılır.',
  },
  {
    q: '"Kolay arama" ne işe yarıyor?',
    a: 'Açıkken yazdıkça öneri listesi çıkar. Kapatırsan öneri almazsın ve şarkı adını kendin hatırlaman gerekir — gerçek bir meydan okuma istiyorsan kapat. Ayarlar menüsünden değiştirilir.',
  },
  {
    q: 'Şarkı çalarken internet koptu, hakkım gitti mi?',
    a: 'Hayır. Bağlantı takılırsa o adım harcanmaz; aynı uzunluğu tekrar çalabilirsin.',
  },
  {
    q: 'Zorluk seviyeleri ne anlama geliyor?',
    a: 'Kolay, Orta, Zor, Uzman ve İmkansız olmak üzere beş kademe var; havuz seçtiğin kademeye göre süzülür. Bir şarkıyı bilip "Sıradaki şarkı" dersen bir üst kademeye çıkarsın, İmkansız\'da ise orada kalırsın.',
  },
  {
    q: '"Eskiler" ve "90\'lar" nasıl çalışıyor?',
    a: 'Bunlar tür değil dönem seçkileri: Eskiler 70, 80 ve 90\'lı yılları, diğerleri kendi on yılını kapsar. Şeritte tek seçim yapılır — yani "Pop" ile "90\'lar" aynı anda seçilemez, birini seçersin.',
  },
  {
    q: 'Klavyeden oynayabilir miyim?',
    a: 'Boşluk tuşu klibi çalar. Tahmin kutusuna yazarken ya da bir düğmeye odaklanmışken boşluk normal işini görür.',
  },
]

export default function NasilOynanirPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href="/" className="text-sm text-ink-3 underline-offset-4 hover:underline">
        ← Oyuna dön
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-ink-0">Nasıl oynanır?</h1>
      <p className="mt-3 text-ink-2">
        tahmin.net, Türkçe şarkıları yarım saniyeden tanımaya çalıştığın bir tahmin oyunudur.
        Pop, rap, arabesk, rock, halk, sanat ve fantezi seçkileriyle oynanır.
      </p>

      <ol className="mt-8 flex flex-col gap-3 border-l border-white/10 pl-5 text-ink-2">
        <li>
          <strong className="text-ink-0">Çal</strong> — {tr(STEPS[0]!)} saniye duyarsın.
        </li>
        <li>
          <strong className="text-ink-0">Yaz</strong> — aklına gelen şarkıyı yaz, ya da pas geç.
        </li>
        <li>
          <strong className="text-ink-0">Uzat</strong> — her tükenen adımda klip uzar:{' '}
          {ladder}.
        </li>
      </ol>

      <dl className="mt-10 flex flex-col gap-7">
        {faq.map((item) => (
          <div key={item.q}>
            <dt className="font-semibold text-ink-0">{item.q}</dt>
            <dd className="mt-1.5 leading-relaxed text-ink-2">{item.a}</dd>
          </div>
        ))}
      </dl>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </main>
  )
}
