// src/pages/shared/intranet/guider/guide-aterbesok-avtal.tsx
// Guidemodul: Boka ett återbesök i ett avtalsärende (tekniker, telefon).
// Vägen: EditContractCaseModal › fotspåren (title "Boka återbesök eller kopiera ärende")
// › Vad vill du göra? (Boka återbesök, Kopiera ärende, Duplicera ärende) ›
// RevisitContractModal: Boka återbesök, Schemalägg uppföljning för detta ärende,
// Tillagda artiklar (n), Delfakturera dessa artiklar nu, Boka nytt besöksdatum,
// Start *, Slut (valfritt), Boka återbesök, toasten "Återbesök bokat! Du kan boka fler
// återbesök." Rutan stängs inte efter bokningen. Påhittad kund, ingenting sparas.

import { useState } from 'react'
import {
  Ark, ArendeHuvud, Falt, Flikar, IkonKnapp, Knapprad, Kort, Kryssruta, Notis, OvningRam, PKnapp, Rad, Status, Telefon,
  type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { ValArk, mk } from './_fakturering'

type Vy = 'arende' | 'val' | 'ark' | 'bokat' | 'stangd'

interface Lage {
  vy: Vy
  start: boolean
  slut: boolean
  delfaktura: boolean
}

const NU = '13 okt 2026 08:00'
const NY_START = '27 okt 2026 08:00'
const NY_SLUT = '27 okt 2026 09:00'

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const bokad = l.vy === 'bokat' || l.vy === 'stangd'
  const arkOppen = l.vy === 'ark' || l.vy === 'bokat'
  return (
    <Telefon>
      <ArendeHuvud
        nr="BE-0005678"
        status={bokad ? <Status text="Återbesök" farg="bg-[#20c58f]" /> : <Status text="Bokad" />}
        kund="Exempel AB · Org.nr 556000-0000"
        ikoner={<>
          <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller kopiera ärende" onClick={() => tryck('fotspar')} markor={mk(markera, 'fotspar', nr)} />
          <IkonKnapp ikon="allman.historik" etikett="Visa besökshistorik" onClick={() => tryck('historik')} />
        </>}
      />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Avtalad kontroll av råttstationer." /></Kort>
      <Kort titel="Schemaläggning" ikon="allman.kalender">
        <Rad v={bokad ? 'Tisdag 2026-10-27, 08:00 till 09:00' : 'Tisdag 2026-10-13, 08:00 till 09:00'} />
      </Kort>

      {l.vy === 'val' && <ValArk avtal tryck={tryck} markera={markera} nr={nr} />}

      {arkOppen && (
        <Ark titel="Boka återbesök" under="Schemalägg uppföljning för detta ärende">
          <div className="-mt-9 flex justify-end">
            <IkonKnapp ikon="allman.stang" etikett="Stäng" onClick={() => tryck('stang')} markor={mk(markera, 'stang', nr)} />
          </div>
          {l.vy === 'bokat' && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Tidigare återbesök (1)</p>
              <p className="mt-1 text-xs text-white">Bokat till: 27 okt 2026 08:00</p>
            </div>
          )}
          {/* Portalen läser in artiklarna när rutan öppnas och visar dem kvar efter bokningen */}
            <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Tillagda artiklar (1)</p>
              <Rad v={<>Extra råttfälla, montering <span className="text-[10px] text-slate-500">× 2</span></>} h="1 300 kr" />
              <Rad v="Totalt (exkl. moms)" h={<span className="text-[#20c58f]">1 300 kr</span>} />
              <Kryssruta pa={l.delfaktura} text="Delfakturera dessa artiklar nu" onClick={() => tryck('delfaktura')} markor={mk(markera, 'delfaktura', nr)} />
              {l.delfaktura && <p className="text-[11px] text-slate-500">Artiklarna skickas till fakturering och rensas från ärendet. Nya artiklar kan läggas till vid nästa besök.</p>}
            </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">Boka nytt besöksdatum</p>
          <Falt etikett="Start *" varde={l.start ? NY_START : NU} onClick={() => tryck('start')} markor={mk(markera, 'start', nr)} />
          <Falt etikett="Slut (valfritt)" varde={l.slut ? NY_SLUT : 'Välj sluttid'} tom={!l.slut} onClick={() => tryck('slut')} markor={mk(markera, 'slut', nr)} />
          <Knapprad>
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim ikon="allman.kalender" onClick={() => tryck('boka')} markor={mk(markera, 'boka', nr)}>Boka återbesök</PKnapp>
          </Knapprad>
        </Ark>
      )}

      {l.vy === 'bokat' && <Notis text="Återbesök bokat! Du kan boka fler återbesök." />}
    </Telefon>
  )
}

// ─── Visning ───

const V = (vy: Vy, start = false, slut = false, delfaktura = false): Lage => ({ vy, start, slut, delfaktura })

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: V('arende'), markera: 'fotspar' },
  { lage: V('val'), markera: 'val-aterbesok' },
  { lage: V('ark'), markera: 'start' },
  { lage: V('ark', true), markera: 'slut' },
  { lage: V('ark', true, true), markera: 'delfaktura' },
  { lage: V('ark', true, true, true), markera: 'boka' },
  { lage: V('bokat', true, true, true), markera: 'stang' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = V('arende')
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Kontrollen hos Exempel AB är gjord. Leta upp knappen för återbesök.' }

const TIPS: Record<string, string> = {
  historik: 'Klockan visar besökshistoriken. Där bokar du inget.',
  flik: 'Flikarna byter vy i ärendet. Återbesöket bokar du med fotspåren uppe till höger.',
  'val-nytt': 'Kopiera ärende är för ett nytt problem, till exempel getingar hos samma kund.',
  'val-duplicera': 'Duplicera gör en kopia. Då blir det två ärenden som inte hänger ihop.',
  'val-avbryt': 'Avbryt stänger rutan. Välj Boka återbesök.',
  avbryt: 'Avbryt stänger rutan utan att boka. Fortsätt i stället.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'stangd') return
    if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Samma avtal, nästa besök. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-aterbesok') { setL({ ...l, vy: 'ark' }); tips('Rätt val', 'Titta på Start *. Där står fortfarande ärendets nuvarande tid. Byt till 2026-10-27 08:00.') }
      else miss(TIPS[id] ?? 'Välj Boka återbesök.')
    } else if (l.vy === 'ark') {
      if (id === 'start') { setL({ ...l, start: true }); tips('Start ändrad', 'Nu står 27 okt 2026 08:00. Välj också när besöket slutar.') }
      else if (id === 'slut') {
        if (!l.start) miss('Byt Start * först. Där står fortfarande dagens besök.')
        else { setL({ ...l, slut: true }); tips('Slut vald', 'Besöket är 08:00 till 09:00. Fällorna då?') }
      } else if (id === 'delfaktura') {
        const pa = !l.delfaktura
        setL({ ...l, delfaktura: pa })
        tips(pa ? 'Fällorna faktureras nu' : 'Krysset är borta', pa ? 'De två fällorna, 1 300 kr exkl. moms, går till fakturering när du bokar.' : 'Uppdraget var att fakturera fällorna nu.')
      } else if (id === 'boka') {
        if (!l.start) miss('Start * har fortfarande ärendets nuvarande tid. Bokar du nu hamnar återbesöket på samma tid som dagens besök. Byt Start först.')
        else if (!l.slut) miss('Välj Slut (valfritt) också. Lämnar du det tomt slutar besöket samma minut som det börjar.')
        else if (!l.delfaktura) miss('Uppdraget var att fakturera fällorna nu. Kryssa i Delfakturera dessa artiklar nu först.')
        else { setL({ ...l, vy: 'bokat' }); tips('Bokat', 'Rutan är kvar öppen och bokningen syns under Tidigare återbesök. Stäng rutan.') }
      } else if (id === 'stang') miss('Krysset stänger rutan utan att boka. Boka först.')
      else miss(TIPS[id] ?? 'Ändra Start, välj Slut, kryssa i fällorna och boka.')
    } else if (l.vy === 'bokat') {
      if (id === 'stang') {
        setL({ ...l, vy: 'stangd' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Återbesöket är bokat tisdag 2026-10-27 08:00 till 09:00 och ärendet har status Återbesök. Fällorna, 1 300 kr exkl. moms, gick till fakturering som merförsäljning. Kontrollen i sig faktureras inte, den ingår i avtalet.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'boka') miss('Återbesöket är redan bokat. Trycker du igen bokar du ett till. Stäng rutan i stället.')
      else miss('Allt är klart. Stäng rutan med krysset uppe till höger.')
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'val' ? 1 : l.vy === 'ark' ? 2 + (l.start ? 1 : 0) + (l.slut ? 1 : 0) + (l.delfaktura ? 1 : 0) : l.vy === 'bokat' ? 6 : 7
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
