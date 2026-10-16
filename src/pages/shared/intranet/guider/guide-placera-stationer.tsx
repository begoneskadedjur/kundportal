// src/pages/shared/intranet/guider/guide-placera-stationer.tsx
// Guidemodul: Placera en station eller fälla (tekniker, telefon).
// Etiketterna följer EditContractCaseModal (Gå till utplacering), AddStationWizard
// (Välj typ, Var ska stationen placeras?, Utomhus, Inomhus), EquipmentPlacementForm
// (Ny utrustningsplacering, Utrustningstyp, Hämta GPS, Välj på karta, Skapa placering,
// GPS-position krävs) och TechnicianEquipment (Station placerad!, Placera fler utomhus,
// Placera inomhus, Färdig med etablering, Återkommande kontroller). Påhittad kund.

import { useState } from 'react'
import {
  Ark, ArendeHuvud, Falt, Flikar, Knapprad, Kort, Markor, OvningRam, PKnapp, Rad, Status, Telefon,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { ArkHuvud, Dubbelknapp, LokalIkon, StortVal, TYPER, TypRuta, type TypNyckel } from './_stationer'

type Vy = 'arende' | 'typ' | 'form' | 'klar' | 'schema'

interface Lage {
  vy: Vy
  typ: TypNyckel
  gps: boolean
  foto: boolean
  fel: string | null
}

const RUTOR: TypNyckel[] = ['betes', 'betong', 'mekanisk', 'plat', 'ljus', 'krypande']
const KUND = 'Exempel AB · Exempelgatan 12, Gävle'

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  if (l.vy === 'arende') {
    return (
      <Telefon>
        <ArendeHuvud nr="BE-0004512" status={<Status text="Bokad" />} kund={KUND} />
        <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
        <Kort titel="Ärendeinformation" ikon="arende.arende">
          <Rad v="Etablering Avtalskund" />
          <Rad v="Sätt ut 4 betongstationer runt fastigheten enligt avtalet." />
        </Kort>
        <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Torsdag 2026-10-22, 08:00 till 10:00" /></Kort>
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 border-t border-slate-700 bg-slate-900 px-3 py-2.5">
          <PKnapp onClick={() => tryck('stang')}>Stäng</PKnapp>
          <PKnapp prim onClick={() => tryck('utplacering')} markor={mk(markera, 'utplacering', nr)}>
            <LokalIkon namn="nal" storlek={16} />Gå till utplacering
          </PKnapp>
        </div>
      </Telefon>
    )
  }

  if (l.vy === 'typ') {
    return (
      <Telefon>
        <ArkHuvud titel="Välj typ" onStang={() => tryck('stang')} />
        <div className="grid gap-2.5 p-3.5">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
            <p className="text-[11px] text-slate-400">Vald kund</p>
            <p className="text-[13px] font-medium text-white">Exempel AB</p>
          </div>
          <p className="text-xs text-slate-400">Var ska stationen placeras?</p>
          <StortVal titel="Utomhus" text="Placera på karta med GPS-position" ikon={<LokalIkon namn="nal" />} onClick={() => tryck('utomhus')} markor={mk(markera, 'utomhus', nr)} />
          <StortVal titel="Inomhus" text="Placera på planritning" ikon={<LokalIkon namn="hus" />} onClick={() => tryck('inomhus')} />
        </div>
      </Telefon>
    )
  }

  if (l.vy === 'klar' || l.vy === 'schema') {
    return (
      <Telefon>
        <div className="grid justify-items-center gap-1 p-6 pt-16 text-center">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <p className="text-base font-semibold text-white">Station placerad!</p>
          <p className="text-xs text-slate-400">Exempel AB</p>
          <p className="mb-4 text-[11px] text-slate-500">1 station placerade denna session</p>
          <div className="grid w-full gap-2">
            <PKnapp prim onClick={() => tryck('fler')}>Placera fler utomhus</PKnapp>
            <PKnapp onClick={() => tryck('inne')}>Placera inomhus</PKnapp>
            <PKnapp onClick={() => tryck('fardig')} markor={mk(markera, 'fardig', nr)}>Färdig med etablering</PKnapp>
          </div>
        </div>
        {l.vy === 'schema' && (
          <Ark titel="Återkommande kontroller">
            <p className="text-xs text-slate-400">Vill du schemalägga återkommande kontroller för Exempel AB? Du kan även göra detta senare under kundens schema-flik.</p>
            <Knapprad>
              <PKnapp onClick={() => tryck('senare')}>Senare</PKnapp>
              <PKnapp prim onClick={() => tryck('ja-schema')}>Ja, schemalägg</PKnapp>
            </Knapprad>
          </Ark>
        )}
      </Telefon>
    )
  }

  // Formuläret
  return (
    <Telefon>
      <ArkHuvud titel="Ny utrustningsplacering" onStang={() => tryck('kryss')} />
      <div className="grid gap-2 px-3 py-2">
        <p className="text-[11.5px] font-medium text-slate-400">Utrustningstyp *</p>
        <div className="grid grid-cols-3 gap-1.5">
          {RUTOR.map(k => (
            <TypRuta key={k} typ={TYPER[k]} vald={l.typ === k} onClick={() => tryck(`typ-${k}`)} markor={mk(markera, `typ-${k}`, nr)} />
          ))}
        </div>
        <Falt etikett={`Serienummer${l.typ === 'mekanisk' ? ' *' : ''}`} varde={l.typ === 'mekanisk' ? 'Ange serienummer' : 'Valfritt serienummer'} tom onClick={() => tryck('serienummer')} />
        <p className="text-[11.5px] font-medium text-slate-400">GPS-position *</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Dubbelknapp titel={l.gps ? 'GPS hämtad' : 'Hämta GPS'} klar={l.gps} ikon={<LokalIkon namn="gps" />} onClick={() => tryck('gps')} markor={mk(markera, 'gps', nr)} />
          <Dubbelknapp titel="Välj på karta" ikon={<LokalIkon namn="karta" />} onClick={() => tryck('karta')} />
        </div>
        {l.gps && <Rad v="Noggrannhet" h={<span className="text-green-400">4 m (Utmärkt)</span>} />}
        {l.fel && <p className="text-[11.5px] text-red-400">{l.fel}</p>}
        <Markor markor={mk(markera, 'foto', nr)} block>
          <button type="button" onClick={() => tryck('foto')}
            className={`flex w-full items-center gap-2 rounded-xl border-2 border-dashed p-2 text-[11.5px] ${l.foto ? 'border-[#20c58f] text-[#20c58f]' : 'border-slate-700 text-slate-400'}`}>
            <LokalIkon namn="kamera" storlek={18} />
            {l.foto ? 'Foto valt: soptunnorna och stationen' : 'Klicka för att ta foto eller välja från galleri'}
          </button>
        </Markor>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-1.5 border-t border-slate-700 bg-slate-900 px-3 py-2.5">
        <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
        <PKnapp prim onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa placering</PKnapp>
      </div>
    </Telefon>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'arende', typ: 'betes', gps: false, foto: false, fel: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'utplacering' },
  { lage: { ...BAS, vy: 'typ' }, markera: 'utomhus' },
  { lage: { ...BAS, vy: 'form' }, markera: 'typ-betong' },
  { lage: { ...BAS, vy: 'form', typ: 'betong' }, markera: 'gps' },
  { lage: { ...BAS, vy: 'form', typ: 'betong', gps: true }, markera: 'foto' },
  { lage: { ...BAS, vy: 'form', typ: 'betong', gps: true, foto: true }, markera: 'skapa' },
  { lage: { ...BAS, vy: 'klar', typ: 'betong', gps: true, foto: true }, markera: 'fardig' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i etableringsärendet hos Exempel AB. Leta upp knappen som tar dig till utplaceringen.' }

const TIPS: Record<string, string> = {
  flik: 'Flikarna byter vy i ärendet. Stationerna sätter du ut via knappen längst ner.',
  stang: 'Stäng tar dig bort från ärendet. Du ska till utplaceringen.',
  inomhus: 'Inomhus är för planritningen. Soptunnorna står ute, så välj Utomhus.',
  kryss: 'Krysset avslutar utplaceringen. Sätt ut stationen först.',
  avbryt: 'Avbryt avslutar utplaceringen. Sätt ut stationen först.',
  serienummer: 'Serienummer behövs bara för mekaniska fällor. En betongstation klarar sig utan.',
  karta: 'Det går också, men du står vid soptunnorna. Då är Hämta GPS snabbast.',
  fler: 'Uppdraget var en station. Avsluta etableringen i stället.',
  inne: 'Uppdraget var en station ute. Avsluta etableringen i stället.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'schema') return
    if (l.vy === 'arende') {
      if (id === 'utplacering') { setL({ ...l, vy: 'typ' }); tips('Bra', 'Kunden är redan vald. Var står soptunnorna?') }
      else miss(TIPS[id] ?? 'Knappen finns längst ner i ärendet.')
    } else if (l.vy === 'typ') {
      if (id === 'utomhus') { setL({ ...l, vy: 'form' }); tips('Rätt', 'Välj vilken sorts station du sätter ut.') }
      else miss(TIPS[id] ?? 'Välj Utomhus.')
    } else if (l.vy === 'form') {
      if (id.startsWith('typ-')) {
        const k = id.slice(4) as TypNyckel
        setL({ ...l, typ: k, fel: null })
        if (k === 'betong') tips('Betongstation vald', 'Stå vid stationen och hämta positionen.')
        else miss(`Du valde ${TYPER[k].namn}. Uppdraget var en betongstation.`)
      } else if (id === 'gps') { setL({ ...l, gps: true, fel: null }); tips('GPS hämtad', 'Noggrannheten är utmärkt. Ta gärna ett foto så hittar nästa tekniker rätt.') }
      else if (id === 'foto') { setL({ ...l, foto: true }); tips('Foto valt', 'Bilden visar stationen och soptunnorna. Spara placeringen.') }
      else if (id === 'skapa') {
        if (l.typ !== 'betong') miss('Kolla typen först. Uppdraget var en betongstation.')
        else if (!l.gps) { setL({ ...l, fel: 'GPS-position krävs. Klicka på "Hämta GPS-position"' }); miss('Portalen sparar inte utan position. Tryck Hämta GPS först.') }
        else if (!l.foto) miss('Uppdraget var att ta med ett foto. Tryck på fotorutan först.')
        else { setL({ ...l, vy: 'klar' }); tips('Station placerad', 'Nu kan du sätta ut fler, eller avsluta etableringen.') }
      } else miss(TIPS[id] ?? 'Välj typ, hämta GPS, ta foto och tryck Skapa placering.')
    } else if (l.vy === 'klar') {
      if (id === 'fardig') {
        setL({ ...l, vy: 'schema' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Betongstationen är sparad med position och foto, och etableringsärendet är stängt. Kunden har inget återkommande schema än, därför frågar portalen om kontrollerna.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else miss(TIPS[id] ?? 'Tryck Färdig med etablering.')
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'typ' ? 1 : l.vy === 'form' ? 2 + (l.typ === 'betong' ? 1 : 0) + (l.gps ? 1 : 0) + (l.foto ? 1 : 0) : l.vy === 'klar' ? 6 : 7
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
