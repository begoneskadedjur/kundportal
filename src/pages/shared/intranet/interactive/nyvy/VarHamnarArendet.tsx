// src/pages/shared/intranet/interactive/nyvy/VarHamnarArendet.tsx
// Prova själv: var i Mina ärenden hamnar ett ärende? Samma regler som gruppera() i
// components/technician/ny/arenden/arendeLogik.ts och vantarPaDig() i teknikerDagService:
//  - Avslutat                                   -> Avslutade
//  - Privat- eller företagsärende med status Öppen, Offert signerad - boka in eller
//    Avtal signerat - Etablera                  -> Att göra, Behöver en tid
//  - Datumet har passerat och status Bokad eller Återbesök -> Att göra, Passerade besök att avsluta
//  - Idag till och med söndag                   -> Att göra, Den här veckan
//  - Efter den här veckan, inom 4 veckor        -> Kommande, vecka för vecka
//  - Ännu längre fram                           -> Kommande, Längre fram (per kund)
//  - Annars (till exempel passerat med Ombokning, eller ingen tid) -> Att göra, Övriga öppna ärenden

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'

type Typ = 'privat' | 'avtal'
type Datum = 'ingen' | 'passerat' | 'vecka' | 'kommande' | 'langre'
type Status = 'Öppen' | 'Bokad' | 'Återbesök' | 'Ombokning' | 'Offert skickad' | 'Avslutat'

const DATUM: { id: Datum; text: string }[] = [
  { id: 'ingen', text: 'Ingen tid' },
  { id: 'passerat', text: 'Har passerat' },
  { id: 'vecka', text: 'Den här veckan' },
  { id: 'kommande', text: 'Om 2 veckor' },
  { id: 'langre', text: 'Om 3 månader' },
]
const STATUSAR: Status[] = ['Öppen', 'Bokad', 'Återbesök', 'Ombokning', 'Offert skickad', 'Avslutat']
const BOKAS = new Set<Status>(['Öppen'])

function placera(typ: Typ, datum: Datum, status: Status): { lage: string; grupp: string; text: string } {
  if (status === 'Avslutat') return { lage: 'Avslutade', grupp: 'Månaden ärendet avslutades', text: 'Avslutade ärenden ligger per månad, senaste först.' }
  if (typ === 'privat' && BOKAS.has(status)) return { lage: 'Att göra', grupp: 'Behöver en tid', text: 'Ring kunden och boka in besöket. Knappen till höger på raden ringer.' }
  if (datum === 'passerat' && (status === 'Bokad' || status === 'Återbesök')) return { lage: 'Att göra', grupp: 'Passerade besök att avsluta', text: 'Öppna ärendet och avsluta besöket. Efter 30 dagar blir raden orange.' }
  if (datum === 'vecka') return { lage: 'Att göra', grupp: 'Den här veckan', text: 'Dina besök från idag till och med söndag.' }
  if (datum === 'kommande') return { lage: 'Kommande', grupp: 'De närmaste 4 veckorna', text: 'Vecka för vecka. Inget här är försenat.' }
  if (datum === 'langre') return { lage: 'Kommande', grupp: 'Längre fram', text: 'Samlat per kund. Flyttar upp av sig själv när det är dags.' }
  return { lage: 'Att göra', grupp: 'Övriga öppna ärenden', text: 'Längst ner och hopfällt. Väntar på kunden eller kontoret.' }
}

function Val<T extends string>({ rubrik, val, vald, onVal }: { rubrik: string; val: { id: T; text: string }[]; vald: T; onVal: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{rubrik}</legend>
      <div className="flex flex-wrap gap-1.5">
        {val.map(v => (
          <button key={v.id} type="button" role="radio" aria-checked={vald === v.id} onClick={() => onVal(v.id)}
            className={`min-h-[40px] rounded-lg border px-3 text-sm ${vald === v.id ? 'border-[#20c58f] bg-[#20c58f]/10 font-semibold text-white' : 'border-slate-700 bg-slate-900/40 text-slate-300'}`}>
            {v.text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function VarHamnarArendet() {
  const [typ, setTyp] = useState<Typ>('privat')
  const [datum, setDatum] = useState<Datum>('passerat')
  const [status, setStatus] = useState<Status>('Bokad')
  const p = placera(typ, datum, status)
  return (
    <div className="my-5 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2">
        <Icon name="arendelista.att-gora" size={20} className="text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova: var hamnar ärendet?</p>
      </div>
      <Val rubrik="Ärendet" val={[{ id: 'privat', text: 'Privat eller företag' }, { id: 'avtal', text: 'Avtalsbesök' }]} vald={typ} onVal={setTyp} />
      <Val rubrik="Besöksdag" val={DATUM} vald={datum} onVal={setDatum} />
      <Val rubrik="Status" val={STATUSAR.map(s => ({ id: s, text: s }))} vald={status} onVal={setStatus} />
      <div className="rounded-xl border border-[#20c58f]/30 bg-slate-900 p-3" role="status" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#20c58f]">{p.lage}</p>
        <p className="text-[15px] font-semibold text-white">{p.grupp}</p>
        <p className="text-sm text-slate-400">{p.text}</p>
      </div>
      <p className="text-xs text-slate-500">Avtalsbesök hamnar aldrig under Behöver en tid. Utan datum står de under Övriga öppna ärenden.</p>
    </div>
  )
}
