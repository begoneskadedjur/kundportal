// src/components/fragor/SvarsRuta.tsx
// Svarsrutan i en tråd: text med @-nämning (samma förslag som kommunikationspanelen),
// Ta bild, Välj fil (bilder och PDF upp till 5 MB) och Skicka. Ctrl + Enter skickar.

import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { useMentions, type TrackedMention } from '../../hooks/useMentions'
import MentionSuggestions from '../communication/MentionSuggestions'
import type { MentionSuggestion } from '../../types/communication'
import { IKONKNAPP, KNAPP_PRIMAR } from './fragorUi'
import { giltigaFiler, TILLATNA_TYPER } from './filer'

interface Props {
  onSkicka: (text: string, filer: File[], namningar: TrackedMention[]) => Promise<boolean>
  skickar: boolean
  etikett: string
  knappText: string
  hint?: string
}

export default function SvarsRuta({ onSkicka, skickar, etikett, knappText, hint }: Props) {
  const [text, setText] = useState('')
  const [filer, setFiler] = useState<File[]>([])
  const textRef = useRef<HTMLTextAreaElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)
  const filRef = useRef<HTMLInputElement>(null)
  const {
    suggestions, isOpen, selectedIndex, mentionedUsers,
    handleInputChange, handleKeyDown, selectSuggestion, closeSuggestions, clearMentions,
  } = useMentions(text, setText)

  useEffect(() => {
    const t = textRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 220)}px`
  }, [text])

  const kanSkicka = !skickar && (text.trim().length > 0 || filer.length > 0)

  const skicka = async () => {
    if (!kanSkicka) return
    const ok = await onSkicka(text, filer, mentionedUsers)
    if (ok) {
      setText('')
      setFiler([])
      clearMentions()
    }
  }

  const valjNamn = (s: MentionSuggestion) => {
    setText(selectSuggestion(s))
    textRef.current?.focus()
  }

  const laggTill = (lista: FileList | null) => {
    const ok = giltigaFiler(lista)
    if (ok.length) setFiler(prev => [...prev, ...ok])
    if (kameraRef.current) kameraRef.current.value = ''
    if (filRef.current) filRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label htmlFor="fragor-svar" className="block text-sm font-semibold text-white">{etikett}</label>
      <div className="relative rounded-xl border border-slate-600 bg-slate-900 focus-within:border-[#20c58f] focus-within:ring-1 focus-within:ring-[#20c58f]/40">
        <textarea
          id="fragor-svar"
          ref={textRef}
          value={text}
          rows={2}
          onChange={e => { setText(e.target.value); handleInputChange(e.target.value, e.target.selectionStart) }}
          onKeyDown={e => {
            if (handleKeyDown(e)) return
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); skicka() }
          }}
          onBlur={() => setTimeout(closeSuggestions, 200)}
          placeholder="Skriv ditt svar. Skriv @ för att nämna en kollega."
          className="w-full min-h-[64px] px-3 py-3 bg-transparent text-[15px] text-white placeholder-slate-500 resize-none focus:outline-none"
        />
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 z-[200]">
            <MentionSuggestions suggestions={suggestions} selectedIndex={selectedIndex} onSelect={valjNamn} />
          </div>
        )}
        {filer.length > 0 && (
          <ul className="px-3 pb-2 space-y-1">
            {filer.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-300">
                <Icon name={f.type.startsWith('image/') ? 'allman.foto' : 'rapport.gem'} size={16} className="text-slate-400 flex-shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiler(prev => prev.filter((_, j) => j !== i))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label={`Ta bort ${f.name}`}
                >
                  <Icon name="allman.stang" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => laggTill(e.target.files)} />
        <input ref={filRef} type="file" accept={TILLATNA_TYPER.join(',')} multiple className="hidden" onChange={e => laggTill(e.target.files)} />
        <button type="button" className={IKONKNAPP} onClick={() => kameraRef.current?.click()} aria-label="Ta bild" title="Ta bild">
          <Icon name="allman.foto" size={20} />
        </button>
        <button type="button" className={IKONKNAPP} onClick={() => filRef.current?.click()} aria-label="Välj fil" title="Välj fil (bild eller PDF, högst 5 MB)">
          <Icon name="rapport.gem" size={20} />
        </button>
        <button
          type="button"
          className={IKONKNAPP}
          onClick={() => {
            const t = textRef.current
            const pos = t?.selectionStart ?? text.length
            const ny = `${text.slice(0, pos)}${pos > 0 && !/\s$/.test(text.slice(0, pos)) ? ' ' : ''}@${text.slice(pos)}`
            setText(ny)
            const markor = ny.length - text.slice(pos).length
            setTimeout(() => {
              t?.focus()
              t?.setSelectionRange(markor, markor)
              handleInputChange(ny, markor)
            }, 0)
          }}
          aria-label="Nämn en kollega"
          title="Nämn en kollega"
        >
          <Icon name="dok.omnamnd" size={20} />
        </button>
        <span className="hidden sm:inline ml-2 text-sm text-slate-500 flex-1">{hint || 'Ctrl + Enter skickar'}</span>
        <span className="sm:hidden flex-1" />
        <button type="button" onClick={skicka} disabled={!kanSkicka} className={KNAPP_PRIMAR}>
          <Icon name={skickar ? 'allman.laddar' : 'rapport.skicka'} size={20} className={skickar ? 'animate-spin' : ''} />
          {skickar ? 'Skickar...' : knappText}
        </button>
      </div>
    </div>
  )
}
