// src/pages/shared/intranet/interactive/nyvy/StangJamforelse.tsx
// Interaktiv del i guiden Stäng ärendet eller bara besöket: jämför Hela ärendet och
// Bara besöket i steget Klart, och prova tre vardagsfall. Texterna bygger på
// vadHanderVidStang och vadHanderVidBesok i EditCaseModal och på RevisitModal.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'

type Val = 'hela' | 'besok'

const RADER: { rubrik: string; hela: string; besok: string }[] = [
  { rubrik: 'Status', hela: 'Avslutat, med dagens datum som avslutsdatum.', besok: 'Återbesök. Ärendet stängs inte.' },
  { rubrik: 'Knappen', hela: 'Stäng hela ärendet', besok: 'Boka återbesök, sedan väljer du ny tid i dialogen.' },
  { rubrik: 'Besöket', hela: 'Sparas i besökshistoriken med teknikerna, rapporten och tiden.', besok: 'Sparas i besökshistoriken med teknikerna och rapporten.' },
  { rubrik: 'Fakturan', hela: 'Raderna blir en faktura som går vidare till godkännande och Fortnox. 0 kr ger ingen faktura.', besok: 'Ingen faktura, om du inte kryssar i Skapa delfaktura för nuvarande tjänster.' },
  { rubrik: 'Raderna', hela: 'Faktureras. Ärendet är klart.', besok: 'Ligger kvar till nästa gång, eller blir delfaktura om du kryssar i.' },
  { rubrik: 'Provisionen', hela: 'Registreras om ärendet är provisionsgrundande och underlaget är minst 4 000 kr exkl. moms.', besok: 'Registreras först när ärendet stängs.' },
  { rubrik: 'Rapporten', hela: 'Skickas inte av sig själv. Skicka den i steget Rapport.', besok: 'Skickas inte av sig själv. Skicka den i steget Rapport.' },
]

const FALL: { text: string; ratt: Val | 'spara'; forklaring: string }[] = [
  { text: 'Råttorna hos Familjen Exempel är borta och ventilen är tätad. Du ska inte tillbaka.', ratt: 'hela', forklaring: 'Jobbet är klart. Hela ärendet stänger det och gör fakturan.' },
  { text: 'Fällorna hos Brf Exempelgården ska kontrolleras om två veckor.', ratt: 'besok', forklaring: 'Du ska tillbaka i samma ärende. Bara besöket bokar återbesöket och ärendet står kvar öppet.' },
  { text: 'Du har skrivit halva rapporten men måste åka till ett akut jobb. Du kommer tillbaka i eftermiddag.', ratt: 'spara', forklaring: 'Spara utan att stänga sparar allt och låter ärendet stå som det är. Inget återbesök behövs.' },
]

const VAL_TEXT: Record<Val | 'spara', { text: string; ikon: IconName }> = {
  hela: { text: 'Hela ärendet', ikon: 'falt.klart' },
  besok: { text: 'Bara besöket', ikon: 'arende.aterbesok' },
  spara: { text: 'Spara utan att stänga', ikon: 'allman.bock' },
}

export default function StangJamforelse() {
  const [val, setVal] = useState<Val>('hela')
  const [svar, setSvar] = useState<Record<number, Val | 'spara'>>({})
  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Hela ärendet eller Bara besöket</p>
        <p className="text-sm text-slate-400">Välj ett av dem och se vad som händer.</p>
      </div>
      <div role="radiogroup" aria-label="Vad är klart?" className="grid gap-2 sm:grid-cols-2">
        {(['hela', 'besok'] as const).map(v => (
          <button key={v} type="button" role="radio" aria-checked={val === v} onClick={() => setVal(v)}
            className={`min-h-[64px] rounded-2xl p-3 text-left ${val === v ? 'border-2 border-[#20c58f] bg-[#20c58f]/10' : 'border border-slate-600 bg-slate-800/40 hover:border-slate-400'}`}>
            <span className="block text-[15px] font-semibold text-white">{v === 'hela' ? 'Hela ärendet' : 'Bara besöket'}</span>
            <span className="mt-0.5 block text-sm text-slate-400">{v === 'hela' ? 'Ärendet avslutas, får avslutsdatum och stängs för fakturering.' : 'Ärendet fortsätter med ett återbesök. Det stängs inte.'}</span>
          </button>
        ))}
      </div>
      <dl className="grid gap-0 overflow-hidden rounded-xl border border-slate-700" aria-live="polite">
        {RADER.map(r => (
          <div key={r.rubrik} className="grid gap-0.5 border-b border-slate-700/60 bg-slate-900/60 px-3 py-2 last:border-b-0 sm:grid-cols-[140px_1fr] sm:gap-3">
            <dt className="text-sm font-semibold text-slate-300">{r.rubrik}</dt>
            <dd className="m-0 text-sm text-slate-200">{val === 'hela' ? r.hela : r.besok}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3">
        <p className="text-sm font-semibold text-white">Vad väljer du?</p>
        {FALL.map((f, i) => {
          const s = svar[i]
          return (
            <div key={f.text} className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-sm text-slate-200">{f.text}</p>
              <div className="flex flex-wrap gap-2">
                {(['hela', 'besok', 'spara'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setSvar(p => ({ ...p, [i]: v }))} aria-pressed={s === v}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${s === v ? (v === f.ratt ? 'border-[#20c58f] bg-[#20c58f]/15 text-white' : 'border-red-500/60 bg-red-500/10 text-red-200') : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
                    <Icon name={VAL_TEXT[v].ikon} size={16} />{VAL_TEXT[v].text}
                  </button>
                ))}
              </div>
              {s && <p className={`text-sm ${s === f.ratt ? 'text-[#20c58f]' : 'text-red-300'}`} role="status">{s === f.ratt ? 'Rätt. ' : 'Inte riktigt. '}{f.forklaring}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
