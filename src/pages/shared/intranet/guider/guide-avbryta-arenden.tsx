// src/pages/shared/intranet/guider/guide-avbryta-arenden.tsx
// Guidemodul: Avbryt eller ta bort ett ärende (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls så att länkar och läsloggen fungerar.
//
// Efterbildning av EditCaseModal i nya vyn: Ärendets verktyg › Kontakt och plats ›
// Kommunikation (CommunicationSlidePanel, "Skriv en kommentar... (använd @ för att nämna
// någon)", den gröna pilen, på datorn Skicka, Stäng panel) och Ärendets verktyg › Ta bort ›
// Radera ärende ("Frågar en gång till innan ärendet tas bort."), DeleteCaseConfirmDialog
// (Ta bort ärende, "Ärendet markeras som borttaget och döljs från alla vyer. All data
// behålls.", Avbryt, Ta bort, toasten "Ärendet har tagits bort"). caseDeleteService sätter
// status Borttaget och deleted_at, ingenting raderas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Ark, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { gorMk, ingenMk, type Mk, type Tryck } from './_arenden'
import { ArendeRam, KommPanel, NR, RutKnapp, VerktygArk, type Kommentar } from './_nyvy_tickets'

type Vy = 'arende' | 'verktyg1' | 'komm' | 'komm-text' | 'komm-skickad' | 'arende2' | 'verktyg2' | 'fraga' | 'borta'

const ORSAK = 'Kunden ringde och avbokade. Råttorna har försvunnit, de hör av sig om de kommer tillbaka.'

const SKICKAD: Kommentar[] = [{ id: 'k1', namn: 'Du', egen: true, tid: '2026-10-26 07:40', text: ORSAK }]

function TaBortRuta({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
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
        <div className="flex gap-2 border-t border-slate-700/50 pt-2">
          <RutKnapp id="avbryt" mk={mk} tryck={tryck}>Avbryt</RutKnapp>
          <RutKnapp id="ta-bort" fara ikon="allman.radera" mk={mk} tryck={tryck}>Ta bort</RutKnapp>
        </div>
      </Ark>
    </div>
  )
}

function Skarm({ vy, mk, tryck, markor }: { vy: Vy; mk: Mk; tryck: Tryck; markor?: NyMarkor }) {
  const komm = vy === 'komm' || vy === 'komm-text' || vy === 'komm-skickad'
  return (
    <ArendeRam
      stangt={vy === 'borta'}
      borttaget={vy === 'borta'}
      markor={markor}
      onRam={tryck}
      mk={mk}
      tryck={tryck}
      ovanpa={<>
        {vy === 'verktyg1' && <VerktygArk fran="kontakt" oppen="kontakt" mk={mk} tryck={tryck} />}
        {vy === 'verktyg2' && <VerktygArk fran="arendet" oppen="ta-bort" mk={mk} tryck={tryck} />}
        {komm && <KommPanel kommentarer={vy === 'komm-skickad' ? SKICKAD : []} text={vy === 'komm-text' ? ORSAK : ''} mk={mk} tryck={tryck} />}
        {vy === 'fraga' && <TaBortRuta mk={mk} tryck={tryck} />}
      </>}
      notis={vy === 'borta' ? <Notis text="Ärendet har tagits bort" /> : undefined}
    />
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arende', markera: 'verktyg' },
  { vy: 'verktyg1', markera: 'kommunikation' },
  { vy: 'komm-text', markera: 'komm-skicka' },
  { vy: 'komm-skickad', markera: 'panel-stang' },
  { vy: 'arende2', markera: 'verktyg' },
  { vy: 'verktyg2', markera: 'radera' },
  { vy: 'fraga', markera: 'ta-bort' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const markor: NyMarkor | undefined = v.markera === 'verktyg' ? { pa: true, nr: steg + 1, mal: 'verktyg' } : undefined
  return <Skarm vy={v.vy} mk={gorMk(v.markera, steg + 1)} markor={markor} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Familjen Exempel har ringt och avbokat. Ärendet är öppet. Skriv först i ärendets kommunikation varför det avbryts.' }

const TIPS: Record<string, string> = {
  nasta: 'Jag är framme är för när du står hos kunden. Besöket blir inte av.',
  tillbaka: 'Du står redan i första steget.',
  flikvy: 'Alla uppgifter är den vanliga flikvyn. Det du behöver finns under Ärendets verktyg.',
  stang: 'Krysset stänger ärendet utan att något ändras.',
  kartor: 'Kartan behövs inte nu.',
  ring: 'Kunden har redan ringt.',
  'verktyg-stang': 'Krysset stänger verktygen.',
  'boka-aterbesok': 'Ett återbesök flyttar ärendet framåt. Kunden har avbokat.',
  duplicera: 'Duplicera gör en kopia. Ärendet ska bort.',
  'nytt-arende': 'Ett nytt ärende behövs inte.',
  historik: 'Historiken visar ändringar. Det behövs inte nu.',
  status: 'Status ändrar du inte för en avbokning. Ärendet tas bort med Radera ärende.',
  'alla-uppgifter': 'Den vanliga flikvyn behövs inte.',
  avbryt: 'Avbryt stänger rutan och ärendet ligger kvar.',
}

const FRAMSTEG: Record<Vy, number> = { arende: 0, verktyg1: 1, komm: 2, 'komm-text': 2, 'komm-skickad': 3, arende2: 4, verktyg2: 5, fraga: 6, borta: 7 }

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
        if (id === 'verktyg') ga('verktyg1', 'Ärendets verktyg', 'Kommunikation står under Kontakt och plats.')
        else annars(id, 'Tryck på verktygen uppe till höger, ikonen i mitten.')
        break
      case 'verktyg1':
        if (id === 'kommunikation') ga('komm', 'Kommunikation', 'Panelen öppnades. Tryck i rutan längst ner och skriv varför ärendet avbryts.')
        else if (id === 'radera') miss('Skriv varför i kommunikationen först, så vet kontoret vad som hände. Tryck Kommunikation.')
        else annars(id, 'Tryck Kommunikation under Kontakt och plats.')
        break
      case 'komm':
        if (id === 'komm-falt') ga('komm-text', 'Orsaken är skriven', enhet === 'dator' ? 'Tryck Skicka.' : 'Tryck på den gröna pilen.')
        else if (id === 'komm-skicka') miss('Knappen är grå. Skriv orsaken i rutan först.')
        else if (id === 'panel-stang') miss('Skriv orsaken innan du stänger panelen.')
        else annars(id, 'Tryck i rutan längst ner.')
        break
      case 'komm-text':
        if (id === 'komm-skicka') ga('komm-skickad', 'Kommentaren är sparad', 'Den står i panelen och finns kvar i ärendet. Stäng panelen med krysset.')
        else if (id === 'panel-stang') miss('Kommentaren är inte skickad än. Skicka den först.')
        else annars(id, enhet === 'dator' ? 'Tryck Skicka.' : 'Tryck på den gröna pilen.')
        break
      case 'komm-skickad':
        if (id === 'panel-stang') ga('arende2', 'Tillbaka i ärendet', 'Nu tar du bort ärendet. Öppna verktygen igen.')
        else annars(id, 'Stäng panelen med krysset uppe till höger.')
        break
      case 'arende2':
        if (id === 'verktyg') ga('verktyg2', 'Ärendets verktyg', 'Radera ärende står längst ner, under Ta bort.')
        else annars(id, 'Tryck på verktygen uppe till höger.')
        break
      case 'verktyg2':
        if (id === 'radera') ga('fraga', 'Ta bort ärende', 'Rutan frågar en gång till. All data behålls.')
        else annars(id, 'Tryck Radera ärende under Ta bort.')
        break
      case 'fraga':
        if (id === 'ta-bort') {
          setVy('borta')
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Ärendet fick status Borttaget och är borta ur Mina ärenden. Kommentaren om avbokningen finns kvar i ärendet.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else annars(id, 'Tryck Ta bort.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={7} svar={svar} onBorjaOm={() => { setVy('arende'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm vy={vy} mk={ingenMk} tryck={vy === 'borta' ? () => {} : tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
