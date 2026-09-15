'use client'

import dynamic from 'next/dynamic'
import { CHIPS, type ChipId } from '@/data/categories'
import { havuzuIsit } from '@/data/loadPool'
import { useSettingsStore } from '@/store/useSettingsStore'
import { slugGecerli } from '@/text/sanatci'

/**
 * Oyunu yalnızca tarayıcıda kur.
 *
 * ⚠️ `ssr: false` burada bir kaçamak değil, doğru çözüm. Seçili kategori
 * `localStorage`'ta yaşıyor; sunucuda okunamadığı için HTML her zaman
 * varsayılanla ("Karışık", --hue 205) basılıyordu. Tarayıcı önce onu boyuyor,
 * JS gelince gerçek kategoriye atlıyordu — F5'te görülen sıçrama buydu.
 * Üstelik çip durumu, kaset etiketi ve kök --hue hidrasyonda uyuşmadığı için
 * React kökü zaten istemcide baştan render ediyordu.
 *
 * ⚠️ `skipHydration` ile ÇÖZÜLMEZ, kötüleşir: zustand persist senkron çalışır,
 * yani ilk istemci render'ında kategori zaten doğrudur ve tek bir havuz isteği
 * atılır. Hidrasyonu mount sonrasına ertelemek o isteği önce "karisik" için
 * yapar, sonra gerçek kategori için bir kez daha.
 */
const GameShell = dynamic(() => import('@/components/GameShell').then((m) => m.GameShell), {
  ssr: false,
  loading: () => <GameSkeleton />,
})

/** Kabuk ölçülerinde sessiz bir iskelet — düzen kaymasın. */
function GameSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 80% at 50% -10%, #14171b 0%, #0a0b0d 55%, #07080a 100%)',
      }}
    />
  )
}

/**
 * ⚠️ Modül düzeyi bayrak. React iki kez render edebilir (StrictMode) ve seçkiyi
 * iki kez yazmanın anlamı yok; ayrıca oyuncu sonradan elle seçki değiştirirse
 * bunu geri almamalıyız.
 */
let seckiUygulandi = false

/**
 * `?secki=rap` parametresini kalıcı ayara yaz — `GameShell` MOUNT OLMADAN ÖNCE.
 *
 * Seçki giriş sayfalarından gelen bağlantılar bunu kullanır.
 *
 * ⚠️ ZAMANLAMA. Bu iş `useEffect` içinde yapılsaydı `GameShell` çoktan mount
 * olmuş ve KALICI seçki için bir havuz isteği atılmış olurdu; doğru seçki
 * sonradan uygulandığında ikinci bir istek daha giderdi. Yukarıdaki yorumun
 * anlattığı tuzağın aynısı. Burada, `GameShell` tembel yüklenmeden önce
 * çalışıyor — o an store'a abone hiçbir bileşen olmadığı için render sırasında
 * yazmak da güvenli.
 */
function seckiyiHizala() {
  if (seckiUygulandi || typeof window === 'undefined') return
  seckiUygulandi = true

  const hedef = new URLSearchParams(window.location.search).get('secki')

  if (!hedef || !CHIPS.some((c) => c.id === hedef)) return
  if (useSettingsStore.getState().category === hedef) return

  /*
   * ⚠️ Bu KALICI ayarı değiştirir (`tahmin:ayarlar:v3`). Bilinçli: sahne rengi,
   * çip şeridi, kaset etiketi ve footer hepsi `settings.category`'den türüyor;
   * gölge bir override üç bileşeni birden kirletirdi. Oyuncu zaten o seçkinin
   * bağlantısına tıklayarak oraya geçmeyi kabul etmiş sayılır.
   */
  useSettingsStore.setState({ category: hedef as ChipId })
}

/**
 * `?sanatci=sezen-aksu` — sanatçı modu.
 *
 * ⚠️ `?secki=`'nin tersine KALICI AYARA YAZILMAZ: sanatçı modu bir oturumluk
 * hayran testi; oyuncu çıkınca kendi seçkisine dönmeli (bkz. `useRound`).
 */
function sanatciOku(): string | null {
  if (typeof window === 'undefined') return null
  const s = new URLSearchParams(window.location.search).get('sanatci')
  return s && slugGecerli(s) ? s : null
}

export function ClientGame() {
  seckiyiHizala()
  const sanatci = sanatciOku()
  /*
   * ⚠️ Havuz isteği, tembel `GameShell` parçası inip çalışmadan başlatılıyor.
   *
   * Oynanabilir ilk tura giden yol üç seri ağ adımıydı: HTML → ana paket →
   * kabuk parçası → mount → havuz. Bu çağrı son iki adımı paralelleştiriyor.
   * Sabit bir `<link rel="preload">` yerine burada duruyor çünkü seçki
   * `localStorage`'da: varsayılan dışında bir seçki kullanan oyuncuya yanlış
   * havuzu indirtmek, kazandırdığından fazlasını götürürdü.
   */
  if (typeof window !== 'undefined') {
    // Sanatçı modu her zaman `karisik` havuzundan süzer.
    havuzuIsit(sanatci ? 'karisik' : useSettingsStore.getState().category)
  }
  return <GameShell sanatci={sanatci} />
}
