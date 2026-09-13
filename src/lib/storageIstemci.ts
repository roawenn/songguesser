import { UNLU_KOVA_ADI } from '@/data/unluKova'

/**
 * Ünlü görselinin herkese açık adresi — TARAYICI tarafı.
 *
 * ⚠️ `lib/storage.ts` `server-only`; oradan import etmek derlemeyi kırar.
 * Burada yalnızca `NEXT_PUBLIC_SUPABASE_URL` kullanılıyor, o da zaten
 * tarayıcıya inen bir değer.
 */
const KOK = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

export function storagePublicUrlIstemci(yol: string): string {
  if (!KOK) return ''
  return `${KOK}/storage/v1/object/public/${UNLU_KOVA_ADI}/${yol}`
}
