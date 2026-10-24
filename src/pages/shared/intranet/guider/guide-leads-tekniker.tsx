// src/pages/shared/intranet/guider/guide-leads-tekniker.tsx
// Guidemodul: Tipsa om en ny kund (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls från den tidigare guiden Tipsa om en lead.
//
// Efterbildning av:
//   SkapaArk     Skapa > Vad vill du göra? > Tips om ny kund (/technician/leads?ny=1)
//   Leads.tsx    teknikerläget: rubriken Mina leads och tips, "Det du har tipsat om, äger eller fått
//                delat med dig.", flikarna Att göra, Pågående, Nya tips, Alla (ingen Statistik)
//   NyLeadModal  Nytt tips eller lead, "Resten fyller du i på leaden efteråt", Företag eller namn *,
//                Kontaktperson, Org.nr (valfritt), Telefon, E-post, Källa * (förvald Teknikertips),
//                Nästa steg, Datum och tid, Ägare (Jag är förvalt, Ingen ägare än (koordinatorn
//                fördelar)), Årspremie i kr (valfritt), Avbryt, Skicka tips / Skapa lead.
//                Med ägare krävs Nästa steg och Datum och tid (fälten blir röda). Utan ägare:
//                "Utan ägare hamnar leaden under Nya tips där koordinatorn fördelar den."
//                Felet "Fyll i telefon eller e-post." Notiserna "Tipset är skickat" och "Leaden är skapad".
// Knappen Skapa lead i ärendets steg Klart beskrivs i texten. Påhittade kunder, inget sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { Knapp, SkapaArket, ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'

type Vy = 'start' | 'ark' | 'ruta' | 'klart'

interface Lage {
  vy: Vy
  namn: string | null
  tel: boolean
  nasta: boolean
  nar: boolean
  agare: 'jag' | 'ingen'
  valjer: boolean
  forsokt: boolean
}

const BAS: Lage = { vy: 'start', namn: null, tel: false, nasta: false, nar: false, agare: 'jag', valjer: false, forsokt: false }

function Falt({ id, etikett, varde, tom, fel, tryck, mk }: { id: string; etikett: string; varde: string; tom?: boolean; fel?: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[9.5px] font-medium text-slate-400">{etikett}</span>
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block h-6 w-full truncate rounded-md border bg-slate-800/60 px-1.5 text-left text-[10.5px] ${fel ? 'border-red-500/60' : 'border-slate-600'} ${tom ? 'text-slate-500' : 'text-white'}`}>{varde}</button>
      </Markor>
    </div>
  )
}

function Ruta({ l, tryck, mk, dator }: { l: Lage; tryck: Tryck; mk: Mk; dator: boolean }) {
  const harAgare = l.agare === 'jag'
  const felNasta = l.forsokt && harAgare && (!l.nasta || !l.nar)
  const felKontakt = l.forsokt && !l.tel
  const felNamn = l.forsokt && !l.namn
  return (
    <div className={`absolute inset-0 z-20 flex ${dator ? 'items-center justify-center bg-black/60 p-3' : ''}`}>
      <div className={`flex flex-col bg-slate-900 ${dator ? 'max-h-full w-full max-w-[420px] overflow-hidden rounded-xl border border-slate-700 shadow-2xl' : 'h-full w-full'}`}>
        <div className="flex items-start justify-between border-b border-slate-700 px-3 py-2">
          <div>
            <p className="text-[13px] font-bold text-white">Nytt tips eller lead</p>
            <p className="text-[10px] text-slate-400">Resten fyller du i på leaden efteråt</p>
          </div>
          <button type="button" onClick={() => tryck('avbryt')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="grid flex-1 content-start gap-1.5 overflow-hidden p-2.5">
          <div className="grid gap-1.5 rounded-lg border border-slate-700 bg-slate-800/30 p-2">
            <Falt id="namn" etikett="Företag eller namn *" varde={l.namn ?? ' '} tom={!l.namn} fel={felNamn} tryck={tryck} mk={mk} />
            <div className="grid grid-cols-2 gap-1.5">
              <Falt id="kontakt" etikett="Kontaktperson" varde=" " tom tryck={tryck} mk={mk} />
              <Falt id="orgnr" etikett="Org.nr (valfritt)" varde="ÅÅMMDD-NNNN" tom tryck={tryck} mk={mk} />
              <Falt id="tel" etikett="Telefon" varde={l.tel ? '070-123 45 67' : ' '} tom={!l.tel} fel={felKontakt} tryck={tryck} mk={mk} />
              <Falt id="epost" etikett="E-post" varde=" " tom fel={felKontakt} tryck={tryck} mk={mk} />
            </div>
            {felKontakt && <p className="text-[9.5px] text-red-400">Fyll i telefon eller e-post.</p>}
            <Falt id="kalla" etikett="Källa *" varde="Teknikertips" tryck={tryck} mk={mk} />
          </div>
          <div className="grid gap-1.5 rounded-lg border border-slate-700 bg-slate-800/30 p-2">
            <div className="grid grid-cols-[1fr_96px] gap-1.5">
              <Falt id="nasta" etikett={`Nästa steg${harAgare ? ' *' : ''}`} varde={l.nasta ? 'Ring och boka besök' : 'Till exempel Ring och boka besök'} tom={!l.nasta} fel={felNasta && !l.nasta} tryck={tryck} mk={mk} />
              <Falt id="nar" etikett={`Datum och tid${harAgare ? ' *' : ''}`} varde={l.nar ? '2026-10-27 08:00' : 'ÅÅÅÅ-MM-DD HH:mm'} tom={!l.nar} fel={felNasta && !l.nar} tryck={tryck} mk={mk} />
            </div>
            <div className="relative grid grid-cols-2 gap-1.5">
              <Falt id="agare" etikett="Ägare" varde={harAgare ? 'Jag' : 'Ingen ägare än (koordinatorn fördelar)'} tryck={tryck} mk={mk} />
              <Falt id="varde" etikett="Årspremie i kr (valfritt)" varde="48 000" tom tryck={tryck} mk={mk} />
              {l.valjer && (
                <div className="absolute left-0 top-full z-10 mt-0.5 w-[220px] overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
                  {([['agare:jag', 'Jag'], ['agare:ingen', 'Ingen ägare än (koordinatorn fördelar)'], ['agare:anna', 'Anna Exempel']] as const).map(([id, t]) => (
                    <Markor key={id} markor={mk(id)} block>
                      <button type="button" onClick={() => tryck(id)} className="block w-full px-2 py-1 text-left text-[10.5px] text-white hover:bg-slate-700">{t}</button>
                    </Markor>
                  ))}
                </div>
              )}
            </div>
            {!harAgare && <p className="text-[9.5px] text-slate-400">Utan ägare hamnar leaden under Nya tips där koordinatorn fördelar den.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-1.5 border-t border-slate-700 px-3 py-2">
          <button type="button" onClick={() => tryck('avbryt')} className="px-2 py-1 text-[11.5px] text-slate-300">Avbryt</button>
          <Knapp id="spara" text={harAgare ? 'Skapa lead' : 'Skicka tips'} prim tryck={tryck} mk={mk} />
        </div>
      </div>
    </div>
  )
}

function LeadsSida({ l }: { l: Lage }) {
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-[15px] font-bold text-white">Mina leads och tips</p>
        <p className="text-[10.5px] text-slate-400">Det du har tipsat om, äger eller fått delat med dig.</p>
      </div>
      <div className="flex border-b border-slate-700/50 text-[11px]">
        {['Att göra', 'Pågående', 'Nya tips', 'Alla'].map((f, i) => <span key={f} className={`-mb-px border-b-2 px-2 py-1 ${i === 0 ? 'border-[#20c58f] font-medium text-white' : 'border-transparent text-slate-400'}`}>{f}</span>)}
      </div>
      {l.vy === 'klart' ? (
        <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2">
          <p className="text-[13px] font-semibold text-white">{l.namn}</p>
          <p className="inline-flex items-center gap-1.5 text-[11px] text-blue-300"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Ny</p>
          <p className="text-[10.5px] text-slate-400">{l.agare === 'jag' ? 'Ägare: du. Nästa steg: Ring och boka besök, 2026-10-27 08:00.' : 'Ingen ägare än. Koordinatorn fördelar tipset. Du står som tipsare.'}</p>
        </div>
      ) : (
        <p className="py-3 text-center text-[10.5px] text-slate-500">Inget att göra just nu. Alla leads har ett nästa steg framåt i tiden.</p>
      )}
    </div>
  )
}

function Skarm({ l, mk, tryck, enhet, markor }: { l: Lage; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  if (l.vy === 'start' || l.vy === 'ark') {
    return (
      <NySkarm sida="idag" titel="Idag" under="Måndag 26 oktober, 3 besök" onRam={tryck} markor={markor}
        over={l.vy === 'ark' ? <SkapaArket tryck={tryck} mk={mk} /> : undefined}>
        <div className="rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#20c58f]">Nästa uppdrag</p>
          <p className="text-[13px] font-semibold text-white">Familjen Exempel, 08:00</p>
          <p className="text-[11px] text-slate-400">Grannarna i Brf Exempelgården har också råttor.</p>
        </div>
      </NySkarm>
    )
  }
  const over = l.vy === 'ruta'
    ? <Ruta l={l} tryck={tryck} mk={mk} dator={enhet === 'dator'} />
    : <Notis text={l.agare === 'jag' ? 'Leaden är skapad' : 'Tipset är skickat'} />
  return (
    <NySkarm sida="leads" titel="Leads och tips" onRam={tryck} markor={markor} over={over}>
      <LeadsSida l={l} />
    </NySkarm>
  )
}

// --- Visning ---

const BRF = 'Brf Exempelgården'
const RUTA: Lage = { ...BAS, vy: 'ruta' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'skapa' },
  { lage: { ...BAS, vy: 'ark' }, markera: 'skapa:Tips om ny kund' },
  { lage: RUTA, markera: 'namn' },
  { lage: { ...RUTA, namn: BRF }, markera: 'tel' },
  { lage: { ...RUTA, namn: BRF, tel: true }, markera: 'agare' },
  { lage: { ...RUTA, namn: BRF, tel: true, valjer: true }, markera: 'agare:ingen' },
  { lage: { ...RUTA, namn: BRF, tel: true, agare: 'ingen' }, markera: 'spara' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const nr = steg + 1
  if (v.markera === 'skapa') {
    const mal = enhet === 'dator' ? 'skapa' : 'nav:Skapa'
    return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal }} tryck={id => { if (id === mal) onNasta() }} />
  }
  return <Skarm l={v.lage} enhet={enhet} mk={mkFor(v.markera, nr)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const AB = 'Exempel AB'
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${AB} vill ha hjälp med råttor. Du ringer dem själv i morgon klockan 08:00. Lägg upp leaden med dig som ägare. Börja med Skapa.` }

const FEL: Record<string, string> = {
  kontakt: 'Kontaktperson är bra men inte nödvändigt. Fyll i företagets namn och telefon.',
  orgnr: 'Org.nr är valfritt. Fyll i namn, telefon, nästa steg och tid.',
  epost: 'Telefon räcker här. Tryck Telefon.',
  kalla: 'Källan är redan Teknikertips. Låt den stå.',
  varde: 'Årspremien är valfri. Fyll i nästa steg och tid i stället.',
  'agare:ingen': 'Utan ägare fördelar koordinatorn tipset. Du ska ringa själv, så välj Jag.',
  'agare:anna': 'Du ska ringa själv, så välj Jag.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'start') {
      if (id === 'nav:Skapa' || id === 'skapa') { setL({ ...l, vy: 'ark' }); tips('Vad vill du göra?', 'Välj Tips om ny kund.') }
      else miss(enhet === 'dator' ? 'Skapa är den gröna knappen uppe i sidhuvudet.' : 'Skapa är den gröna knappen mitt i bottenmenyn.')
      return
    }
    if (l.vy === 'ark') {
      if (id === 'skapa:Tips om ny kund') { setL({ ...l, vy: 'ruta' }); tips('Nytt tips eller lead', 'Källan är redan Teknikertips och du är förvald som ägare. Fyll i namnet.') }
      else miss('Tipset skapar du med Tips om ny kund.')
      return
    }
    if (id === 'avbryt') { setL(BAS); miss('Avbryt stänger rutan och inget sparas. Börja om med Skapa.'); return }
    if (FEL[id]) { if (id.startsWith('agare:')) setL({ ...l, valjer: false }); miss(FEL[id]); return }
    switch (id) {
      case 'namn': setL({ ...l, namn: AB }); tips('Namnet är ifyllt', 'Fyll i telefonen.'); return
      case 'tel': setL({ ...l, tel: true }); tips('Telefonen är ifylld', 'Du är ägare, så Nästa steg och Datum och tid behövs.'); return
      case 'nasta': setL({ ...l, nasta: true }); tips('Nästa steg', 'Fyll i när du ska ringa.'); return
      case 'nar': setL({ ...l, nar: true }); tips('Tiden är satt', 'Ägaren står redan som Jag. Tryck Skapa lead.'); return
      case 'agare': setL({ ...l, valjer: !l.valjer }); tips('Ägare', 'Du ska ringa själv. Välj Jag.'); return
      case 'agare:jag': setL({ ...l, agare: 'jag', valjer: false }); tips('Du är ägare', 'Tryck Skapa lead när allt är ifyllt.'); return
      case 'spara': {
        const saknas = !l.namn ? 'Företag eller namn' : !l.tel ? 'telefon eller e-post' : !l.nasta || !l.nar ? 'Nästa steg och Datum och tid' : null
        if (saknas) { setL({ ...l, forsokt: true }); miss(`Fälten som saknas blev röda. Fyll i ${saknas}.`); return }
        setL({ ...l, vy: 'klart' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Leaden ${AB} är skapad med dig som ägare och nästa steg 2026-10-27 08:00. Den öppnas direkt, och du hittar den under Mina leads och tips.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        return
      }
    }
    miss('Fyll i namn, telefon, nästa steg och tid, och tryck Skapa lead.')
  }

  const framsteg = l.vy === 'start' ? 0 : l.vy === 'ark' ? 1 : l.vy === 'klart' ? 7 : 2 + Number(!!l.namn) + Number(l.tel) + Number(l.nasta) + Number(l.nar)
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
