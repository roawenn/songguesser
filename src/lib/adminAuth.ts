import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { oturumKullanici } from '@/lib/kullaniciAuth'
import { restUrl, restHeaders } from '@/lib/supabase'
import { yoneticiMi } from '@/text/eposta'

/**
 * Yönetici yetkisi — GOOGLE HESABINA bağlı, parola YOK.
 *
 * ⚠️ PAROLA TAMAMEN KALKTI (`admin_hesap` tablosu, scrypt özeti, `admin:parola`
 * betiği). Tek bir sırrın sızması paneli açıyordu; artık yetki, Google'ın
 * doğruladığı e-postaya dayanıyor ve o hesabın 2FA'sı, cihaz geçmişi ve iptal
 * yeteneği de savunmaya dahil.
 *
 * ⚠️ YETKİ LİSTESİ ORTAM DEĞİŞKENİNDE (`YONETICI_EPOSTALAR`), veritabanında
 * DEĞİL. Veritabanına yazabilen biri kendini yönetici yapamasın diye: rol
 * kolonu olsaydı tek bir yazma yetkisi paneli devralmaya yeterdi.
 *
 * ⚠️ LİSTE HER İSTEKTE OKUNUR, yalnızca oturum açarken değil. Bir adres
 * listeden çıkarıldığı anda o kişinin AÇIK oturumu da ölmeli.
 *
 * İki oturum katmanı bilerek ayrı (bkz. `kullaniciAuth.ts`): oyuncu oturumu 60
 * gün, yönetici oturumu 12 saat. Panel yetkisinin süresi dolunca oyun tarafı
 * etkilenmez, yalnızca panelde yeniden Google doğrulaması istenir.
 */

/*
 * ⚠️ Liste boşsa PANEL KİMSEYE AÇIK DEĞİL ve yetkisize 404 döndüğü için bunun
 * hiçbir görünür belirtisi olmaz. Yanlış yazılmış bir ortam değişkenini
 * teşhis edilebilir kılan tek şey bu uyarı.
 */
if (!process.env.YONETICI_EPOSTALAR?.trim()) {
  console.warn('[yonetim] YONETICI_EPOSTALAR boş ya da tanımsız — yönetim paneli kimseye açık değil.')
}

const URETIM = process.env.NODE_ENV === 'production'

/**
 * ⚠️ Üretimde `__Host-` önekli. Önek tarayıcıya üç şeyi zorlatıyor: `Secure`,
 * `path=/` ve `Domain` YOK — yani alt alan adlarından yazılamaz. Eski çerez
 * (`tahmin_yonetim`) öneksizdi.
 */
export const ADMIN_COOKIE = URETIM ? '__Host-tahmin_yonetim' : 'tahmin_yonetim'

/** Yönetici oturumunun ömrü. */
export const YONETICI_SURE_SN = 12 * 3600

/** 32 baytın base64url hâli — `kullaniciAuth` ile aynı biçim. */
const BELIRTEC_DESENI = /^[A-Za-z0-9_-]{43}$/

/**
 * ⚠️ Tabloda YALNIZCA özet duruyor. Eskiden çerezdeki değerin AYNISI `id`
 * kolonuna yazılıyordu; tablo sızsa satırlar doğrudan çereze çevrilebilirdi.
 */
function ozet(belirtec: string): string {
  return createHash('sha256').update(belirtec).digest('hex')
}

async function rest(path: string, init?: RequestInit) {
  return fetch(restUrl(path), {
    ...init,
    headers: { ...restHeaders({ secret: true }), ...(init?.headers as Record<string, string> | undefined) },
    cache: 'no-store',
  })
}

/** Bu e-posta yönetici listesinde mi? Liste boşsa kimse değil. */
export function yoneticiEpostaMi(eposta: string | null | undefined): boolean {
  return yoneticiMi(eposta, process.env.YONETICI_EPOSTALAR)
}

/**
 * Yönetici oturumu açar; çereze yazılacak HAM belirteci döner.
 *
 * Çağıran (`api/giris/google/donus`) yetkiyi çoktan doğrulamış olmalı — burada
 * ikinci bir e-posta kontrolü yapılmıyor, çünkü `kullanici_id` zaten o anda
 * doğrulanmış hesabın kimliği ve `yoneticiDurumu` her okumada listeye yeniden
 * bakıyor.
 */
export async function yoneticiOturumAc(kullaniciId: string): Promise<string> {
  const belirtec = randomBytes(32).toString('base64url')
  const biter = new Date(Date.now() + YONETICI_SURE_SN * 1000).toISOString()

  const res = await rest('admin_oturum', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: ozet(belirtec), kullanici_id: kullaniciId, biter }),
  })
  if (!res.ok) throw new Error(`admin_oturum ${res.status}`)
  return belirtec
}

/** Yönetici oturumunu sunucudan da siler — çerezi çağıran temizler. */
export async function yoneticiOturumKapat(): Promise<void> {
  const belirtec = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!belirtec || !BELIRTEC_DESENI.test(belirtec)) return
  await rest(`admin_oturum?id=eq.${ozet(belirtec)}`, { method: 'DELETE' }).catch(() => undefined)
}

interface OturumSatiri {
  kullanicilar: { email: string; banli_at: string | null } | null
}

/**
 * Panelin üç hâli.
 *
 * `hazir`   — geçerli yönetici oturumu var.
 * `dogrula` — oyuncu olarak girişli ve e-postası listede, ama yönetici oturumu
 *             yok ya da süresi dolmuş. Yalnızca bu kişiye "doğrula" denir.
 * `yok`     — diğer HERKES. Panel bu kişilere 404 döner; "yetkin yok" demek
 *             bile panelin varlığını doğrulamak olurdu.
 */
export type YoneticiDurumu = 'yok' | 'dogrula' | 'hazir'

export async function yoneticiDurumu(): Promise<YoneticiDurumu> {
  const belirtec = (await cookies()).get(ADMIN_COOKIE)?.value
  if (belirtec && BELIRTEC_DESENI.test(belirtec)) {
    try {
      /*
       * Gömülü join (`kullanicilar(...)`) tek istekte hem oturumu hem hesabı
       * getiriyor — `oturumKullanici`'daki desen. `kullanici_id` boşsa (eski
       * satır) join null döner ve oturum geçersiz sayılır.
       */
      const res = await rest(
        `admin_oturum?id=eq.${ozet(belirtec)}&biter=gt.${new Date().toISOString()}&select=kullanicilar(email,banli_at)`,
      )
      if (res.ok) {
        const [satir] = (await res.json()) as OturumSatiri[]
        const k = satir?.kullanicilar
        if (k && !k.banli_at && yoneticiEpostaMi(k.email)) return 'hazir'
      }
    } catch {
      // Veritabanına ulaşılamıyorsa yetki VERİLMEZ.
    }
  }

  const oyuncu = await oturumKullanici()
  return oyuncu && yoneticiEpostaMi(oyuncu.email) ? 'dogrula' : 'yok'
}
