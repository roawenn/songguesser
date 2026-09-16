import { adNormu } from '@/text/kullaniciAdi'

/**
 * Yönetim kullanıcı araması — PostgREST filtresine GÜVENLE gömülecek hâl. Saf.
 *
 * ⚠️ Arama metni `or=(…ilike.*q*…)` içine yazılıyor. `,` `(` `)` filtreyi
 * böler, `*` joker karakterdir, `"` ve `\` alıntıyı bozar. Temizlenmeseydi
 * "a,banli_at.is.null" gibi bir metin sorguya yeni koşul eklerdi.
 */
export function aramaTemizle(ham: string | null | undefined): { ad: string; eposta: string } | null {
  if (!ham) return null
  const eposta = ham
    .slice(0, 80)
    .replace(/[^0-9A-Za-z@._+-]/g, '')
    .toLowerCase()
  const ad = adNormu(ham.slice(0, 40)).replace(/[^0-9a-z]/g, '')
  if (!ad && !eposta) return null
  return { ad, eposta }
}

/** `or=(…)` filtresi; arama boşsa null. */
export function aramaFiltresi(ham: string | null | undefined): string | null {
  const t = aramaTemizle(ham)
  if (!t) return null
  const kosullar: string[] = []
  if (t.ad) kosullar.push(`kullanici_adi_norm.ilike.*${t.ad}*`)
  if (t.eposta) kosullar.push(`email.ilike.*${t.eposta}*`)
  return `(${kosullar.join(',')})`
}
