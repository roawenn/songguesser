import { NextResponse } from 'next/server'
import { CHIPS, type ChipId, UNLU_CHIPS, type UnluChipId } from '@/data/categories'
import { duelloKur, turleriSec } from '@/lib/duelStore'
import { supabaseReady } from '@/lib/supabase'
import { sinirAsildi, cokHizli } from '@/lib/hizSinir'

/**
 * Yeni düello lobisi kurar.
 *
 * ⚠️ Herkese açık yazma yolu. Kötüye kullanımı sınırlayan üç şey var:
 * lobi 2 saatte kendini geçersizleştiriyor (`expires_at`), gövde hiçbir
 * serbest metin taşımıyor (yalnızca seçki kimliği), ve satır minik.
 */
export async function POST(req: Request) {
  /*
   * ⚠️ Kimlik doğrulaması olmayan bir yazma yolu. Sınırsızken tek bir makine
   * hem `duels` tablosunu şişirebiliyor hem de aşağıdaki şarkı seçimini
   * tekrar tekrar çalıştırabiliyordu.
   */
  if (await sinirAsildi(req, { ad: 'duello-kur', limit: 10, pencere: '10 minutes', hataVarsaIzin: true })) {
    return cokHizli('Çok fazla lobi kurdun. Biraz bekle.')
  }

  if (!supabaseReady || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Düello şu an kapalı.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  /*
   * ⚠️ `oyun` varsayılanı 'sarki': eski istemciler (açık sekmeler) gövdeye
   * bu alanı koymuyor ve onları kırmanın anlamı yok.
   */
  const oyun = body.oyun === 'unlu' ? 'unlu' : body.oyun === 'kapak' ? 'kapak' : 'sarki'
  const chip = body.chip as ChipId | UnluChipId
  /*
   * ⚠️ Kolay mod LOBİYE yazılır, oyuncuların kendi ayarından okunmaz: iki
   * oyuncuya aynı kabul kuralı uygulanmalı. Kural kuranın o anki tercihi.
   */
  const kolay = oyun === 'kapak' ? body.kolay === true : null

  const gecerli =
    oyun === 'unlu'
      ? UNLU_CHIPS.some((c) => c.id === chip)
      : CHIPS.some((c) => c.id === chip)
  if (!gecerli) {
    return NextResponse.json({ error: 'Bilinmeyen seçki.' }, { status: 400 })
  }

  const songIds = await turleriSec(oyun, chip)
  if (!songIds) {
    // Kademelerden biri boş — bu seçki düelloya yetmiyor.
    return NextResponse.json(
      {
        error:
          oyun === 'unlu'
            ? 'Bu seçkide her zorluktan ünlü yok; başka bir seçki dene.'
            : oyun === 'kapak'
              ? 'Bu seçkide her zorluktan albüm yok; başka bir seçki dene.'
              : 'Bu seçkide her zorluktan şarkı yok; başka bir seçki dene.',
      },
      { status: 409 },
    )
  }

  const kurulan = await duelloKur(oyun, chip, songIds, kolay)
  if (!kurulan) {
    return NextResponse.json({ error: 'Lobi kurulamadı, tekrar dene.' }, { status: 502 })
  }

  return NextResponse.json({ kod: kurulan.code, gizli: kurulan.secret, slot: 1 })
}
