import { SERIT } from '@/data/unlu'
import { KAPAK_ADIM } from '@/data/kapak'
import { ipuclari, type Step } from './machine'
import {
  turOgesi, type GunlukOturum, type GunlukSet, type GunlukTurSonucu, type GunlukZorluk,
} from './gunluk'
import { hakKalan, turAdimlari, turBitisi, turDurumu } from './gunlukKural'
import type { Gun } from './gun'

/**
 * İstemciye giden görünüm — SUNUCUNUN tek çıkış kapısı.
 *
 * ⚠️ SÜREN TURDA HİÇBİR KİMLİK YOK. Şarkı ve albüm kimlikleri
 * (`itunes:…`, `kapak:…`) iTunes'ta aranabiliyor, ünlü kimliği de istemcinin
 * zaten indirdiği havuzda ada eşleniyor. Turlar yalnızca sırasıyla anılır;
 * cevap alanları (`cevap`) tur bittikten sonra eklenir. Testi bunu kilitliyor.
 *
 * ⚠️ GÖRSELLER DOĞRUDAN ADRES DEĞİL. Kapak adresindeki `8x8bb` elle
 * `600x600bb` yapılabilir; ünlü görseli ise tam iner ve şeritler yalnızca CSS
 * ile gizlenir. Görsel, o adıma kadar açılmış hâliyle sunucudan, imzalı bir
 * adresle geliyor (`gorselAdresi`, bkz. `api/gunluk/gorsel`).
 */

export interface GunlukTurGorunumOrtak {
  zorluk: GunlukZorluk
  durum: 'oynaniyor' | 'kazandi' | 'kaybetti'
  steps: Step[]
  hakKalan: number
  /** Turda sunucunun gördüğü olay sayısı — sonraki hamlenin `sira`sı. */
  sira: number
  medyaVerildi: number
  sonuc: Omit<GunlukTurSonucu, 'kazandi' | 'bitti'> | null
}

export type GunlukTurGorunum =
  | (GunlukTurGorunumOrtak & {
      oyun: 'sarki'
      medya: { p: string; cs: number; du: number }
      attempt: number
      ipuclari: string[]
      cevap: { t: string; a: string; y: number; ar: string; u: string } | null
    })
  | (GunlukTurGorunumOrtak & {
      oyun: 'unlu'
      medya: { gorsel: string }
      acilan: number
      cevap: { ad: string } | null
    })
  | (GunlukTurGorunumOrtak & {
      oyun: 'kapak'
      medya: { gorsel: string }
      adim: number
      cevap: { al: string; a: string; y: number; u: string } | null
    })

export interface GunlukGorunum {
  gun: Gun
  oturum: string
  sirali: boolean
  durum: 'oynaniyor' | 'bitti'
  zamanAsimi: boolean
  puan: number | null
  /** Sıralamaya sayılması için en geç bitiş anı (epoch ms). */
  sonTeslim: number
  turlar: GunlukTurGorunum[]
}

export interface GorunumSecenek {
  sonTeslim: number
  /** Turun o adımdaki görselinin imzalı adresi. `adim`: ünlüde açık şerit, kapakta netlik adımı. */
  gorselAdresi: (turIndex: number, aday: number, adim: number) => string
}

export function gorunumOlustur(
  oturum: GunlukOturum,
  set: GunlukSet,
  secenek: GorunumSecenek,
): GunlukGorunum {
  const turlar: GunlukTurGorunum[] = []

  oturum.turlar.forEach((kayit, i) => {
    const oge = turOgesi(set, i, kayit)
    const slot = set.slotlar[i]
    if (!oge || !slot) return

    const t = turDurumu(oge, kayit.olaylar)
    const bitis = turBitisi(t)
    const bitti = bitis !== null
    const ortak: GunlukTurGorunumOrtak = {
      zorluk: slot.zorluk,
      durum: bitis ?? 'oynaniyor',
      steps: turAdimlari(t),
      hakKalan: hakKalan(t),
      sira: kayit.olaylar.length,
      medyaVerildi: kayit.medyaVerildi,
      sonuc: kayit.sonuc
        ? {
            adimIndeksi: kayit.sonuc.adimIndeksi,
            sureMs: kayit.sonuc.sureMs,
            hizBonusu: kayit.sonuc.hizBonusu,
            puan: kayit.sonuc.puan,
          }
        : null,
    }

    if (oge.oyun === 'sarki' && t.oyun === 'sarki') {
      const s = oge.sarki
      turlar.push({
        ...ortak,
        oyun: 'sarki',
        medya: { p: s.p ?? '', cs: s.cs, du: s.du },
        attempt: 'attempt' in t.d ? t.d.attempt : 0,
        ipuclari: ipuclari(s, ortak.steps),
        cevap: bitti ? { t: s.t, a: s.a, y: s.y, ar: s.ar ?? '', u: s.u ?? '' } : null,
      })
    } else if (oge.oyun === 'unlu' && t.oyun === 'unlu') {
      const acilan = 'acilan' in t.d ? t.d.acilan : 1
      turlar.push({
        ...ortak,
        oyun: 'unlu',
        medya: { gorsel: secenek.gorselAdresi(i, kayit.aday, bitti ? SERIT : acilan) },
        acilan,
        cevap: bitti ? { ad: oge.unlu.ad } : null,
      })
    } else if (oge.oyun === 'kapak' && t.oyun === 'kapak') {
      const adim = 'adim' in t.d ? t.d.adim : 1
      const k = oge.kapak
      turlar.push({
        ...ortak,
        oyun: 'kapak',
        medya: { gorsel: secenek.gorselAdresi(i, kayit.aday, bitti ? KAPAK_ADIM : adim) },
        adim,
        cevap: bitti ? { al: k.al, a: k.a, y: k.y, u: oge.u } : null,
      })
    }
  })

  return {
    gun: oturum.gun,
    oturum: oturum.id,
    sirali: oturum.sirali,
    durum: oturum.bitti !== null ? 'bitti' : 'oynaniyor',
    zamanAsimi: oturum.zamanAsimi,
    puan: oturum.puan,
    sonTeslim: secenek.sonTeslim,
    turlar,
  }
}
