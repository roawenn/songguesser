import { AdminPanel } from './AdminPanel'
import { adminConfigured } from '@/lib/adminAuth'

/**
 * Şarkı havuzu yönetim paneli.
 *
 * Yayında da çalışır — şifreyle korunur ve tüm yazma işlemleri sunucu
 * rotalarından geçer. Secret key tarayıcıya hiç gitmez; tarayıcıdan doğrudan
 * yazma zaten RLS ile kapalıdır.
 */
export const metadata = { robots: { index: false, follow: false } }

// Çerez okunduğu için her istekte taze render.
export const dynamic = 'force-dynamic'

// `adminConfigured` artık veritabanına soruyor (şifre env'de değil); Server
// Component olduğu için `await` sorunsuz.
export default async function YonetimPage() {
  return <AdminPanel configured={await adminConfigured()} />
}
