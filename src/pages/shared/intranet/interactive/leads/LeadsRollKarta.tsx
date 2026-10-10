// src/pages/shared/intranet/interactive/leads/LeadsRollKarta.tsx
// Leadsguiderna: vad varje roll ser och får göra. Reglerna följer RLS och RPC:erna i
// docs/leads/ETAPP-3-4.md och ETAPP-5.md samt knapparna i LeadModal. variant markerar den egna kolumnen.
// Tabell på bred skärm, en lista per roll på mobil.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'
import { lasVariant, segment, type LeadsVariant } from './leadsVariant'

const ROLLER: { id: LeadsVariant; label: string }[] = [
  { id: 'tekniker', label: 'Tekniker' },
  { id: 'saljare', label: 'Säljare' },
  { id: 'kontor', label: 'Koordinator och admin' },
]

const RADER: { vad: string; svar: Record<LeadsVariant, string> }[] = [
  { vad: 'Ser leads', svar: { tekniker: 'Dina tips, dina egna och delade', saljare: 'Dina egna, dina tips och delade', kontor: 'Alla' } },
  { vad: 'Skapa lead från engångsärende', svar: { tekniker: 'Ja, på ärenden du ser', saljare: 'Ja', kontor: 'Ja' } },
  { vad: 'Ny lead för hand', svar: { tekniker: 'Ja, Tipsa om en lead', saljare: 'Ja, Ny lead', kontor: 'Ja, Ny lead' } },
  { vad: 'Äga en lead', svar: { tekniker: 'Ja', saljare: 'Ja', kontor: 'Ja' } },
  { vad: 'Logga samtal, mejl, möte och anteckning', svar: { tekniker: 'På leads du ser', saljare: 'På leads du ser', kontor: 'Alla' } },
  { vad: 'Ändra uppgifter och nästa steg', svar: { tekniker: 'Som ägare eller delad', saljare: 'Som ägare eller delad', kontor: 'Alla' } },
  { vad: 'Överlåta och dela', svar: { tekniker: 'Som ägare', saljare: 'Som ägare', kontor: 'Alla' } },
  { vad: 'Skapa offert från leaden', svar: { tekniker: 'Som ägare eller delad', saljare: 'Som ägare eller delad', kontor: 'Alla' } },
  { vad: 'Boka besök som kopplar ett ärende', svar: { tekniker: 'Nej, skriver ett nästa steg', saljare: 'Nej, skriver ett nästa steg', kontor: 'Ja' } },
  { vad: 'Fördela Nya tips', svar: { tekniker: 'Nej', saljare: 'Nej', kontor: 'Ja, Ta leaden eller Överlåt' } },
  { vad: 'Sätta Besök bokat, Offert skickad eller Vunnen för hand', svar: { tekniker: 'Nej', saljare: 'Nej', kontor: 'Ja, nödutgången i ⋯-menyn' } },
  { vad: 'Fliken Statistik', svar: { tekniker: 'Nej', saljare: 'Dina leads', kontor: 'Alla leads' } },
]

const RELATIONER: { ikon: IconName; namn: string; text: string }[] = [
  { ikon: 'lead.agare', namn: 'Ägare', text: 'Driver leaden framåt och ansvarar för nästa steg. En lead har en ägare eller ingen.' },
  { ikon: 'lead.tipsare', namn: 'Tipsare', text: 'Den som skickade tipset. Ser leaden, kan skriva i tidslinjen och får notiser, men ändrar inget.' },
  { ikon: 'lead.dela', namn: 'Delad', text: 'En kollega som hjälper till. Kan ändra leaden men inte byta ägare eller dela vidare.' },
  { ikon: 'lead.lead', namn: 'Koordinator och admin', text: 'Ser och får ändra alla leads, fördelar tips och bokar besök.' },
]

const svarKlass = (t: string) => (t === 'Nej' || t.startsWith('Nej,') ? 'text-slate-500' : 'text-slate-200')

export default function LeadsRollKarta({ variant }: { variant?: string }) {
  const v = lasVariant(variant)
  const [mobilRoll, setMobilRoll] = useState<LeadsVariant>(v)

  return (
    <div className="my-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {RELATIONER.map((r) => (
          <div key={r.namn} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Icon name={r.ikon} size={16} className="text-[#20c58f]" /> {r.namn}
            </p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>

      {/* Tabell på bred skärm */}
      <div className="hidden sm:block p-4 bg-slate-800/30 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="text-left font-medium pb-2 border-b border-slate-700">Vad</th>
              {ROLLER.map((r) => (
                <th key={r.id} className={`text-left font-medium pb-2 px-2 border-b border-slate-700 ${r.id === v ? 'text-[#20c58f]' : ''}`}>
                  {r.label}
                  {r.id === v && <span className="block text-[10px] font-normal text-slate-500">din roll</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RADER.map((rad) => (
              <tr key={rad.vad} className="border-b border-slate-700/50 last:border-0 align-top">
                <td className="py-2 pr-2 text-slate-300">{rad.vad}</td>
                {ROLLER.map((r) => (
                  <td key={r.id} className={`py-2 px-2 ${svarKlass(rad.svar[r.id])} ${r.id === v ? 'bg-[#20c58f]/5' : ''}`}>
                    {rad.svar[r.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista per roll på mobil */}
      <div className="sm:hidden p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex border-b border-slate-700/50 mb-2 overflow-x-auto" role="tablist" aria-label="Roll">
          {ROLLER.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={mobilRoll === r.id} className={`${segment(mobilRoll === r.id)} whitespace-nowrap`} onClick={() => setMobilRoll(r.id)}>
              {r.id === 'kontor' ? 'Kontoret' : r.label}
            </button>
          ))}
        </div>
        <dl>
          {RADER.map((rad) => (
            <div key={rad.vad} className="py-1.5 border-b border-slate-700/40 last:border-0">
              <dt className="text-xs text-slate-400">{rad.vad}</dt>
              <dd className={`text-sm ${svarKlass(rad.svar[mobilRoll])}`}>{rad.svar[mobilRoll]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
