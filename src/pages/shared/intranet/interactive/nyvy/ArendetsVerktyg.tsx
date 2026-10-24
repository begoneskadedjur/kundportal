// src/pages/shared/intranet/interactive/nyvy/ArendetsVerktyg.tsx
// Interaktiv del i guiden Gör ett besök steg för steg: tryck på ett val i Ärendets
// verktyg och se vad det gör och när du använder det. Valen och texterna är desamma
// som i EditCaseModal (verktygGrupper) för ett privatärende.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { VERKTYG } from '../../guider/_nyvy_arendet'

/** När teknikern använder valet, i guidens ord */
const NAR: Record<string, string> = {
  'ladda-ned': 'När du vill se eller spara PDF:en själv. Samma som Ladda ned i steget Rapport.',
  'skicka-tekniker': 'När du vill ha rapporten i din egen e-post.',
  'skicka-kontakt': 'När kunden ska få rapporten. Samma som knappen Skicka till och kundens namn i steget Rapport. Saknas e-post lägger du till den i steget Framme.',
  specialrapport: 'Tar dig till steget Rapport, där Specialrapporter har ett plustecken för en ny rapport.',
  avtal: 'Kunden vill ha ett löpande avtal. Kunduppgifterna följer med till Oneflow.',
  offert: 'Kunden vill ha ett pris innan du gör mer. Tjänsterna i ärendet följer med till Oneflow.',
  'boka-aterbesok': 'Du ska tillbaka i samma ärende. Samma dialog som Bara besöket i steget Klart.',
  'nytt-arende': 'Kunden har ett annat skadedjur. Det blir ett eget ärende med samma kund och adress.',
  duplicera: 'Du vill ha en kopia av ärendet och välja vad som följer med.',
  kommunikation: 'Du vill fråga kontoret eller en kollega om just det här ärendet.',
  kartor: 'Du behöver vägbeskrivningen. Samma som Öppna i kartor i steget Framme.',
  ring: 'Du behöver ringa kunden, till exempel om portkoden.',
  'byt-namn': 'Ärendet saknar namn eller har fel namn. Rapporten kan inte tas fram utan namn.',
  historik: 'Du vill se vem som har ändrat vad och när.',
  lead: 'Kunden kan vara intresserad av ett avtal eller mer arbete. Tar dig till steget Klart, där knappen finns.',
  'alla-uppgifter': 'Du behöver något som inte finns i stegen, till exempel Starttid och Sluttid eller teknikerna på ärendet.',
  status: 'Du behöver byta status för hand. Statusstegen finns överst i Alla uppgifter.',
  radera: 'Ärendet är skapat av misstag. Portalen frågar en gång till.',
}

export default function ArendetsVerktyg() {
  const [vald, setVald] = useState<string>('alla-uppgifter')
  const val = VERKTYG.flatMap(g => g.val).find(v => v.id === vald)
  return (
    <div className="my-5 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Prova Ärendets verktyg</p>
        <p className="text-sm text-slate-400">Tryck på ett val och läs när du använder det.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2">
          {VERKTYG.map(g => (
            <div key={g.rubrik} className="pb-1.5">
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.rubrik}</p>
              {g.val.map(v => (
                <button key={v.id} type="button" onClick={() => setVald(v.id)} aria-pressed={vald === v.id}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm ${vald === v.id ? 'bg-[#20c58f]/15 text-white' : v.fara ? 'text-red-400 hover:bg-slate-800' : 'text-slate-200 hover:bg-slate-800'}`}>
                  <Icon name={v.ikon} size={20} className={vald === v.id ? 'text-[#20c58f]' : v.fara ? 'text-red-400' : 'text-slate-400'} />
                  {v.text}
                </button>
              ))}
            </div>
          ))}
        </div>
        {val && (
          <div className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3" aria-live="polite">
            <p className="flex items-center gap-2 text-base font-semibold text-white"><Icon name={val.ikon} size={24} className="text-[#20c58f]" />{val.text}</p>
            <p className="text-sm text-slate-400">I portalen står det: {val.beskrivning}</p>
            <p className="text-sm leading-relaxed text-slate-200"><span className="font-semibold text-white">När: </span>{NAR[val.id]}</p>
          </div>
        )}
      </div>
    </div>
  )
}
