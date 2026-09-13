import type { Metadata } from 'next'
import Link from 'next/link'
import { STEPS, ATTEMPTS, tr } from '@/game/ladder'
import { MAX_WRONG } from '@/game/machine'
import { SERIT } from '@/data/unlu'

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
    a: `Rastgele bir Türkçe şarkıdan çok kısa bir klip çalınır. Bulunduğun kademeyi istediğin kadar tekrar dinleyebilirsin — dinlemek bedava. Klip yalnızca yanlış tahminle ya da pas geçmekle uzar; merdivende ${ATTEMPTS} kademe var.`,
  },
  {
    q: 'Kaç kez yanlış tahmin edebilirim?',
    a: `${MAX_WRONG} kez. Üçüncü yanlıştan sonra şarkı kendiliğinden açılır ve tur biter. Tahminlerin sahnede listelenir, kaç hakkın kaldığını orada görürsün. Tur kaybedildiği için zorluk yükselmez — bulunduğun zorlukta kalırsın.`,
  },
  {
    q: 'Pas geçmek tahmin hakkımı yakar mı?',
    a: `Hayır. Pas geçmek merdivende bir kademe ilerletir, yani klibi uzatır; ${MAX_WRONG} tahmin hakkın olduğu gibi kalır. Merdivenin sonuna gelirsen tur yine biter.`,
  },
  {
    q: 'Klip ne kadar uzuyor?',
    a: `Merdiven sabittir: ${ladder}. İlk kademe yarım saniye duyurur, ikincisi bir saniye, üçüncüsü iki saniye… Aynı kademeyi kaç kez dinlediğin hiçbir şeye mal olmaz.`,
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
    q: 'Ünlü tanıma oyunu nasıl işliyor?',
    a: `Bir ünlünün görseli beş eşit yatay şeride bölünür ve başta yalnızca en üstteki — saç — açıktır. Yanlış tahmin ya da pas geçmek bir şerit daha açar. Beşinci şerit açılınca tur biter, yani ${SERIT - 1} tahmin hakkın var. Alt şeritten iki oyun arasında geçebilirsin.`,
  },
  {
    q: 'İki oyunun zorluğu ve istatistiği ortak mı?',
    a: 'Hayır, ayrı. Şarkıda "Uzman" seviyesindeysen ünlü oyununa "Kolay"dan başlarsın; isabet yüzden, serin ve kademe dağılımın da her oyun için ayrı tutulur. "Kolay arama" ve "azaltılmış animasyon" ise ortak tercihlerdir.',
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
        tahmin.net&apos;te iki oyun var. <strong className="text-ink-0">Şarkı</strong>:
        Türkçe bir parçayı yarım saniyeden tanımaya çalışırsın; pop, rap, arabesk, rock,
        halk, sanat ve fantezi seçkileriyle oynanır.{' '}
        <strong className="text-ink-0">Ünlü</strong>: bir ünlünün görseli beş şeride
        bölünür, önce yalnızca saçı açıktır.
      </p>

      <h2 className="mt-9 font-serif text-2xl text-ink-0">Şarkı</h2>
      <ol className="mt-4 flex flex-col gap-3 border-l border-white/10 pl-5 text-ink-2">
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

      <h2 className="mt-9 font-serif text-2xl text-ink-0">Ünlü</h2>
      <ol className="mt-4 flex flex-col gap-3 border-l border-white/10 pl-5 text-ink-2">
        <li>
          <strong className="text-ink-0">Bak</strong> — önce yalnızca saç açıktır.
        </li>
        <li>
          <strong className="text-ink-0">Yaz</strong> — adı yeterli; {SERIT - 1} yanlış
          hakkın var.
        </li>
        <li>
          <strong className="text-ink-0">Aç</strong> — her adımda bir şerit daha açılır:
          saç → alın → gözler → ağız → tamamı.
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
