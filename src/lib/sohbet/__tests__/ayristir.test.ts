import { describe, it, expect } from 'vitest'
import { kickCercevesiAyristir, twitchSatiriAyristir } from '../ayristir'

/** Canlı bir kanaldan alınmış gerçek satır (metin kısaltıldı). */
const TWITCH_GERCEK =
  '@badge-info=subscriber/60;badges=subscriber/60,glitchcon2020/1;color=#9FB6FC;display-name=MarwN1;emotes=;first-msg=0;id=9422c902;mod=0;room-id=71092938;subscriber=1;tmi-sent-ts=1789474233635;turbo=0;user-id=124327863;user-type= :marwn1!marwn1@marwn1.tmi.twitch.tv PRIVMSG #xqc :gülpembe'

const kick = (data: unknown, event = 'App\\Events\\ChatMessageEvent') =>
  JSON.stringify({ event, data: JSON.stringify(data), channel: 'chatrooms.1.v2' })

describe('twitchSatiriAyristir', () => {
  it('gerçek PRIVMSG satırını çözer', () => {
    expect(twitchSatiriAyristir(TWITCH_GERCEK)).toEqual({
      id: 'twitch:124327863',
      ad: 'MarwN1',
      metin: 'gülpembe',
    })
  })

  it('etiketsiz satırda nick kimlik olur', () => {
    expect(twitchSatiriAyristir(':ayse!ayse@ayse.tmi.twitch.tv PRIVMSG #kanal :Sen Ağlama')).toEqual({
      id: 'twitch:ayse',
      ad: 'ayse',
      metin: 'Sen Ağlama',
    })
  })

  it('/me mesajını ve etiket kaçışlarını açar', () => {
    const satir = '@display-name=Ali\\sVeli;user-id=7 :ali!ali@ali.tmi.twitch.tv PRIVMSG #k :\x01ACTION şımarık\x01'
    expect(twitchSatiriAyristir(satir)).toEqual({ id: 'twitch:7', ad: 'Ali Veli', metin: 'şımarık' })
  })

  it('mesaj olmayan satırlar null', () => {
    expect(twitchSatiriAyristir('PING :tmi.twitch.tv')).toBeNull()
    expect(twitchSatiriAyristir('@room-id=1 :tmi.twitch.tv ROOMSTATE #xqc')).toBeNull()
    expect(twitchSatiriAyristir(':justinfan1!justinfan1@justinfan1.tmi.twitch.tv JOIN #xqc')).toBeNull()
  })
})

describe('kickCercevesiAyristir', () => {
  it('ölçülen olay adıyla mesajı çözer', () => {
    const c = kickCercevesiAyristir(
      kick({ id: 'x', chatroom_id: 1, content: 'Gülpembe', type: 'message', sender: { id: 120389294, username: 'Kodluck' } }),
    )
    expect(c).toEqual({ tur: 'mesaj', mesaj: { id: 'kick:120389294', ad: 'Kodluck', metin: 'Gülpembe' } })
  })

  it('eski olay adını da tanır', () => {
    const c = kickCercevesiAyristir(
      kick({ content: 'Aşk', sender: { id: 5, username: 'a' } }, 'App\\Events\\ChatMessageSentEvent'),
    )
    expect(c.tur).toBe('mesaj')
  })

  it('sohbet ifadelerini metinden atar; yalnız ifadeyse mesaj saymaz', () => {
    const c = kickCercevesiAyristir(kick({ content: 'Şımarık [emote:37226:KEKW]', sender: { id: 1, username: 'b' } }))
    expect(c).toEqual({ tur: 'mesaj', mesaj: { id: 'kick:1', ad: 'b', metin: 'Şımarık' } })
    expect(kickCercevesiAyristir(kick({ content: '[emote:1:x]', sender: { id: 1, username: 'b' } })).tur).toBe('diger')
  })

  it('Pusher denetim olayları', () => {
    expect(kickCercevesiAyristir('{"event":"pusher:connection_established","data":"{}"}').tur).toBe('baglandi')
    expect(kickCercevesiAyristir('{"event":"pusher_internal:subscription_succeeded","data":"{}"}').tur).toBe('abone')
    expect(kickCercevesiAyristir('{"event":"pusher:ping","data":{}}').tur).toBe('ping')
    expect(kickCercevesiAyristir('{"event":"pusher:error","data":{"code":4001,"message":"x"}}')).toEqual({
      tur: 'hata',
      kod: 4001,
    })
  })

  it('bozuk girdide hata fırlatmaz', () => {
    expect(kickCercevesiAyristir('{bozuk').tur).toBe('diger')
    expect(kickCercevesiAyristir('null').tur).toBe('diger')
    expect(kickCercevesiAyristir(kick({ content: 'x' })).tur).toBe('diger')
  })
})
