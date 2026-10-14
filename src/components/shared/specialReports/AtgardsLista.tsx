// src/components/shared/specialReports/AtgardsLista.tsx
// Rekommenderade åtgärder (3.54.0) som en numrerad lista, en rad per åtgärd.
// Lagras som rader avskilda med radbrytning i special_reports.recommendations,
// så schemat är oförändrat. Äldre fritext delas på radbrytningar (en rad per
// stycke). Enter delar raden vid markören och skapar nästa rad, Backsteg först
// i en rad slår ihop den med raden ovanför, och inklistrad text med flera rader
// blir flera åtgärder.
//
// Raderna hålls lokalt (med egna nycklar) och varje ändring skickas direkt till
// onChange, som sparar med fördröjning. Kommer en ny text utifrån (Snygga till)
// läses raderna om.

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../icons/Icon'
import { atgardsRader } from '../../../types/specialReport'
import { IKON_KNAPP_LATT } from './specialReportUtils'

interface Rad {
  id: number
  text: string
}

let nastaId = 1
const nyRad = (text = ''): Rad => ({ id: nastaId++, text })

/** Raderna ur den lagrade texten, minst en (tom) rad att skriva i */
function lasRader(text: string | null | undefined): Rad[] {
  const rader = atgardsRader(text).map(t => nyRad(t))
  return rader.length > 0 ? rader : [nyRad()]
}

interface AtgardsListaProps {
  text: string | null
  onChange: (text: string | null) => void
}

export default function AtgardsLista({ text, onChange }: AtgardsListaProps) {
  const [rader, setRader] = useState<Rad[]>(() => lasRader(text))
  // Texten som raderna motsvarar. Skiljer sig propen åt kom ändringen utifrån
  const [kalla, setKalla] = useState(text ?? '')
  const extern = text ?? ''
  if (extern !== kalla) {
    setKalla(extern)
    setRader(lasRader(text))
  }

  const falt = useRef(new Map<number, HTMLTextAreaElement>())
  // Raden (och markörens plats) som ska få fokus efter nästa rendering
  const fokusEfter = useRef<{ id: number; pos: number | 'slut' } | null>(null)

  useLayoutEffect(() => {
    const mal = fokusEfter.current
    if (!mal) return
    fokusEfter.current = null
    const el = falt.current.get(mal.id)
    if (!el) return
    el.focus()
    const pos = mal.pos === 'slut' ? el.value.length : mal.pos
    el.setSelectionRange(pos, pos)
  })

  const andra = (nya: Rad[], fokus?: { id: number; pos: number | 'slut' }) => {
    // Bara rader med text sparas. En tom rad som just skapats ligger kvar lokalt
    // (kalla följer det sparade värdet, så raderna läses inte om) men blir inte
    // tomma radbrytningar i databasen
    const ifyllda = nya.map(r => r.text).filter(t => t.trim())
    const varde = ifyllda.length > 0 ? ifyllda.join('\n') : null
    if (fokus) fokusEfter.current = fokus
    setRader(nya)
    setKalla(varde ?? '')
    onChange(varde)
  }

  const skriv = (i: number, varde: string, markor: number | null) => {
    // Inklistrad text med radbrytningar blir flera rader. Markören hamnar där
    // den stod, efter det inklistrade och före resten av den ursprungliga raden
    if (/[\r\n]/.test(varde)) {
      const ren = varde.replace(/\r\n?/g, '\n')
      const nya = ren.split('\n').map((t, j) => (j === 0 ? { ...rader[i], text: t } : nyRad(t)))
      const fore = ren.slice(0, Math.min(markor ?? ren.length, ren.length))
      const radNr = Math.min(fore.split('\n').length - 1, nya.length - 1)
      const pos = fore.length - (fore.lastIndexOf('\n') + 1)
      andra([...rader.slice(0, i), ...nya, ...rader.slice(i + 1)], { id: nya[radNr].id, pos })
      return
    }
    andra(rader.map((r, j) => (j === i ? { ...r, text: varde } : r)))
  }

  const laggTill = (efter = rader.length - 1) => {
    const ny = nyRad()
    andra([...rader.slice(0, efter + 1), ny, ...rader.slice(efter + 1)], { id: ny.id, pos: 0 })
  }

  const taBort = (i: number) => {
    if (rader.length === 1) {
      andra([{ ...rader[0], text: '' }], { id: rader[0].id, pos: 0 })
      return
    }
    const nya = rader.filter((_, j) => j !== i)
    const granne = nya[Math.max(0, i - 1)]
    andra(nya, { id: granne.id, pos: 'slut' })
  }

  const flytta = (i: number, steg: -1 | 1) => {
    const mal = i + steg
    if (mal < 0 || mal >= rader.length) return
    const nya = [...rader]
    ;[nya[i], nya[mal]] = [nya[mal], nya[i]]
    andra(nya)
  }

  const tangent = (e: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const start = el.selectionStart
    const slut = el.selectionEnd
    // Även Skift+Enter delar raden: en åtgärd innehåller aldrig radbrytningar
    if (e.key === 'Enter') {
      // Dela raden vid markören, resten blir nästa åtgärd
      e.preventDefault()
      const rad = rader[i]
      const ny = nyRad(rad.text.slice(slut))
      andra([...rader.slice(0, i), { ...rad, text: rad.text.slice(0, start) }, ny, ...rader.slice(i + 1)], { id: ny.id, pos: 0 })
      return
    }
    if (e.key === 'Backspace' && i > 0 && start === 0 && slut === 0) {
      // Först i raden: slå ihop med raden ovanför
      e.preventDefault()
      const ovan = rader[i - 1]
      const ihop = { ...ovan, text: ovan.text + rader[i].text }
      andra([...rader.slice(0, i - 1), ihop, ...rader.slice(i + 1)], { id: ovan.id, pos: ovan.text.length })
    }
  }

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {rader.map((rad, i) => (
          <li key={rad.id} className="flex items-start gap-1.5">
            <span
              aria-hidden
              className="mt-2.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#20c58f] text-xs font-bold text-[#04140d] tabular-nums"
            >
              {i + 1}
            </span>
            <RadFalt
              varde={rad.text}
              nr={i + 1}
              faltRef={el => {
                if (el) falt.current.set(rad.id, el)
                else falt.current.delete(rad.id)
              }}
              onSkriv={(v, markor) => skriv(i, v, markor)}
              onTangent={e => tangent(e, i)}
            />
            <span className="flex flex-shrink-0">
              <button type="button" onClick={() => flytta(i, -1)} disabled={i === 0} aria-label={`Flytta åtgärd ${i + 1} upp`} title="Flytta upp" className={IKON_KNAPP_LATT}>
                <Icon name="allman.chevron" size={16} className="-rotate-90" />
              </button>
              <button type="button" onClick={() => flytta(i, 1)} disabled={i === rader.length - 1} aria-label={`Flytta åtgärd ${i + 1} ned`} title="Flytta ned" className={IKON_KNAPP_LATT}>
                <Icon name="allman.chevron" size={16} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => taBort(i)}
                disabled={rader.length === 1 && !rad.text}
                aria-label={`Ta bort åtgärd ${i + 1}`}
                title="Ta bort åtgärden"
                className={IKON_KNAPP_LATT}
              >
                <Icon name="allman.radera" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => laggTill()}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-emerald-500/50 px-3.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
      >
        <Icon name="allman.plus" size={16} />
        Lägg till åtgärd
      </button>
    </div>
  )
}

/** Ett radfält som växer med texten */
function RadFalt({ varde, nr, faltRef, onSkriv, onTangent }: {
  varde: string
  nr: number
  faltRef: (el: HTMLTextAreaElement | null) => void
  onSkriv: (v: string, markor: number | null) => void
  onTangent: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [varde])
  return (
    <textarea
      ref={el => { ref.current = el; faltRef(el) }}
      value={varde}
      rows={1}
      onChange={e => onSkriv(e.target.value, e.target.selectionStart)}
      onKeyDown={onTangent}
      aria-label={`Åtgärd ${nr}`}
      placeholder={nr === 1 ? 'Till exempel: Täta springan vid lastkajens port.' : 'Nästa åtgärd'}
      className="min-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm leading-snug text-slate-100 placeholder-slate-500 focus:border-[#20c58f] focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
    />
  )
}
