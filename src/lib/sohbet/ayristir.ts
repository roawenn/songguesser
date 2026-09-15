/**
 * Twitch ve Kick sohbet çerçevelerini tek bir mesaj biçimine indirir — saf, testli.
 *
 * Bağlantı yönetimi `baglanti.ts`'te; bu dosya yalnızca "gelen metinden ne
 * anlaşılıyor" sorusunu cevaplıyor ki protokol değişince tek yer değişsin.
 *
 * ⚠️ Kick'in soket olayları RESMÎ DEĞİL. Olay adı ölçüldüğünde
 * `App\Events\ChatMessageEvent` idi; eski kaynaklar `ChatMessageSentEvent`
 * yazıyor (ilk plan da öyleydi) — o adla dinlenseydi bağlantı "abone oldu"
 * deyip HİÇ mesaj getirmezdi. İkisi de tanınıyor.
 */

export interface SohbetMesaji {
  /** Platforma özgü kalıcı kimlik: `twitch:<user-id>`, `kick:<sender.id>`. */
  id: string
  /** Görünen ad — ekranda yazılan tek şey. */
  ad: string
  metin: string
}

const EN_UZUN_AD = 25

/** IRC etiket değerlerindeki kaçışlar: `\s` boşluk, `\:` noktalı virgül, `\\` ters bölü. */
function etiketCoz(deger: string): string {
  return deger.replace(/\\(s|:|\\)/g, (_, c: string) => (c === 's' ? ' ' : c === ':' ? ';' : '\\'))
}

/**
 * `@etiketler :nick!nick@nick.tmi.twitch.tv PRIVMSG #kanal :metin`
 *
 * PRIVMSG olmayan her satır için `null` (PING, ROOMSTATE, JOIN…).
 */
export function twitchSatiriAyristir(satir: string): SohbetMesaji | null {
  let kalan = satir
  const etiketler = new Map<string, string>()

  if (kalan.startsWith('@')) {
    const bosluk = kalan.indexOf(' ')
    if (bosluk < 0) return null
    for (const parca of kalan.slice(1, bosluk).split(';')) {
      const esit = parca.indexOf('=')
      if (esit > 0) etiketler.set(parca.slice(0, esit), etiketCoz(parca.slice(esit + 1)))
    }
    kalan = kalan.slice(bosluk + 1)
  }

  const m = /^:([^!\s]+)!\S* PRIVMSG #\S+ :([\s\S]*)$/.exec(kalan)
  if (!m) return null

  const nick = m[1]!
  let metin = m[2]!
  // "/me …" mesajları CTCP ACTION olarak sarılı geliyor.
  const eylem = /^\x01ACTION ([\s\S]*)\x01$/.exec(metin)
  if (eylem) metin = eylem[1]!

  const ad = (etiketler.get('display-name') || nick).slice(0, EN_UZUN_AD)
  const kimlik = etiketler.get('user-id') || nick
  return { id: `twitch:${kimlik}`, ad, metin: metin.trim() }
}

export type KickCercevesi =
  | { tur: 'baglandi' }
  | { tur: 'abone' }
  | { tur: 'ping' }
  | { tur: 'hata'; kod: number | null }
  | { tur: 'mesaj'; mesaj: SohbetMesaji }
  | { tur: 'diger' }

const KICK_MESAJ_OLAYLARI = new Set(['App\\Events\\ChatMessageEvent', 'App\\Events\\ChatMessageSentEvent'])

/** "[emote:37226:KEKW]" — sohbet ifadeleri tahmin metnine karışmasın. */
const KICK_IFADE = /\[emote:\d+:[^\]]*\]/g

function nesne(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

/** Pusher çerçevesi. Bozuk JSON dahil hiçbir girdi hata fırlatmaz. */
export function kickCercevesiAyristir(ham: string): KickCercevesi {
  let cerceve: Record<string, unknown> | null
  try {
    cerceve = nesne(JSON.parse(ham))
  } catch {
    return { tur: 'diger' }
  }
  if (!cerceve) return { tur: 'diger' }

  const olay = cerceve.event
  if (olay === 'pusher:connection_established') return { tur: 'baglandi' }
  if (olay === 'pusher_internal:subscription_succeeded') return { tur: 'abone' }
  if (olay === 'pusher:ping') return { tur: 'ping' }

  // ⚠️ `data` Pusher'da JSON METNİ olarak geliyor, nesne değil (ölçüldü).
  let veri: Record<string, unknown> | null
  try {
    veri = typeof cerceve.data === 'string' ? nesne(JSON.parse(cerceve.data)) : nesne(cerceve.data)
  } catch {
    veri = null
  }

  if (olay === 'pusher:error') {
    return { tur: 'hata', kod: typeof veri?.code === 'number' ? veri.code : null }
  }

  if (typeof olay !== 'string' || !KICK_MESAJ_OLAYLARI.has(olay) || !veri) return { tur: 'diger' }

  const gonderen = nesne(veri.sender)
  const kimlik = gonderen?.id
  const kullanici = gonderen?.username
  if ((typeof kimlik !== 'number' && typeof kimlik !== 'string') || typeof kullanici !== 'string') {
    return { tur: 'diger' }
  }
  if (typeof veri.content !== 'string') return { tur: 'diger' }

  const metin = veri.content.replace(KICK_IFADE, ' ').replace(/\s+/g, ' ').trim()
  if (!metin) return { tur: 'diger' }

  return {
    tur: 'mesaj',
    mesaj: { id: `kick:${kimlik}`, ad: kullanici.slice(0, EN_UZUN_AD), metin },
  }
}
