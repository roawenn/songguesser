import { kickCercevesiAyristir, twitchSatiriAyristir, type SohbetMesaji } from './ayristir'

/**
 * Yayın sohbetine SALT-OKUR bağlantı — hesap, anahtar, OAuth yok.
 *
 * - Twitch: resmî IRC geçidi, `justinfan<sayı>` takma adıyla anonim okuma.
 * - Kick: sitenin kendi kullandığı Pusher uygulaması. ⚠️ Resmî değil; anahtar
 *   ya da küme değişirse yalnızca bu dosya ve `ayristir.ts` değişir.
 *
 * ⚠️ İki adres de CSP `connect-src`'de (bkz. `next.config.ts`). Eksik kalırsa
 * soket SESSİZCE engellenir ve durum sonsuza kadar "bağlanıyor"da kalır.
 *
 * ⚠️ Kopan bağlantı üstel beklemeyle yeniden kurulur: yayın saatlerce sürüyor
 * ve ağ sarsıntısında oyunun sohbeti "unutması" yayıncının fark etmeyeceği bir
 * hata olurdu.
 */

export type Platform = 'twitch' | 'kick'

export type BaglantiDurumu = 'baglaniyor' | 'bagli' | 'koptu' | 'hata'

export type SohbetHedefi = { platform: 'twitch'; kanal: string } | { platform: 'kick'; chatroomId: number }

export interface SohbetDinleyici {
  mesaj: (m: SohbetMesaji) => void
  durum: (d: BaglantiDurumu, ayrinti?: string) => void
}

const TWITCH_URL = 'wss://irc-ws.chat.twitch.tv:443'
const KICK_URL =
  'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false'

const EN_UZUN_BEKLEME = 30_000
/** Pusher sunucusu ~120 sn sessiz bağlantıyı düşürüyor; ondan önce yoklanır. */
const NABIZ_MS = 60_000

interface Surucu {
  acildi: (ws: WebSocket, durdur: (ayrinti: string) => void) => void
  veri: (ws: WebSocket, ham: string, bagli: () => void, durdur: (ayrinti: string) => void) => void
  nabiz?: (ws: WebSocket) => void
}

function yenidenDeneyen(url: string, d: SohbetDinleyici, s: Surucu): () => void {
  let kapandi = false
  let ws: WebSocket | null = null
  let deneme = 0
  let yeniden: ReturnType<typeof setTimeout> | undefined
  let nabiz: ReturnType<typeof setInterval> | undefined

  const bagli = () => {
    deneme = 0
    d.durum('bagli')
  }
  /** Kalıcı hata: yeniden denemenin anlamı yok (kanal yok, istek reddedildi). */
  const durdur = (ayrinti: string) => {
    // ⚠️ Bağlantı zaten kapatıldıysa (sayfadan çıkıldı) geç gelen bir zaman
    // aşımı "hata" yazmasın.
    if (kapandi) return
    kapandi = true
    clearInterval(nabiz)
    ws?.close()
    d.durum('hata', ayrinti)
  }

  const baglan = () => {
    if (kapandi) return
    d.durum('baglaniyor')
    let soket: WebSocket
    try {
      soket = new WebSocket(url)
    } catch {
      d.durum('hata', 'Sohbete bağlanılamadı.')
      return
    }
    ws = soket
    soket.onopen = () => {
      s.acildi(soket, durdur)
      if (s.nabiz) {
        nabiz = setInterval(() => {
          if (soket.readyState === WebSocket.OPEN) s.nabiz!(soket)
        }, NABIZ_MS)
      }
    }
    soket.onmessage = (e) => s.veri(soket, String(e.data), bagli, durdur)
    soket.onclose = () => {
      clearInterval(nabiz)
      // ⚠️ Eski soketin geç gelen `close`'u yeni bağlantıyı yeniden kurdurmasın.
      if (kapandi || ws !== soket) return
      d.durum('koptu')
      const ms = Math.min(EN_UZUN_BEKLEME, 1000 * 2 ** deneme)
      deneme++
      yeniden = setTimeout(baglan, ms)
    }
  }

  baglan()
  return () => {
    kapandi = true
    clearTimeout(yeniden)
    clearInterval(nabiz)
    ws?.close()
  }
}

/**
 * JOIN'den sonra ROOMSTATE bu sürede gelmezse kanal yok sayılır.
 *
 * ⚠️ Twitch var olmayan kanal için HİÇBİR hata göndermiyor (ölçüldü): zaman
 * aşımı olmadan yayıncı yanlış yazdığı adla sonsuza kadar "bağlanıyor…" görürdü.
 */
const TWITCH_KANAL_ZAMAN_ASIMI = 10_000

function twitch(kanal: string, d: SohbetDinleyici): () => void {
  let kanalBekleme: ReturnType<typeof setTimeout> | undefined
  const kapat = yenidenDeneyen(TWITCH_URL, d, {
    acildi: (ws, durdur) => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      ws.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`)
      ws.send(`JOIN #${kanal}`)
      clearTimeout(kanalBekleme)
      kanalBekleme = setTimeout(
        () => durdur('Twitch’te bu adla bir kanal bulunamadı. Adı kontrol et.'),
        TWITCH_KANAL_ZAMAN_ASIMI,
      )
    },
    veri: (ws, ham, bagli, durdur) => {
      for (const satir of ham.split('\r\n')) {
        if (!satir) continue
        if (satir.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv')
          continue
        }
        // ⚠️ "Bağlı" ölçütü JOIN değil ROOMSTATE: Twitch var olmayan kanala
        // da JOIN onayı gönderiyor, ROOMSTATE ise yalnızca gerçek kanalda geliyor.
        if (satir.includes(' ROOMSTATE ')) {
          clearTimeout(kanalBekleme)
          bagli()
          continue
        }
        if (satir.includes(' NOTICE ') && /msg_channel_suspended|msg_banned/.test(satir)) {
          durdur('Kanal bulunamadı ya da kapatılmış.')
          return
        }
        if (/^(@\S+ )?:tmi\.twitch\.tv RECONNECT/.test(satir)) {
          ws.close()
          return
        }
        const m = twitchSatiriAyristir(satir)
        if (m) d.mesaj(m)
      }
    },
  })
  return () => {
    clearTimeout(kanalBekleme)
    kapat()
  }
}

function kick(chatroomId: number, d: SohbetDinleyici): () => void {
  return yenidenDeneyen(KICK_URL, d, {
    acildi: () => {
      // Abonelik `pusher:connection_established` gelince (aşağıda).
    },
    veri: (ws, ham, bagli, durdur) => {
      const c = kickCercevesiAyristir(ham)
      switch (c.tur) {
        case 'baglandi':
          ws.send(
            JSON.stringify({
              event: 'pusher:subscribe',
              data: { auth: '', channel: `chatrooms.${chatroomId}.v2` },
            }),
          )
          break
        case 'abone':
          bagli()
          break
        case 'ping':
          ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }))
          break
        case 'mesaj':
          d.mesaj(c.mesaj)
          break
        case 'hata':
          // Pusher: 4000-4099 kalıcı (yeniden deneme), 4100+ geçici.
          if (c.kod !== null && c.kod >= 4000 && c.kod < 4100) durdur('Kick bağlantıyı reddetti.')
          break
      }
    },
    nabiz: (ws) => ws.send(JSON.stringify({ event: 'pusher:ping', data: {} })),
  })
}

/** Bağlanır; dönen fonksiyon bağlantıyı kapatır ve yeniden denemeyi durdurur. */
export function sohbeteBaglan(hedef: SohbetHedefi, d: SohbetDinleyici): () => void {
  return hedef.platform === 'twitch' ? twitch(hedef.kanal, d) : kick(hedef.chatroomId, d)
}
