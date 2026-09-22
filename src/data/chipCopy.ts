import type { ChipId } from './categories'

/**
 * Seçki giriş sayfalarının metinleri.
 *
 * ⚠️ Buraya ŞARKI ADI YAZILMAZ. Sayfalar arama motoruna açık; havuzdaki
 * şarkıların adını dizine vermek oyunun cevap anahtarını yayınlamak olur.
 * Sanatçı adı sorun değil — oyun şarkıyı sorar, sanatçıyı değil.
 */
export interface ChipCopy {
  /** Sayfa başlığı — arama sorgusuna yakın dursun. */
  h1: string
  /** Bir cümlelik tanım; meta description olarak da kullanılır. */
  ozet: string
  /** İki üç cümlelik tanıtım. */
  giris: string
}

export const CHIP_COPY: Record<ChipId, ChipCopy> = {
  karisik: {
    h1: 'Türkçe Şarkı Tahmin Oyunu',
    ozet: 'Tüm seçkilerden rastgele Türkçe şarkılar — pop, rap, arabesk, rock, halk, sanat ve fantezi bir arada.',
    giris:
      'Havuzun tamamından rastgele bir şarkı gelir. Hangi türden geleceğini bilemezsin; kulağının ne kadar geniş olduğunu ölçmek istiyorsan doğru yer burası.',
  },
  pop: {
    h1: 'Türkçe Pop Şarkı Tahmin Oyunu',
    ozet: 'Türkçe pop klasiklerinden bugünün hitlerine — yarım saniyede tanıyabilir misin?',
    giris:
      'Seksenlerin kasetlerinden bugünün listelerine uzanan bir Türkçe pop seçkisi. Çoğu şarkının girişi ilk yarım saniyede bile tanıdık gelir; asıl mesele adını hatırlamak.',
  },
  rap: {
    h1: 'Türkçe Rap Şarkı Tahmin Oyunu',
    ozet: 'Türkçe rap ve hip-hop — eski kuşaktan yeni nesle.',
    giris:
      'Türkçe rapin ilk dalgasından bugünün sahnesine uzanan bir seçki. Beat girişleri kısa ve karakterli; yarım saniye çoğu zaman yetiyor, yeter ki doğru adı yazabil.',
  },
  arabesk: {
    h1: 'Arabesk Şarkı Tahmin Oyunu',
    ozet: 'Arabeskin klasikleri — ilk notadan tanıyanlar için.',
    giris:
      'Arabeskin büyük isimleri ve unutulmayan parçaları. Yaylı girişler birbirine benzer, bu yüzden ilk kademede bilmek gerçek bir iş.',
  },
  rock: {
    h1: 'Türkçe Rock Şarkı Tahmin Oyunu',
    ozet: 'Anadolu rockundan bugünün gruplarına Türkçe rock seçkisi.',
    giris:
      'Anadolu rockunun kurucularından bugünün gruplarına uzanan bir seçki. Riff girişleri kısa klipte en çok iş gören ipucudur.',
  },
  halk: {
    h1: 'Türk Halk Müziği Tahmin Oyunu',
    ozet: 'Türkü ve halk müziği — bağlama girişinden tanıyabilir misin?',
    giris:
      'Anonim türkülerden usta yorumculara uzanan bir halk müziği seçkisi. Aynı türkünün onlarca yorumu olduğu için burada sesi tanımak da işin parçası.',
  },
  sanat: {
    h1: 'Türk Sanat Müziği Tahmin Oyunu',
    ozet: 'Sanat müziğinin büyük yorumcuları ve klasikleşmiş eserleri.',
    giris:
      'Türk sanat müziğinin klasikleri. Makam girişleri birbirine yakın olduğu için bu seçki, kulağı en çok zorlayanlardan biri.',
  },
  fantezi: {
    h1: 'Fantezi Müzik Tahmin Oyunu',
    ozet: 'Fantezi ve taverna klasikleri — düğün salonlarının repertuvarı.',
    giris:
      'Doksanların ve iki binlerin fantezi repertuvarı. Klavye girişleri ve ritim kalıpları tanıdık; asıl zorluk birbirine çok benzeyen parçaları ayırmak.',
  },
}
