'use client'

import { useState } from 'react'

/**
 * "Sıradaki" düğmesinin meşgul durumu.
 *
 * ⚠️ Geri bildirimi DÜĞMENİN KENDİSİ vermek zorunda: tur kurulumu birkaç yüz
 * milisaniye sürerken oyun durumu hâlâ "bitti" olduğu için sonuç kartı ekranda
 * kalıyor ve kullanıcı "tıklamam işlemedi" sanıp tekrar basıyordu. Her ek
 * tıklama süren kurulumu iptal edip baştan başlatıyordu (bkz. `useRound.next`).
 *
 * ⚠️ Kilidi sıfırlayan bir şey YOK ve olmamalı: kartlar tur kimliğiyle
 * anahtarlanıyor (`key={...}`) ve tur bitince zaten sökülüyor, yani bir sonraki
 * turda bileşen sıfırdan kuruluyor.
 */
export function useSonrakiKilit(onSonraki: () => void) {
  const [basildi, setBasildi] = useState(false)
  return {
    basildi,
    ozellikler: {
      disabled: basildi,
      'aria-busy': basildi,
      onClick: () => {
        if (basildi) return
        setBasildi(true)
        onSonraki()
      },
    },
  }
}
