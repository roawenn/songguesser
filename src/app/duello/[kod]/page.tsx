import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { kodGecerli } from '@/game/duel'
import { duelloOku } from '@/lib/duelStore'
import { ClientDuello } from './ClientDuello'

export const metadata: Metadata = {
  title: 'Düello',
  description: 'Arkadaşınla aynı beş şarkı, kolaydan zora.',
  // Her lobi için ayrı bir URL doğuyor; dizine girmesinler.
  robots: { index: false, follow: true },
}

/**
 * ⚠️ `dynamic = 'force-dynamic'`: lobi kaydı okunuyor, önbelleğe alınamaz.
 */
export const dynamic = 'force-dynamic'

export default async function DuelloPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params
  // Biçim yanlışsa veritabanına hiç gitme.
  if (!kodGecerli(kod)) notFound()

  /*
   * ⚠️ YALNIZCA `oyun` okunuyor; `song_ids` GİZLİ KALIYOR. Gizli anahtarı
   * doğrulanmayan kimseye tur kimliği sızmamalı (bkz. `[kod]/route.ts`).
   *
   * ⚠️ URL'e oyun eklemek (`/duello/unlu/<kod>`) bilinçli olarak REDDEDİLDİ:
   * paylaşılmış mevcut bağlantıları kırardı.
   *
   * Lobi yoksa 'sarki'ye düşülüyor — şarkı kabuğu zaten 404/410 ekranını
   * gösteriyor.
   */
  const satir = await duelloOku(kod)
  return <ClientDuello kod={kod} oyun={satir?.oyun ?? 'sarki'} />
}
