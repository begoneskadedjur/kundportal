// src/pages/shared/intranet/guider/guide-kontrollrapport.tsx
// Guidemodul: Mejla kontrollrapporten till kunden (tekniker, telefon).
// Etiketterna följer StationInspectionModule (Stationskontroll, Klarmarkera ärende,
// Klarmarkera ärende?, Alla stationer är inspekterade., Ja, klarmarkera, Inspektion
// avslutad!) och InspectionReportSection i EditContractCaseModal, fliken Utförande
// (Kontrollrapport, Kontrollrunda avslutad, PDF, Excel, Skicka till kund, Mottagare,
// Skicka, Bekräfta och skicka, Kontrollrapporten skickad till). Påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import {
  Ark, ArendeHuvud, Falt, Flikar, Knapprad, Kort, Markor, Notis, OvningRam, PKnapp, Rad, Status, Telefon,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { Karta, TYPER } from './_stationer'

type Vy = 'runda' | 'fraga' | 'arende' | 'utforande' | 'skicka' | 'bekrafta' | 'klart'

interface Lage {
  vy: Vy
  mottagare: string
}

const KUND_EPOST = 'info@exempelgarden.se'
const FORVALTARE = 'forvaltning@exempelgarden.se'

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

const PUNKTER = [
  { x: 20, y: 25, typ: TYPER.betong }, { x: 30, y: 78, typ: TYPER.betong }, { x: 62, y: 55, typ: TYPER.betong },
  { x: 86, y: 30, typ: TYPER.betong }, { x: 74, y: 86, typ: TYPER.mekanisk }, { x: 46, y: 20, typ: TYPER.mekanisk },
]

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  if (l.vy === 'runda' || l.vy === 'fraga') {
    return (
      <Telefon>
        <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2.5">
          <button type="button" onClick={() => tryck('tillbaka')} aria-label="Tillbaka" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400">
            <Icon name="rapport.tillbaka" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-white">Stationskontroll</p>
            <p className="truncate text-[11px] text-slate-400">Brf Exempelgården</p>
          </div>
          <Markor markor={mk(markera, 'klarmarkera', nr)}>
            <button type="button" onClick={() => tryck('klarmarkera')} aria-label="Klarmarkera ärende" title="Klarmarkera ärende"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20c58f] text-[#04140d]">
              <Icon name="station.klar" size={20} />
            </button>
          </Markor>
        </div>
        <div className="grid gap-2 p-3">
          <Rad v="Utomhus" h={<span className="text-green-400">6/6</span>} />
          <Karta punkter={PUNKTER} hojd={190} onClick={() => tryck('karta')} />
          <p className="text-[11.5px] text-[#20c58f]">Alla utomhusstationer är kontrollerade.</p>
        </div>
        {l.vy === 'fraga' && (
          <Ark titel="Klarmarkera ärende?">
            <p className="text-xs text-slate-300">Alla stationer är inspekterade.</p>
            <div className="grid gap-1 rounded-lg bg-slate-800/60 p-2.5">
              <Rad v="Utomhus:" h={<span className="text-green-400">6/6</span>} />
              <Rad v="Inomhus:" h={<span className="text-green-400">0/0</span>} />
            </div>
            <Knapprad>
              <PKnapp onClick={() => tryck('avbryt-klar')}>Avbryt</PKnapp>
              <PKnapp prim onClick={() => tryck('ja-klar')} markor={mk(markera, 'ja-klar', nr)}>Ja, klarmarkera</PKnapp>
            </Knapprad>
          </Ark>
        )}
      </Telefon>
    )
  }

  const utforande = l.vy !== 'arende'
  return (
    <Telefon>
      <ArendeHuvud nr="BE-0004630" status={<Status text="Avslutat" farg="bg-[#20c58f]" />} kund="Brf Exempelgården · Exempelvägen 8, Uppsala" />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={utforande ? 1 : 0}
        onClick={i => tryck(i === 1 ? 'flik-utforande' : 'flik-annan')}
        markor={markera === 'flik-utforande' ? { flik: 1, pa: true, nr } : undefined} />
      {!utforande ? (
        <>
          <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Stationskontroll Avtalskund, oktober" /></Kort>
          <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Fredag 2026-10-16, 08:00 till 09:00" /></Kort>
        </>
      ) : (
        <>
          <Kort titel="Arbetsrapport" ikon="rapport.text"><Rad v="Kontrollerat 6/6 stationer." /></Kort>
          <Kort titel="Kontrollrapport" ikon="rapport.inspektion">
            <p className="flex items-center gap-1.5 text-[11.5px] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />
              Kontrollrunda avslutad 2026-10-16 <span className="text-slate-500">· Anna Exempel</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <PKnapp ikon="allman.ladda-ner" onClick={() => tryck('pdf')}>PDF</PKnapp>
              <PKnapp onClick={() => tryck('excel')}>Excel</PKnapp>
              <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka-till-kund')} markor={mk(markera, 'skicka-till-kund', nr)}>Skicka till kund</PKnapp>
            </div>
            {l.vy !== 'utforande' && (
              <div className="mt-1 grid gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/30 p-2">
                <Falt etikett="Mottagare" varde={l.mottagare} onClick={() => tryck('mottagare')} />
                {l.vy === 'skicka' && (
                  <Knapprad><PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka')} markor={mk(markera, 'skicka', nr)}>Skicka</PKnapp></Knapprad>
                )}
                {l.vy === 'bekrafta' && (
                  <>
                    <p className="text-[11.5px] text-slate-300">Skicka kontrollrapporten som PDF till <span className="font-medium text-white">{l.mottagare}</span>?</p>
                    <Knapprad>
                      <PKnapp onClick={() => tryck('avbryt-skick')}>Avbryt</PKnapp>
                      <PKnapp prim onClick={() => tryck('bekrafta')} markor={mk(markera, 'bekrafta', nr)}>Bekräfta och skicka</PKnapp>
                    </Knapprad>
                  </>
                )}
                <p className="text-[10.5px] text-slate-500">Rapporten skickas från noreply@begone.se med svar till info@begone.se. Bilagor över 8 MB skickas inte.</p>
              </div>
            )}
          </Kort>
        </>
      )}
      {l.vy === 'klart' && <Notis text={`Kontrollrapporten skickad till ${l.mottagare}`} />}
    </Telefon>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'runda', mottagare: KUND_EPOST }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'klarmarkera' },
  { lage: { ...BAS, vy: 'fraga' }, markera: 'ja-klar' },
  { lage: { ...BAS, vy: 'arende' }, markera: 'flik-utforande' },
  { lage: { ...BAS, vy: 'utforande' }, markera: 'skicka-till-kund' },
  { lage: { ...BAS, vy: 'skicka' }, markera: 'skicka' },
  { lage: { ...BAS, vy: 'bekrafta' }, markera: 'bekrafta' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Alla stationer är kontrollerade. Rapporten finns först när rundan är klarmarkerad. Leta upp knappen för det.' }

const TIPS: Record<string, string> = {
  tillbaka: 'Pilen tar dig ut ur rundan utan att klarmarkera. Då finns ingen rapport att skicka.',
  karta: 'Kartan visar stationerna. Alla är redan kontrollerade.',
  'avbryt-klar': 'Avbryt lämnar rundan öppen. Då syns ingen kontrollrapport i ärendet.',
  'flik-annan': 'Kontrollrapporten ligger under fliken Utförande.',
  pdf: 'PDF laddar ned rapporten till telefonen. Uppdraget var att mejla den.',
  excel: 'Excel laddar ned en tabell. Uppdraget var att mejla rapporten.',
  'avbryt-skick': 'Avbryt skickar inget. Tryck Bekräfta och skicka.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (id === 'mottagare' && (l.vy === 'skicka' || l.vy === 'bekrafta')) {
      setL({ ...l, vy: 'skicka', mottagare: FORVALTARE })
      tips('Adressen ändrad', `Mottagare är nu ${FORVALTARE}. Tryck Skicka.`)
      return
    }
    switch (l.vy) {
      case 'runda':
        if (id === 'klarmarkera') { setL({ ...l, vy: 'fraga' }); tips('Bra', 'Portalen visar att alla stationer är kontrollerade. Bekräfta.') }
        else miss(TIPS[id] ?? 'Bocken uppe till höger klarmarkerar rundan.')
        break
      case 'fraga':
        if (id === 'ja-klar') { setL({ ...l, vy: 'arende' }); tips('Rundan är avslutad', 'Du är tillbaka i avtalsärendet. Var ligger rapporten?') }
        else miss(TIPS[id] ?? 'Tryck Ja, klarmarkera.')
        break
      case 'arende':
        if (id === 'flik-utforande') { setL({ ...l, vy: 'utforande' }); tips('Där är den', 'Rutan Kontrollrapport syns nu när rundan är avslutad.') }
        else miss(TIPS[id] ?? 'Tryck på fliken Utförande.')
        break
      case 'utforande':
        if (id === 'skicka-till-kund') { setL({ ...l, vy: 'skicka' }); tips('Mottagaren är förifylld', 'Det är kundens adress. Uppdraget var förvaltaren. Vad behöver du ändra?') }
        else miss(TIPS[id] ?? 'Tryck Skicka till kund.')
        break
      case 'skicka':
        if (id === 'skicka') {
          if (l.mottagare !== FORVALTARE) miss('Rapporten skulle till förvaltaren. Tryck i fältet Mottagare och ändra adressen först.')
          else { setL({ ...l, vy: 'bekrafta' }); tips('Nästan klart', 'Kontrollera adressen en gång till och bekräfta.') }
        } else miss(TIPS[id] ?? 'Ändra mottagaren och tryck Skicka.')
        break
      case 'bekrafta':
        if (id === 'bekrafta') {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Rundan är klarmarkerad och kontrollrapporten gick som PDF till ${FORVALTARE}. Svarar förvaltaren hamnar svaret hos info@begone.se.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        } else miss(TIPS[id] ?? 'Tryck Bekräfta och skicka.')
        break
    }
  }

  const ordning: Vy[] = ['runda', 'fraga', 'arende', 'utforande', 'skicka', 'bekrafta', 'klart']
  const framsteg = ordning.indexOf(l.vy)
  return (
    <OvningRam framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
