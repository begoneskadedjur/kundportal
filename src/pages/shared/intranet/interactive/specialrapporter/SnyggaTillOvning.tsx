// src/pages/shared/intranet/interactive/specialrapporter/SnyggaTillOvning.tsx
// Specialrapportguiden: övning i granskningsrutan för Snygga till. Ett påhittat
// stycke med fem förslag. Ett av dem är fel (ett fackord som är rätt stavat) och
// ska väljas bort. Formulering är avbockad från början, som i PolishReviewModal.
// Ingenting skickas till AI:n och ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { POLISH_KIND_LABEL, type PolishKind } from '../../../../../types/textPolish'
import { Aterkoppling, Knapp, Ram } from '../leads/leadsShared'

interface Forslag {
  id: string
  fran: string
  till: string
  typ: PolishKind
  varfor: string
  /** Rätt svar i övningen: ska förslaget användas? */
  bra: boolean
}

/** Texten som bitar: vanlig text eller id på ett förslag */
const TEXT: (string | { id: string })[] = [
  { id: 'versal' },
  ' har ',
  { id: 'stavning' },
  ' alla tolv stationer i källaren',
  { id: 'komma' },
  ' ',
  { id: 'formulering' },
  '. Vi satte ',
  { id: 'fackord' },
  ' runt röret vid porten.',
]

const FORSLAG: Forslag[] = [
  { id: 'versal', fran: 'vi', till: 'Vi', typ: 'versal', varfor: 'Meningen börjar med stor bokstav.', bra: true },
  { id: 'stavning', fran: 'kontrolerat', till: 'kontrollerat', typ: 'stavning', varfor: 'Stavas med två l.', bra: true },
  { id: 'komma', fran: ' ,', till: ',', typ: 'skiljetecken', varfor: 'Inget mellanslag före komma.', bra: true },
  { id: 'fackord', fran: 'kragnät', till: 'krage nät', typ: 'stavning', varfor: 'Ser ut som två ord.', bra: false },
  { id: 'formulering', fran: 'två hade gnagspår', till: 'två av dem hade spår av gnag', typ: 'formulering', varfor: 'Tydligare för den som inte är tekniker.', bra: true },
]

const START = new Set(FORSLAG.filter(f => f.typ !== 'formulering').map(f => f.id))

export default function SnyggaTillOvning() {
  const [valda, setValda] = useState<Set<string>>(() => new Set(START))
  const [anvant, setAnvant] = useState(false)

  const vaxla = (id: string) => {
    setAnvant(false)
    setValda(v => {
      const ny = new Set(v)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  const borjaOm = () => {
    setValda(new Set(START))
    setAnvant(false)
  }

  const resultat = TEXT.map(b => {
    if (typeof b === 'string') return b
    const f = FORSLAG.find(x => x.id === b.id)
    if (!f) return ''
    return valda.has(f.id) ? f.till : f.fran
  }).join('')

  const fackordKvar = valda.has('fackord')

  return (
    <Ram where="Specialrapport · Snygga till texten" caption="Inget skickas till AI:n i övningen.">
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Så blir texten</p>
          <p className="text-sm leading-loose text-slate-200">
            {TEXT.map((b, n) => {
              if (typeof b === 'string') return <span key={n}>{b}</span>
              const f = FORSLAG.find(x => x.id === b.id)
              if (!f) return null
              const pa = valda.has(f.id)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => vaxla(f.id)}
                  aria-pressed={pa}
                  aria-label={`${POLISH_KIND_LABEL[f.typ]}: ${f.fran.trim()} till ${f.till.trim()}. ${pa ? 'Vald, tryck för att välja bort' : 'Bortvald, tryck för att välja'}`}
                  className="rounded px-0.5 hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                >
                  {pa ? (
                    <>
                      <span className="text-red-400 line-through">{f.fran}</span>
                      <span className="font-semibold text-emerald-400">{f.till}</span>
                    </>
                  ) : (
                    <span className="underline decoration-dotted decoration-slate-500 underline-offset-4">{f.fran}</span>
                  )}
                </button>
              )
            })}
          </p>
          <p className="mt-2 text-xs text-slate-500">Tryck på en markering i texten för att välja bort den.</p>
        </div>

        <div className="space-y-1.5">
          {FORSLAG.map(f => (
            <label key={f.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-2">
              <input
                type="checkbox"
                checked={valda.has(f.id)}
                onChange={() => vaxla(f.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                <span className="text-[11px] text-slate-500">{POLISH_KIND_LABEL[f.typ]}</span>
                <span className="break-words">
                  <span className="text-red-400 line-through">{f.fran.trim()}</span>
                  <span className="text-slate-500"> till </span>
                  <span className="font-semibold text-emerald-400">{f.till.trim()}</span>
                </span>
                <span className="text-xs text-slate-400">{f.varfor}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Knapp primar onClick={() => setAnvant(true)} disabled={valda.size === 0}>
          <Icon name="allman.bock" size={16} />
          Använd {valda.size} {valda.size === 1 ? 'ändring' : 'ändringar'}
        </Knapp>
        <Knapp onClick={borjaOm}>Börja om</Knapp>
      </div>

      {anvant && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-slate-800/40 px-3 py-2 text-sm text-slate-200">{resultat}</p>
          {fackordKvar ? (
            <Aterkoppling ok={false} titel="Kragnät blev fel">
              Kragnät är ett riktigt ord. Välj bort förslaget. I portalen trycker du sedan Rätt stavat, lägg till i ordlistan, så föreslås rättelsen aldrig igen.
            </Aterkoppling>
          ) : (
            <Aterkoppling ok titel="Bra, texten är rättad och kragnät står kvar">
              {valda.has('formulering')
                ? 'Du valde också formuleringen. Det går bra när den säger samma sak, läs den alltid innan du väljer den.'
                : 'Formuleringen var avbockad från början. Välj den bara om den säger samma sak som du menade.'}
            </Aterkoppling>
          )}
        </div>
      )}
    </Ram>
  )
}
