/**
 * Yayıncı modunda girilen kanal adını bağlanılabilir biçime getirir.
 *
 * Yayıncılar adı her biçimde yapıştırıyor: "KaiCenat", "@elraenn",
 * "https://www.twitch.tv/xqc", "kick.com/jahrein?ref=…". Hepsi tek kısa ada iner.
 *
 * ⚠️ Küçültme BURADA: `toLowerCase()` `src/text/` dışında yasak. Twitch IRC'de
 * `JOIN #KaiCenat` sessizce hiçbir mesaj getirmiyor; kanal adı küçük harf olmalı.
 * Yalnızca ASCII kabul edildiği için Türkçe İ/ı sorunu burada doğmuyor.
 *
 * ⚠️ Kick adlarında tire olabilir, Twitch'te olamaz — desenler ayrı.
 */
export function kanalAdiTemizle(ham: string, platform: 'twitch' | 'kick'): string | null {
  const s = ham
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?(twitch\.tv|kick\.com)\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase()
  const desen = platform === 'twitch' ? /^[a-z0-9_]{3,25}$/ : /^[a-z0-9_-]{3,30}$/
  return desen.test(s) ? s : null
}
