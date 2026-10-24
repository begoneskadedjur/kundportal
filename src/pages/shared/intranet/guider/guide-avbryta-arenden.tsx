// src/pages/shared/intranet/guider/guide-avbryta-arenden.tsx
// Guidemodul: Avbryt eller ta bort ett ärende (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls så att länkar och läsloggen fungerar.
//
// Efterbildning av EditCaseModal i nya vyn: Ärendets verktyg › Ta bort › Radera ärende
// ("Frågar en gång till innan ärendet tas bort.") och DeleteCaseConfirmDialog (Ta bort
// ärende, "Ärendet markeras som borttaget och döljs från alla vyer. All data behålls.",
// Anledning * med Välj anledning... och valen ur ORSAKER_TA_BORT, Kommentar som är
// obligatorisk vid Övrigt och annars valfri, Avbryt, Ta bort som är avstängd tills en
// anledning är vald, toasten "Ärendet har tagits bort"). caseDeleteService sätter status
// Borttaget, deleted_at och close_reason/close_reason_notes. Ingenting raderas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Ark, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { gorMk, ingenMk, type Mk, type Tryck } from './_arenden'
import { ArendeRam, NR, RutKnapp, VerktygArk } from './_nyvy_tickets'

type Vy = 'arende' | 'verktyg' | 'fraga' | 'lista' | 'vald' | 'ovrigt' | 'borta'

/** Valen ur ORSAKER_TA_BORT i caseDeleteService */
const ORSAKER = [
  { id: 'kund_accepterade_inte_pris', text: 'Kund accepterade inte kostnadsförslaget' },
  { id: 'kund_aterkopplade_aldrig', text: 'Kund återkopplade aldrig' },
  { id: 'lost_vid_inspektion', text: 'Löst vid inspektion' },
  { id: 'kund_avbokade', text: 'Kund avbokade' },
  { id: 'kund_ej_narbar', text: 'Kund ej nåbar' },
  { id: 'dublett', text: 'Dublett' },
  { id: 'ovrigt', text: 'Övrigt' },
]

function TaBortRuta({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const anledning = vy === 'vald' ? 'Kund avbokade' : vy === 'ovrigt' ? 'Övrigt' : ''
  const kravKommentar = vy === 'ovrigt'
  const kan = vy === 'vald'
  return (
    <div className="absolute inset-0 z-40">
      <Ark titel="Ta bort ärende">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-500/20 text-red-400"><Icon name="rapport.avvikelse" size={16} /></span>
          <div>
            <p className="text-[12.5px] font-medium text-white">{NR}</p>
            <p className="text-[11px] leading-snug text-slate-400">Ärendet markeras som borttaget och döljs från alla vyer. All data behålls.</p>
          </div>
        </div>
        <div className="grid gap-1">
          <span className="text-[10.5px] font-medium text-slate-400">Anledning <span className="text-red-400">*</span></span>
          <div className="relative">
            <Markor markor={mk('anledning')} block>
              <button type="button" onClick={() => tryck('anledning')}
                className={`flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-left text-[11.5px] ${anledning ? 'text-white' : 'text-slate-500'}`}>
                {anledning || 'Välj anledning...'}
                <Icon name="allman.chevron" size={16} className="h-3.5 w-3.5 rotate-90 text-slate-400" />
              </button>
            </Markor>
            {vy === 'lista' && (
              <ul className="mt-1 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-xl">
                {ORSAKER.map(o => (
                  <li key={o.id}>
                    <Markor markor={mk(`orsak-${o.id}`)} block>
                      <button type="button" onClick={() => tryck(`orsak-${o.id}`)} className="block w-full px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800">{o.text}</button>
                    </Markor>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {anledning && (
          <div className="grid gap-1">
            <span className="text-[10.5px] font-medium text-slate-400">Kommentar {kravKommentar ? <span className="text-red-400">*</span> : <span className="text-slate-500">(valfritt)</span>}</span>
            <button type="button" onClick={() => tryck('kommentar')} className="block min-h-[36px] w-full rounded-lg border border-slate-600 bg-slate-800/50 px-2 py-1.5 text-left text-[11px] text-slate-500">
              {kravKommentar ? 'Beskriv varför ärendet tas bort' : 'Till exempel vad kunden sa'}
            </button>
          </div>
        )}
        <div className="flex gap-2 border-t border-slate-700/50 pt-2">
          <RutKnapp id="avbryt" mk={mk} tryck={tryck}>Avbryt</RutKnapp>
          <RutKnapp id="ta-bort" fara inaktiv={!kan} ikon="allman.radera" mk={mk} tryck={tryck}>Ta bort</RutKnapp>
        </div>
      </Ark>
    </div>
  )
}

function Skarm({ vy, mk, tryck, markor }: { vy: Vy; mk: Mk; tryck: Tryck; markor?: NyMarkor }) {
  const ruta = vy === 'fraga' || vy === 'lista' || vy === 'vald' || vy === 'ovrigt'
  return (
    <ArendeRam
      stangt={vy === 'borta'}
      borttaget={vy === 'borta'}
      markor={markor}
      onRam={tryck}
      mk={mk}
      tryck={tryck}
      ovanpa={<>
        {vy === 'verktyg' && <VerktygArk fran="arendet" oppen="ta-bort" mk={mk} tryck={tryck} />}
        {ruta && <TaBortRuta vy={vy} mk={mk} tryck={tryck} />}
      </>}
      notis={vy === 'borta' ? <Notis text="Ärendet har tagits bort" /> : undefined}
    />
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arende', markera: 'verktyg' },
  { vy: 'verktyg', markera: 'radera' },
  { vy: 'fraga', markera: 'anledning' },
  { vy: 'lista', markera: 'orsak-kund_avbokade' },
  { vy: 'vald', markera: 'ta-bort' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const markor: NyMarkor | undefined = v.markera === 'verktyg' ? { pa: true, nr: steg + 1, mal: 'verktyg' } : undefined
  return <Skarm vy={v.vy} mk={gorMk(v.markera, steg + 1)} markor={markor} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Familjen Exempel har ringt och avbokat. Ärendet är öppet. Ta bort det med rätt anledning.' }

const TIPS: Record<string, string> = {
  nasta: 'Jag är framme är för när du står hos kunden. Besöket blir inte av.',
  tillbaka: 'Du står redan i första steget.',
  flikvy: 'Alla uppgifter är den vanliga flikvyn. Det du behöver finns under Ärendets verktyg.',
  stang: 'Krysset stänger ärendet utan att något ändras.',
  kartor: 'Kartan behövs inte nu.',
  ring: 'Kunden har redan ringt.',
  'verktyg-stang': 'Krysset stänger verktygen.',
  historik: 'Historiken visar ändringar. Det behövs inte nu.',
  status: 'Status ändrar du inte för en avbokning. Ärendet tas bort med Radera ärende.',
  'alla-uppgifter': 'Den vanliga flikvyn behövs inte.',
  'byt-namn': 'Namnet behöver inte ändras.',
  lead: 'Ett tips om en ny kund behövs inte nu.',
  avbryt: 'Avbryt stänger rutan och ärendet ligger kvar.',
  kommentar: 'Kommentaren är valfri här. Behövs den inte kan du trycka Ta bort direkt.',
}

const FRAMSTEG: Record<Vy, number> = { arende: 0, verktyg: 1, fraga: 2, lista: 3, vald: 4, ovrigt: 3, borta: 5 }

function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>('arende')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); setSvar({ typ: 'tips', titel, text }) }
  const annars = (id: string, rad: string) => miss(TIPS[id] ? `${TIPS[id]} ${rad}` : rad)

  const tryck = (id: string) => {
    switch (vy) {
      case 'arende':
        if (id === 'verktyg') ga('verktyg', 'Ärendets verktyg', `Verktygen öppnades ${enhet === 'dator' ? 'uppe till höger' : 'nerifrån'}. Radera ärende står längst ner, under Ta bort.`)
        else annars(id, 'Tryck på verktygen uppe till höger, ikonen i mitten.')
        break
      case 'verktyg':
        if (id === 'radera') ga('fraga', 'Ta bort ärende', 'Rutan frågar en gång till. Välj först en anledning.')
        else annars(id, 'Tryck Radera ärende under Ta bort.')
        break
      case 'fraga':
      case 'ovrigt':
        if (id === 'anledning') ga('lista', 'Listan är öppen', 'Välj den anledning som stämmer. Kunden har avbokat.')
        else if (id === 'ta-bort') miss(vy === 'ovrigt' ? 'Vid Övrigt måste du skriva en kommentar. Här finns en bättre anledning: tryck på Anledning och välj Kund avbokade.' : 'Knappen är avstängd tills du har valt en anledning.')
        else if (id === 'kommentar') miss('Vid Övrigt måste du skriva varför. Men kunden har avbokat, så välj Kund avbokade i stället.')
        else annars(id, 'Tryck på Anledning *.')
        break
      case 'lista':
        if (id === 'orsak-kund_avbokade') ga('vald', 'Kund avbokade', 'Nu visas Kommentar, som är valfri här. Tryck Ta bort.')
        else if (id === 'orsak-ovrigt') { setFel(f => f + 1); setVy('ovrigt'); setSvar({ typ: 'fel', titel: 'Det finns en bättre anledning', text: 'Övrigt kräver en kommentar och är för sådant som inte står i listan. Kunden har avbokat. Tryck på Anledning och välj Kund avbokade.' }) }
        else if (id.startsWith('orsak-')) miss('Den anledningen stämmer inte. Kunden ringde och avbokade.')
        else annars(id, 'Välj Kund avbokade i listan.')
        break
      case 'vald':
        if (id === 'ta-bort') {
          setVy('borta')
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Ärendet fick status Borttaget med anledningen Kund avbokade och är borta ur Mina ärenden. All data finns kvar.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else if (id === 'kommentar') setSvar({ typ: 'tips', titel: 'Kommentaren är valfri', text: 'Här kan du skriva till exempel vad kunden sa. Det behövs inte nu. Tryck Ta bort.' })
        else if (id === 'anledning') ga('lista', 'Byta anledning?', 'Kund avbokade var rätt. Välj den igen.')
        else annars(id, 'Tryck Ta bort.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={5} svar={svar} onBorjaOm={() => { setVy('arende'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm vy={vy} mk={ingenMk} tryck={vy === 'borta' ? () => {} : tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
