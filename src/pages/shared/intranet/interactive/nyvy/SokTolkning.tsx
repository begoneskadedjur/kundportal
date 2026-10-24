// src/pages/shared/intranet/interactive/nyvy/SokTolkning.tsx
// Prova själv: hur läser sökrutan det du skriver? Använder portalens egen parseQuery
// och KIND_LABELS (components/shared/search/searchModel.ts), så raden "tolkas som ..."
// blir exakt den som sökrutan visar. Ingenting söks på riktigt.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { KIND_LABELS, parseQuery } from '../../../../../components/shared/search/searchModel'

const EXEMPEL = ['070-123 45 67', 'BE-0001234', 'Gårdsvägen 3', 'Exempel AB', 'arkiv möss', 'skapa offert Exempel AB']

export default function SokTolkning() {
  const [text, setText] = useState('070-123 45 67')
  const p = parseQuery(text)
  const forKort = text.trim().length > 0 && p.term.trim().length < 2 && !p.verb
  return (
    <div className="my-5 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2">
        <Icon name="allman.sok" size={20} className="text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova: hur läser sökrutan det du skriver?</p>
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-slate-400">Skriv som i sökrutan</span>
        <input type="text" value={text} onChange={e => setText(e.target.value)}
          placeholder="Sök ärende, kund, org.nr, telefon eller sida"
          className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-[15px] text-white placeholder:text-slate-500 focus:border-[#20c58f] focus:outline-none" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {EXEMPEL.map(e => (
          <button key={e} type="button" onClick={() => setText(e)}
            className={`min-h-[36px] rounded-lg border px-2.5 text-sm ${text === e ? 'border-[#20c58f] bg-[#20c58f]/10 text-white' : 'border-slate-700 bg-slate-900/40 text-slate-300'}`}>{e}</button>
        ))}
      </div>
      <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm" role="status" aria-live="polite">
        {!text.trim() ? <p className="text-slate-400">Tom ruta: du ser Senast öppnade och Åtgärder.</p>
          : forKort ? <p className="text-slate-300">Skriv minst två tecken.</p>
          : (
            <>
              {p.kind && <p className="font-mono text-slate-300">tolkas som {KIND_LABELS[p.kind]}{p.includeArchived ? ', med arkiv' : ''}</p>}
              {p.includeArchived && <p className="text-slate-400">Ordet arkiv tas bort ur sökningen. Gamla ärenden från ClickUp kommer med, i gruppen Arkiv (ClickUp).</p>}
              {p.verb && <p className="text-slate-400">Börjar med {p.verb}: åtgärderna visas först.</p>}
              {p.term && <p className="text-slate-400">Sökordet som skickas: <span className="text-white">{p.term}</span></p>}
            </>
          )}
      </div>
    </div>
  )
}
