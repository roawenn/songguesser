'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Song } from '@/data/schema'
import { query, type SearchIndex } from '@/text/autocomplete'

interface Props {
  index: SearchIndex | null
  /** Normal seviyede açık, Zor'da kapalı. */
  suggestions: boolean
  disabled: boolean
  ambiguous: Song[] | null
  onGuess: (raw: string) => void
  onPickAmbiguous: (song: Song) => void
}

/** Combobox ile öneri listesini birbirine bağlayan sabit kimlik. */
const LIST_ID = 'nk-oneriler'

export function GuessInput({
  index,
  suggestions,
  disabled,
  ambiguous,
  onGuess,
  onPickAmbiguous,
}: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)

  const list = useMemo(() => {
    if (!suggestions || !index || text.trim().length < 2) return []
    return query(index, text, 5)
  }, [index, text, suggestions])

  useEffect(() => setCursor(0), [text])

  function submit(value: string) {
    const v = value.trim()
    if (!v) return
    onGuess(v)
    setText('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && list.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => (c + 1) % list.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => (c - 1 + list.length) % list.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const picked = list[cursor]
        submit(picked ? picked.song.t : text)
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submit(text)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Şarkı adını yaz…"
          aria-label="Şarkı tahmini"
          // ⚠️ `aria-expanded` tek başına yetmez: `role="combobox"` olmadan
          // ekran okuyucu bunu sıradan bir metin kutusu sanar, `aria-controls`
          // olmadan listeyi bulamaz, `aria-activedescendant` olmadan da ok
          // tuşlarıyla gezerken hangi şıkta olduğunu söyleyemez.
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && list.length > 0}
          aria-controls={LIST_ID}
          aria-activedescendant={
            open && list.length > 0 && cursor >= 0 ? `${LIST_ID}-${cursor}` : undefined
          }
          className="nk-input"
          // ⚠️ iOS otomatik düzeltme Türkçe kelimeleri yazarken İngilizce'ye
          // çevirir — bu dört öznitelik olmadan oyun mobilde sinir bozucu olur.
          type="search"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          style={{
            flex: 1,
            padding: '13px 15px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5,
            background: 'rgba(255,255,255,0.03)',
            color: '#e6e8ea',
            outline: 'none',
            opacity: disabled ? 0.45 : 1,
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => submit(text)}
          className="nk-submit"
          style={{
            padding: '13px 20px',
            border: '1px solid var(--acc)',
            borderRadius: 5,
            background: 'oklch(0.81 0.12 var(--hue) / 0.1)',
            color: 'var(--acc)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Tahmin
        </button>
      </div>

      {/* Belirsizlik: birden fazla şarkıya benziyor, hak tüketilmedi. */}
      {ambiguous && ambiguous.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 11,
            border: '1px solid var(--acc)',
            borderRadius: 5,
            background: 'oklch(0.81 0.12 var(--hue) / 0.06)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: '#8c9297',
              marginBottom: 8,
            }}
          >
            hangisi? · hakkın gitmedi
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ambiguous.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickAmbiguous(s)}
                className="nk-choice"
                style={{
                  padding: '7px 11px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.03)',
                  color: '#d7dadd',
                  fontSize: 13,
                }}
              >
                {s.t} <span style={{ color: '#757b80' }}>· {s.a}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && list.length > 0 && (
        <div
          id={LIST_ID}
          role="listbox"
          aria-label="Şarkı önerileri"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5,
            background: '#13161a',
            boxShadow: '0 24px 50px -20px rgba(0,0,0,0.9)',
            overflow: 'hidden',
            zIndex: 5,
          }}
        >
          {list.map((s, i) => (
            <button
              key={s.song.id}
              id={`${LIST_ID}-${i}`}
              type="button"
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(s.song.t)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 0,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: i === cursor ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: '#d7dadd',
                fontSize: 13.5,
              }}
            >
              {s.song.t} <span style={{ color: '#757b80' }}>— {s.song.a}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .nk-input:focus { border-color: var(--acc) !important; }
        .nk-submit:hover:not(:disabled) { background: oklch(0.81 0.12 var(--hue) / 0.18) !important; }
      `}</style>
    </div>
  )
}
