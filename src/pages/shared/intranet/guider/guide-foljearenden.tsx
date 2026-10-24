// src/pages/shared/intranet/guider/guide-foljearenden.tsx
// Guidemodul: Skapa ett nytt ärende för ett nytt skadedjur (tekniker, nya arbetsvyn,
// telefon och dator). Slugen behålls så att länkar och läsloggen fungerar.
//
// Efterbildning av EditCaseModal i nya vyn: Ärendets verktyg › Återbesök och nytt ärende ›
// Skapa nytt ärende ("Nytt problem hos samma kund (annat skadedjur).") och dialogen
// Skapa nytt ärende ("Välj skadedjurstyp. Kundinformation, adress och schemaläggning
// kopieras automatiskt.", Skadedjurstyp *, Välj skadedjurstyp..., Avbryt, Skapa nytt ärende),
// toasten "Följeärende skapat för Getingar!". Det nya ärendet öppnas i samma ruta och
// börjar i steget Framme. Gruppen syns inte i ett följeärende (canCreateFollowUp).

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { gorMk, ingenMk, type Mk, type Tryck } from './_arenden'
import { ArendeRam, MittRuta, RutKnapp, VerktygArk } from './_nyvy_tickets'

type Vy = 'lista' | 'arende' | 'verktyg' | 'dialog' | 'dialog-valt' | 'valj' | 'klart'

const SKADEDJUR = ['Råttor', 'Möss', 'Vägglöss', 'Silverfisk', 'Getingar', 'Kackerlackor', 'Myror']

function Dialog({ valt, oppen, mk, tryck }: { valt: boolean; oppen: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <MittRuta titel="Skapa nytt ärende" ikon="allman.plus" under="Välj skadedjurstyp. Kundinformation, adress och schemaläggning kopieras automatiskt.">
      <div className="grid gap-1">
        <span className="text-[10.5px] font-medium text-slate-400">Skadedjurstyp *</span>
        <div className="relative">
          <RutValj valt={valt} mk={mk} tryck={tryck} />
          {oppen && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-xl">
              {SKADEDJUR.map(s => (
                <li key={s}>
                  <Markor markor={mk(`djur-${s}`)} block>
                    <button type="button" onClick={() => tryck(`djur-${s}`)} className="block w-full px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800">{s}</button>
                  </Markor>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <RutKnapp id="avbryt" mk={mk} tryck={tryck}>Avbryt</RutKnapp>
        <RutKnapp id="skapa" prim inaktiv={!valt} mk={mk} tryck={tryck}>Skapa nytt ärende</RutKnapp>
      </div>
    </MittRuta>
  )
}

function RutValj({ valt, mk, tryck }: { valt: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk('valj')} block>
      <button type="button" onClick={() => tryck('valj')}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-left text-[11.5px] ${valt ? 'text-white' : 'text-slate-500'}`}>
        {valt ? 'Getingar' : 'Välj skadedjurstyp...'}
        <Icon name="allman.chevron" size={16} className="h-3.5 w-3.5 rotate-90 text-slate-400" />
      </button>
    </Markor>
  )
}

function Skarm({ vy, mk, tryck, markor }: { vy: Vy; mk: Mk; tryck: Tryck; markor?: NyMarkor }) {
  const dialog = vy === 'dialog' || vy === 'valj' || vy === 'dialog-valt'
  return (
    <ArendeRam
      stangt={vy === 'lista'}
      markor={markor}
      onRam={tryck}
      mk={mk}
      tryck={tryck}
      ovanpa={<>
        {vy === 'verktyg' && <VerktygArk fran="aterbesok" oppen="aterbesok" mk={mk} tryck={tryck} />}
        {dialog && <Dialog valt={vy === 'dialog-valt'} oppen={vy === 'valj'} mk={mk} tryck={tryck} />}
      </>}
      notis={vy === 'klart' ? <Notis text="Följeärende skapat för Getingar!" /> : undefined}
    />
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'lista', markera: 'rad-familj' },
  { vy: 'arende', markera: 'verktyg' },
  { vy: 'verktyg', markera: 'nytt-arende' },
  { vy: 'valj', markera: 'djur-Getingar' },
  { vy: 'dialog-valt', markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const markor: NyMarkor | undefined = v.markera === 'verktyg' ? { pa: true, nr: steg + 1, mal: 'verktyg' } : undefined
  return <Skarm vy={v.vy} mk={gorMk(v.markera, steg + 1)} markor={markor} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du är hos Familjen Exempel för råttorna och ser ett getingbo under taket. Öppna ärendet.' }

const TIPS: Record<string, string> = {
  'rad-ab': 'Exempel AB är en annan kund.',
  'rad-brf': 'Brf Exempelgården är en annan kund.',
  nasta: 'Jag är framme räknar arbetstiden i bakgrunden för råttärendet. Det nya ärendet skapar du under Ärendets verktyg.',
  tillbaka: 'Du står redan i första steget.',
  flikvy: 'Alla uppgifter är den vanliga flikvyn. Det nya ärendet skapar du under Ärendets verktyg.',
  stang: 'Krysset stänger ärendet.',
  kartor: 'Kartan behövs inte nu.',
  ring: 'Du behöver inte ringa kunden för det här.',
  'boka-aterbesok': 'Ett återbesök är nästa besök för samma problem. Getingarna är ett nytt skadedjur.',
  duplicera: 'Duplicera gör en kopia av hela ärendet. Du vill ha ett nytt ärende för getingarna.',
  'verktyg-stang': 'Krysset stänger verktygen.',
  avbryt: 'Avbryt stänger rutan och inget ärende skapas.',
}

const FRAMSTEG: Record<Vy, number> = { lista: 0, arende: 1, verktyg: 2, dialog: 3, valj: 3, 'dialog-valt': 4, klart: 5 }

function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>('lista')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); setSvar({ typ: 'tips', titel, text }) }
  const annars = (id: string, rad: string) => miss(TIPS[id] ? `${TIPS[id]} ${rad}` : rad)

  const tryck = (id: string) => {
    switch (vy) {
      case 'lista':
        if (id === 'rad-familj') ga('arende', 'Ärendet är öppet', 'Det står i steget Framme. Leta upp Ärendets verktyg uppe till höger, ikonen i mitten.')
        else annars(id, 'Tryck på Familjen Exempel i listan.')
        break
      case 'arende':
        if (id === 'verktyg') ga('verktyg', 'Ärendets verktyg', `Verktygen öppnades ${enhet === 'dator' ? 'uppe till höger' : 'nerifrån'}. Leta under Återbesök och nytt ärende.`)
        else annars(id, 'Tryck på verktygen uppe till höger.')
        break
      case 'verktyg':
        if (id === 'nytt-arende') ga('dialog', 'Skapa nytt ärende', 'Kunden, adressen och tiden kopieras. Välj skadedjurstyp.')
        else annars(id, 'Tryck Skapa nytt ärende.')
        break
      case 'dialog':
        if (id === 'valj') ga('valj', 'Listan är öppen', 'Välj Getingar.')
        else if (id === 'skapa') miss('Knappen är grå. Välj skadedjurstyp först.')
        else annars(id, 'Tryck på Välj skadedjurstyp...')
        break
      case 'valj':
        if (id === 'djur-Getingar') ga('dialog-valt', 'Getingar är valt', 'Nu går knappen Skapa nytt ärende att trycka på.')
        else if (id.startsWith('djur-')) miss(`Det var getingar du såg, inte ${id.slice(5).toLowerCase()}.`)
        else annars(id, 'Välj Getingar i listan.')
        break
      case 'dialog-valt':
        if (id === 'skapa') {
          setVy('klart')
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Det nya ärendet för getingarna öppnades i steget Framme, med samma kund, adress, tid och ärendenummer. Råttärendet ligger kvar.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else if (id === 'valj') ga('valj', 'Byta skadedjur?', 'Getingar var rätt. Välj Getingar igen.')
        else annars(id, 'Tryck Skapa nytt ärende.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={5} svar={svar} onBorjaOm={() => { setVy('lista'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm vy={vy} mk={ingenMk} tryck={vy === 'klart' ? () => {} : tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
