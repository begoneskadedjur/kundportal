// src/pages/shared/intranet/guider/guide-leads-saljare.tsx
// Guidemodul: Arbeta med dina leads (säljare, dator). Efter sidan Leads och tips från 2026-10-24.
// Leads (B2B) öppnas på fliken Att göra med grupperna Försenade och I dag (leadLogik).
// I leaden: rutan Nästa steg (LeadNastaSteg) med Klar, välj nästa och Ändra. Klar-läget har
// rubriken "Klart. Vad blev gjort och vad händer sedan?", valen Anteckning, Samtal, Mejl och Möte
// (Samtal förvalt), rutan Vad hände?, valen Nytt nästa steg, Parkera och Förlorad, fälten
// Nästa steg * och Datum och tid * (förslag nästa vardag 09:00) och knapparna Avbryt och Spara.
// Saknas texten står felet "Skriv nästa steg och välj datum" i rött i rutan. Ett samtal på en lead som är Ny
// gör den Kontaktad (trigger i databasen). Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Dator, DatorSida, OvningRam, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { LeadStage } from '../../../../types/leads'
import type { GuideModul } from './registry'
import { Atgard, LeadBehov, LeadFalt, LeadFonster, LeadHuvud, LeadsLista, Sektion, Segment, ingenMk, mkFor, type ListRad, type Mk } from './_leads'

const MENY = ['Översikt', 'Leads (B2B)', 'Leads (Webb)', 'Befintliga kunder', 'Försäljningspipeline', 'Kundresa']
const NASTA = 'Ring och presentera oss'
const VAD = 'Vill ha en offert på råttsäkring av lagret.'
const NYTT = 'Skicka offert'
const VAD_GALLER = 'Råttor i lagret. Vill ha fast avtal med kontroller.'

const RAD_A: ListRad = { id: 'a', foretag: 'Exempel AB', under: 'Telefon', stage: 'ny', nasta: NASTA, nar: '2026-10-25 · 1 dag sen', sen: true, agare: 'Sara' }
const RAD_B: ListRad = { id: 'b', foretag: 'Brf Exempelgården', under: 'Rekommendation', stage: 'kontaktad', nasta: 'Skicka offert', nar: 'I dag 14:00', agare: 'Sara' }

type Vy = 'lista' | 'lead' | 'klar' | 'klart'
type Gjort = 'Anteckning' | 'Samtal' | 'Mejl' | 'Möte'
type Sedan = 'Nytt nästa steg' | 'Parkera' | 'Förlorad'

interface Lage {
  vy: Vy
  gjort: Gjort
  vad: boolean
  sedan: Sedan
  nytt: boolean
  fel?: string
}

function Skarm({ l, tryck, mk }: { l: Lage; tryck: (id: string) => void; mk: Mk }) {
  const klart = l.vy === 'klart'
  const stage: LeadStage = klart ? 'kontaktad' : 'ny'
  return (
    <Dator adress="saljare › leads">
      <div className="min-h-[560px]">
      <DatorSida meny={MENY} aktiv="Leads (B2B)" titel="Leads (B2B)">
        <LeadsLista
          flik="att-gora"
          antal={{ 'att-gora': klart ? 1 : 2 }}
          sektioner={klart ? [{ grupp: 'idag', rader: [RAD_B] }] : [{ grupp: 'forsenade', rader: [RAD_A] }, { grupp: 'idag', rader: [RAD_B] }]}
          tryck={tryck}
          mk={mk}
          beskrivning="Företag och föreningar som kan bli avtalskunder."
          lage={klart ? ['1 att göra', ', 2 öppna'] : ['2 att göra, varav 1 försenad', ', 2 öppna', 'text-red-400']}
        />
      </DatorSida>
      </div>

      {l.vy !== 'lista' && (
        <LeadFonster titel="Exempel AB" under="Telefon" onStang={() => tryck('stang')}>
          <LeadHuvud stage={stage} agare="Sara Exempel" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">Steg</span>
            <Segment val={['Ny', 'Kontaktad']} aktiv={klart ? 'Kontaktad' : 'Ny'} prefix="steg" tryck={tryck} mk={mk} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Atgard id="logga" ikon="kontakt.telefon" text="Logga samtal" tryck={tryck} mk={mk} />
            <Atgard id="besok" ikon="allman.kalender" text="Boka besök" tryck={tryck} mk={mk} />
            <Atgard id="offert" ikon="dok.offert" text="Skapa offert" tryck={tryck} mk={mk} />
            <Atgard id="dela" ikon="lead.dela" text="Överlåt eller dela" tryck={tryck} mk={mk} />
            <Atgard id="parkera" ikon="lead.parkerad" text="Parkera" tryck={tryck} mk={mk} />
            <Atgard id="forlorad" ikon="lead.forlorad" text="Förlorad" tryck={tryck} mk={mk} />
          </div>

          {l.vy === 'klar' ? (
            <Sektion titel="Klart. Vad blev gjort och vad händer sedan?" ikon="lead.nasta-steg" ram="border-[#20c58f]/50">
              <Segment val={['Anteckning', 'Samtal', 'Mejl', 'Möte']} aktiv={l.gjort} prefix="gjort" tryck={tryck} mk={mk} />
              <LeadFalt id="vad" etikett="Vad hände?" varde={l.vad ? VAD : `Vad hände? Lämnas tomt loggas "Klart: ${NASTA}"`} tom={!l.vad} tryck={tryck} mk={mk} hog />
              <Segment val={['Nytt nästa steg', 'Parkera', 'Förlorad']} aktiv={l.sedan} prefix="sedan" tryck={tryck} mk={mk} />
              <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                <LeadFalt id="nasta" etikett="Nästa steg *" varde={l.nytt ? NYTT : 'Till exempel Ring och följ upp offerten'} tom={!l.nytt} tryck={tryck} mk={mk} />
                <LeadFalt id="datum" etikett="Datum och tid *" varde="2026-10-27 09:00" tryck={tryck} mk={mk} />
              </div>
              {l.fel && <p className="text-[10.5px] text-red-400">{l.fel}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-700/50 pt-2">
                <button type="button" onClick={() => tryck('avbryt')} className="px-2.5 py-1 text-[12px] text-slate-300">Avbryt</button>
                <Atgard id="spara" text="Spara" prim tryck={tryck} mk={mk} />
              </div>
            </Sektion>
          ) : (
            <Sektion ram={klart ? 'border-slate-700' : 'border-red-500/50 bg-red-500/10'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-[12px]">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Icon name="lead.nasta-steg" size={16} className={`h-3.5 w-3.5 ${klart ? 'text-[#20c58f]' : 'text-red-400'}`} /> Nästa steg
                  </p>
                  <p className="text-white">
                    {klart ? NYTT : NASTA}
                    <span className={`ml-2 font-mono text-[10.5px] ${klart ? 'text-slate-400' : 'text-red-400'}`}>{klart ? '2026-10-27 09:00' : '2026-10-25 · 1 dag sen (försenat)'}</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Atgard id="klar" ikon="allman.bock" text="Klar, välj nästa" prim tryck={tryck} mk={mk} />
                  <Atgard id="andra" ikon="rapport.penna" text="Ändra" tryck={tryck} mk={mk} />
                </div>
              </div>
            </Sektion>
          )}

          <LeadBehov text={VAD_GALLER} />

          <Sektion titel="Kontakt" ikon="kontakt.telefon">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
              <span className="text-slate-400">Kontaktperson<span className="block text-white">Anna Exempel</span></span>
              <span className="text-slate-400">Telefon
                <span className="block">
                  <button type="button" onClick={() => tryck('ring')} className="font-mono text-[#20c58f] hover:underline">08-123 456 78</button>
                </span>
              </span>
            </div>
          </Sektion>
          {klart && (
            <Sektion titel="Aktivitet" ikon="allman.anteckning">
              <p className="text-[11.5px] text-slate-300"><span className="font-medium text-white">Samtal</span> · {VAD}</p>
            </Sektion>
          )}
        </LeadFonster>
      )}
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'lista', gjort: 'Samtal', vad: false, sedan: 'Nytt nästa steg', nytt: false }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'rad:a' },
  { lage: { ...BAS, vy: 'lead' }, markera: 'klar' },
  { lage: { ...BAS, vy: 'klar' }, markera: 'gjort:Samtal' },
  { lage: { ...BAS, vy: 'klar' }, markera: 'vad' },
  { lage: { ...BAS, vy: 'klar', vad: true }, markera: 'nasta' },
  { lage: { ...BAS, vy: 'klar', vad: true, nytt: true }, markera: 'spara' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du har just ringt Exempel AB. Öppna leaden.' }

const TIPS: Record<string, string> = {
  'rad:b': 'Brf Exempelgården är dagens. Du ringde Exempel AB, som ligger under Försenade.',
  ny: 'Ny lead skapar en ny. Exempel AB finns redan i listan.',
  stang: 'Du stängde leaden. Öppna Exempel AB igen.',
  logga: 'Logga samtal sparar samtalet, men nästa steg står kvar som försenat. Klar, välj nästa gör båda på en gång.',
  andra: 'Ändra flyttar nästa steg utan att logga samtalet. Tryck Klar, välj nästa.',
  besok: 'Kunden vill ha en offert, inte ett besök. Tryck Klar, välj nästa.',
  offert: 'Offerten kommer sedan. Logga först samtalet och sätt nästa steg med Klar, välj nästa.',
  dela: 'Leaden är din och ska stanna hos dig. Tryck Klar, välj nästa.',
  parkera: 'Kunden vill ha en offert nu, leaden ska inte vila. Tryck Klar, välj nästa.',
  forlorad: 'Kunden vill ha en offert, affären lever. Tryck Klar, välj nästa.',
  'steg:Kontaktad': 'Det sker av sig själv när du loggar samtalet. Tryck Klar, välj nästa.',
  'steg:Ny': 'Leaden är redan Ny. Tryck Klar, välj nästa.',
  ring: 'Du har redan ringt. Tryck Klar, välj nästa.',
  datum: 'Tisdag 2026-10-27 09:00 är förvalt. Det passar.',
  'sedan:Parkera': 'Kunden vill ha en offert nu. Välj Nytt nästa steg.',
  'sedan:Förlorad': 'Affären lever. Välj Nytt nästa steg.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    const utanFel = { ...l, fel: undefined }
    if (l.vy === 'lista') {
      if (id === 'rad:a') { setL({ ...utanFel, vy: 'lead' }); tips('Leaden är öppen', 'Nästa steg är rött, det är försenat. Du har ringt. Vad trycker du på?') }
      else miss(TIPS[id] ?? 'Öppna Exempel AB under Försenade.')
    } else if (id === 'stang') { setL(BAS); miss(TIPS.stang) }
    else if (l.vy === 'lead') {
      if (id === 'klar') { setL({ ...utanFel, vy: 'klar' }); tips('Klart-läget', 'Samtal är redan valt. Skriv vad som hände.') }
      else miss(TIPS[id] ?? 'Tryck Klar, välj nästa i rutan Nästa steg.')
    } else if (id === 'avbryt') { setL({ ...utanFel, vy: 'lead', vad: false, nytt: false }); miss('Avbryt stänger utan att spara. Tryck Klar, välj nästa igen.') }
    else if (id.startsWith('gjort:')) {
      const g = id.slice(6) as Gjort
      setL({ ...utanFel, gjort: g })
      if (g === 'Samtal') tips('Samtal', 'Rätt, du ringde.')
      else miss(g === 'Anteckning' ? 'Du ringde. En anteckning räknas inte som kontakt i statistiken. Välj Samtal.' : `Du ringde, du skickade inget ${g === 'Mejl' ? 'mejl' : 'möte'}. Välj Samtal.`)
    } else if (id === 'vad') { setL({ ...utanFel, vad: true }); tips('Det som hände', 'Skriv nu vad nästa steg är.') }
    else if (id.startsWith('sedan:')) {
      const s = id.slice(6) as Sedan
      setL({ ...utanFel, sedan: s })
      if (s === 'Nytt nästa steg') tips('Nytt nästa steg', 'Skriv vad som ska göras.')
      else miss(TIPS[id])
    } else if (id === 'nasta') {
      if (l.sedan !== 'Nytt nästa steg') miss('Välj Nytt nästa steg först.')
      else { setL({ ...utanFel, nytt: true }); tips('Nästa steg är skrivet', 'Datum och tid är förvalt till nästa vardag 09:00. Spara.') }
    } else if (id === 'spara') {
      if (l.gjort !== 'Samtal') miss('Du ringde kunden. Välj Samtal innan du sparar.')
      else if (l.sedan !== 'Nytt nästa steg') miss('Kunden vill ha en offert. Välj Nytt nästa steg.')
      else if (!l.nytt) { setL({ ...l, fel: 'Skriv nästa steg och välj datum' }); miss('Det står Skriv nästa steg och välj datum med röd text i rutan. Fältet Nästa steg är tomt.') }
      else {
        setL({ ...utanFel, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Samtalet ligger under Aktivitet och Exempel AB blev Kontaktad av sig själv. Nästa steg är Skicka offert tisdag 2026-10-27 09:00, så leaden försvann ur Att göra.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Skriv vad som hände och vad nästa steg är, och spara.')
  }

  const framsteg = l.vy === 'lista' ? 0 : l.vy === 'lead' ? 1 : l.vy === 'klart' ? 5 : 2 + Number(l.vad) + Number(l.nytt)
  return (
    <OvningRam bred framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} mk={ingenMk} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
