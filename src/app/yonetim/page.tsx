import { notFound } from 'next/navigation'
import { AdminPanel } from './AdminPanel'
import { yoneticiDurumu } from '@/lib/adminAuth'

/**
 * Şarkı havuzu yönetim paneli.
 *
 * ⚠️ SAYFA ARTIK SUNUCUDA KORUNUYOR. Eskiden `/yonetim` HTML'i HERKESE servis
 * ediliyordu ve koruma yalnızca API katmanındaydı: panelin varlığı, sekmeleri,
 * hatta "yapılandırılmamış" mesajı girişsiz herkese görünüyordu.
 *
 * ⚠️ Yetkisize `notFound()` — "yetkin yok" bile denmiyor. Gördüğü sayfa,
 * olmayan bir adrese gidenin gördüğüyle aynı.
 */
export const metadata = { robots: { index: false, follow: false } }

// Çerez okunduğu için her istekte taze render.
export const dynamic = 'force-dynamic'

export default async function YonetimPage() {
  const durum = await yoneticiDurumu()
  if (durum === 'yok') notFound()
  return <AdminPanel yenidenDogrula={durum === 'dogrula'} />
}
