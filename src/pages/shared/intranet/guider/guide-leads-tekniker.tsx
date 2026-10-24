// src/pages/shared/intranet/guider/guide-leads-tekniker.tsx
// Guidemodul: Tipsa om en ny kund (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls från den tidigare guiden Tipsa om en lead.
//
// Efterbildning av sidan Leads och tips från 2026-10-24:
//   SkapaArk     Skapa > Vad vill du göra? > Tips om ny kund (/technician/leads?ny=1)
//   NyLeadModal  rutan Tips om ny kund, "Namn, vad det gäller och hur vi når dem. Resten fyller du i
//                efteråt.", frågorna 1 Vem gäller det? (Företag eller namn *, Kontaktperson),
//                2 Vad gäller det? (krävs för tekniker), 3 Hur når vi dem? (Telefon, E-post,
//                "Det räcker med en av dem."), 4 Vem tar det vidare? (Koordinatorn fördelar är
//                förvalt för tekniker, Jag tar det själv, En kollega). Med ägare visas Nästa steg och
//                Datum och tid ifyllda med förslag (Ring och presentera oss, nästa vardag 09:00).
//                Felen "Skriv företagets eller personens namn.", "Skriv kort vad kunden behöver hjälp
//                med." och "Fyll i telefon eller e-post." står under fälten, och i foten "Det saknas
//                uppgifter. Se de röda texterna." Knappen Skicka tips (utan ägare) eller Skapa lead.
//                Notiserna "Tipset är skickat" och "Leaden är skapad", sedan öppnas leaden.
//   Leads.tsx    teknikerläget: "Det du har tipsat om, äger eller fått delat med dig.", meningen om
//                läget och flikarna Att göra, Pågående, Nya tips, Alla (ingen Statistik).
// Knappen Skapa lead i ärendets steg Klart beskrivs i texten. Påhittade kunder, inget sparas.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { SkapaArket, ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'
import { LeadBehov, LeadFonster, LeadHuvud, LeadsLista } from './_leads'

type Vy = 'start' | 'ark' | 'ruta' | 'klart'
type Vem = 'ingen' | 'jag' | 'kollega'

interface Lage {
  vy: Vy
  namn: boolean
  vad: boolean
  tel: boolean
  vem: Vem
  forsokt: boolean
}

const BAS: Lage = { vy: 'start', namn: false, vad: false, tel: false, vem: 'ingen', forsokt: false }
const AB = 'Exempel AB'
const VAD = 'Råttor i soprummet. Vill ha hjälp med fast avtal.'

function Steg({ nr, text }: { nr: number; text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white">
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 font-mono text-[9px] text-slate-300">{nr}</span>
      {text}
    </p>
  )
}

function Falt({ id, etikett, varde, tom, fel, rod, hog, tryck, mk }: { id: string; etikett: string; varde: string; tom?: boolean; fel?: string; rod?: boolean; hog?: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      {etikett && <span className="text-[9.5px] font-medium text-slate-300">{etikett}</span>}
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full rounded-lg border bg-slate-900 px-1.5 text-left text-[10.5px] ${hog ? 'min-h-[34px] py-1 leading-snug' : 'h-6 truncate'} ${fel || rod ? 'border-red-500/70' : 'border-slate-600'} ${tom ? 'text-slate-500' : 'text-white'}`}>{varde}</button>
      </Markor>
      {fel && <span className="text-[9.5px] text-red-400">{fel}</span>}
    </div>
  )
}

function VemKort({ id, ikon, rubrik, text, vald, tryck, mk }: { id: string; ikon: IconName; rubrik: string; text: string; vald: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
        <Icon name={ikon} size={16} className={`flex-none ${vald ? 'text-[#20c58f]' : 'text-slate-300'}`} />
        <span className="min-w-0">
          <span className="block text-[10.5px] font-semibold text-white">{rubrik}</span>
          <span className="block truncate text-[9.5px] text-slate-400">{text}</span>
        </span>
      </button>
    </Markor>
  )
}

function Ruta({ l, tryck, mk, dator }: { l: Lage; tryck: Tryck; mk: Mk; dator: boolean }) {
  const f = l.forsokt
  const harAgare = l.vem !== 'ingen'
  const saknas = !l.namn || !l.vad || !l.tel
  return (
    <div className={`absolute inset-0 z-20 flex ${dator ? 'items-center justify-center bg-black/60 p-3' : ''}`}>
      <div className={`flex flex-col bg-slate-900 ${dator ? 'max-h-full w-full max-w-[440px] overflow-hidden rounded-xl border border-slate-700 shadow-2xl' : 'h-full w-full'}`}>
        <div className="flex items-start justify-between border-b border-slate-700 px-3 py-2">
          <div>
            <p className="text-[13px] font-bold text-white">Tips om ny kund</p>
            <p className="text-[9.5px] text-slate-400">Namn, vad det gäller och hur vi når dem. Resten fyller du i efteråt.</p>
          </div>
          <button type="button" onClick={() => tryck('avbryt')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="grid flex-1 content-start gap-2 overflow-y-auto p-2.5">
          <div className="grid gap-1">
            <Steg nr={1} text="Vem gäller det?" />
            <Falt id="namn" etikett="Företag eller namn *" varde={l.namn ? AB : 'Till exempel Exempel AB'} tom={!l.namn} fel={f && !l.namn ? 'Skriv företagets eller personens namn.' : undefined} tryck={tryck} mk={mk} />
            <Falt id="kontakt" etikett="Kontaktperson" varde="Till exempel Anna Exempel" tom tryck={tryck} mk={mk} />
          </div>
          <div className="grid gap-1">
            <Steg nr={2} text="Vad gäller det?" />
            <Falt id="vad" etikett="" varde={l.vad ? VAD : 'Till exempel Råttor i soprummet. Vill ha hjälp med fast avtal.'} tom={!l.vad} hog fel={f && !l.vad ? 'Skriv kort vad kunden behöver hjälp med.' : undefined} tryck={tryck} mk={mk} />
          </div>
          <div className="grid gap-1">
            <Steg nr={3} text="Hur når vi dem?" />
            <div className="grid grid-cols-2 gap-1.5">
              <Falt id="tel" etikett="Telefon" varde='070-123 45 67' tom={!l.tel} rod={f && !l.tel} tryck={tryck} mk={mk} />
              <Falt id="epost" etikett="E-post" varde="namn@exempel.se" tom rod={f && !l.tel} tryck={tryck} mk={mk} />
            </div>
            <span className={`text-[9.5px] ${f && !l.tel ? 'text-red-400' : 'text-slate-400'}`}>{f && !l.tel ? 'Fyll i telefon eller e-post.' : 'Det räcker med en av dem.'}</span>
          </div>
          <div className="grid gap-1">
            <Steg nr={4} text="Vem tar det vidare?" />
            <VemKort id="vem:ingen" ikon="lead.fordela" rubrik="Koordinatorn fördelar" text="Tipset hamnar under Nya tips. Du står kvar som tipsare." vald={l.vem === 'ingen'} tryck={tryck} mk={mk} />
            <VemKort id="vem:jag" ikon="lead.agare" rubrik="Jag tar det själv" text="Du blir ägare och bestämmer när du hör av dig." vald={l.vem === 'jag'} tryck={tryck} mk={mk} />
            <VemKort id="vem:kollega" ikon="lead.dela" rubrik="En kollega" text="Välj vem som ska ta det vidare." vald={l.vem === 'kollega'} tryck={tryck} mk={mk} />
            {l.vem === 'jag' && (
              <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-800/30 p-1.5">
                <p className="text-[9.5px] text-slate-300">En lead med ägare behöver ett nästa steg, så att den kommer upp under Att göra på rätt dag. Förslaget går att ändra.</p>
                <div className="grid grid-cols-[1fr_92px] gap-1.5">
                  <Falt id="nasta" etikett="Nästa steg *" varde="Ring och presentera oss" tryck={tryck} mk={mk} />
                  <Falt id="nar" etikett="Datum och tid *" varde="2026-10-27 09:00" tryck={tryck} mk={mk} />
                </div>
              </div>
            )}
          </div>
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-white">
            <Icon name="allman.chevron" size={16} className="h-3 w-3 text-slate-400" /> Fler uppgifter <span className="font-normal text-slate-400">valfritt, org.nr och årspremie</span>
          </p>
        </div>
        <div className="grid gap-1.5 border-t border-slate-700 px-3 py-2">
          <p className={`text-[9.5px] ${f && saknas ? 'text-red-400' : 'text-slate-400'}`}>
            {f && saknas ? 'Det saknas uppgifter. Se de röda texterna.' : harAgare ? 'Du blir ägare. Leaden kommer upp under Att göra den dag du valt.' : 'Koordinatorn får tipset under Nya tips och fördelar det. Du står kvar som tipsare.'}
          </p>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => tryck('avbryt')} className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] text-white">Avbryt</button>
            <Markor markor={mk('spara')}>
              <button type="button" onClick={() => tryck('spara')} className="inline-flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-1 text-[11px] font-semibold text-[#04281c]">
                <Icon name={harAgare ? 'allman.bock' : 'lead.tips'} size={16} className="h-3.5 w-3.5" />
                {harAgare ? 'Skapa lead' : 'Skicka tips'}
              </button>
            </Markor>
          </div>
        </div>
      </div>
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
          <p className="text-[11px] text-slate-400">Grannen Exempel AB har också råttor i soprummet.</p>
        </div>
      </NySkarm>
    )
  }
  const dator = enhet === 'dator'
  const klart = l.vy === 'klart'
  const over = l.vy === 'ruta'
    ? <Ruta l={l} tryck={tryck} mk={mk} dator={dator} />
    : (
      <>
        <LeadFonster titel={AB} under="Tips från Anna" onStang={() => tryck('stang')}>
          <LeadHuvud stage="ny" agare={l.vem === 'jag' ? 'Anna Exempel' : undefined} tipsare="Anna Exempel" />
          <LeadBehov text={VAD} />
        </LeadFonster>
        <Notis text={l.vem === 'jag' ? 'Leaden är skapad' : 'Tipset är skickat'} />
      </>
    )
  return (
    <NySkarm sida="leads" titel="Leads och tips" under={klart ? '1 att göra, 1 öppna' : 'Inget att göra just nu, 0 öppna'} onRam={tryck} markor={markor} over={over}>
      <LeadsLista
        flik="att-gora"
        antal={{ 'att-gora': klart ? 1 : 0 }}
        sektioner={klart ? [{ grupp: 'saknar', rader: [{ id: 'ny', foretag: AB, under: 'Tips från Anna', stage: 'ny', nasta: 'Välj nästa steg', nar: '' }] }] : []}
        tryck={tryck}
        mk={ingenMk}
        beskrivning="Det du har tipsat om, äger eller fått delat med dig."
        lage={klart ? ['1 att göra', ', 1 öppna'] : ['Inget att göra just nu', ', 0 öppna', 'text-slate-200']}
        nyText="Nytt tips"
        utanFlikar={['statistik']}
        kompakt={!dator}
        visaNy={dator}
      />
    </NySkarm>
  )
}

// --- Visning ---

const RUTA: Lage = { ...BAS, vy: 'ruta' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'skapa' },
  { lage: { ...BAS, vy: 'ark' }, markera: 'skapa:Tips om ny kund' },
  { lage: RUTA, markera: 'namn' },
  { lage: { ...RUTA, namn: true }, markera: 'vad' },
  { lage: { ...RUTA, namn: true, vad: true }, markera: 'tel' },
  { lage: { ...RUTA, namn: true, vad: true, tel: true }, markera: 'spara' },
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

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `Grannen ${AB} har råttor i soprummet och vill ha fast avtal. Lämna ett tips som koordinatorn fördelar. Börja med Skapa.` }

const FEL: Record<string, string> = {
  kontakt: 'Kontaktperson är bra men inte nödvändigt. Fyll i namnet, vad det gäller och telefonen.',
  epost: 'Du har telefonnumret. Tryck Telefon.',
  'vem:kollega': 'Koordinatorn ska fördela tipset. Välj Koordinatorn fördelar.',
  nasta: 'Du ska inte ringa själv. Välj Koordinatorn fördelar, så behövs inget nästa steg.',
  nar: 'Du ska inte ringa själv. Välj Koordinatorn fördelar, så behövs ingen tid.',
  stang: 'Tipset är redan skickat.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(n => n + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'start') {
      if (id === 'nav:Skapa' || id === 'skapa') { setL({ ...l, vy: 'ark' }); tips('Vad vill du göra?', 'Välj Tips om ny kund.') }
      else miss(enhet === 'dator' ? 'Skapa är den gröna knappen uppe i sidhuvudet.' : 'Skapa är den gröna knappen mitt i bottenmenyn.')
      return
    }
    if (l.vy === 'ark') {
      if (id === 'skapa:Tips om ny kund') { setL({ ...l, vy: 'ruta' }); tips('Tips om ny kund', 'Fyra frågor. Koordinatorn fördelar är redan valt. Börja med namnet.') }
      else miss('Tipset lämnar du med Tips om ny kund.')
      return
    }
    if (id === 'avbryt') { setL(BAS); miss('Avbryt stänger rutan och inget sparas. Börja om med Skapa.'); return }
    if (FEL[id]) { miss(FEL[id]); return }
    switch (id) {
      case 'namn': setL({ ...l, namn: true }); tips('Namnet är ifyllt', 'Skriv nu vad det gäller under 2.'); return
      case 'vad': setL({ ...l, vad: true }); tips('Det som gäller', 'Det här läser koordinatorn först. Fyll i telefonen under 3.'); return
      case 'tel': setL({ ...l, tel: true }); tips('Telefonen är ifylld', 'Koordinatorn fördelar står redan valt. Tryck Skicka tips.'); return
      case 'vem:ingen': setL({ ...l, vem: 'ingen' }); tips('Koordinatorn fördelar', 'Rätt val. Tryck Skicka tips när allt är ifyllt.'); return
      case 'vem:jag': setL({ ...l, vem: 'jag' }); miss('Med Jag tar det själv blir du ägare och ska ringa själv. Koordinatorn ska fördela tipset, så välj Koordinatorn fördelar.'); return
      case 'spara': {
        if (l.vem !== 'ingen') { miss('Uppdraget var att koordinatorn fördelar tipset. Välj Koordinatorn fördelar.'); return }
        if (!l.namn || !l.vad || !l.tel) {
          setL({ ...l, forsokt: true })
          miss(`Det saknas uppgifter, de röda texterna visar vad. Fyll i ${!l.namn ? 'Företag eller namn' : !l.vad ? 'vad det gäller' : 'telefonen'}.`)
          return
        }
        setL({ ...l, vy: 'klart' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Det står Tipset är skickat och leaden ${AB} öppnas med Ingen ägare och Tips från ditt namn. Koordinatorn ser den under Nya tips. Du hittar den under Leads och tips.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        return
      }
    }
    miss('Fyll i namnet, vad det gäller och telefonen, och tryck Skicka tips.')
  }

  const framsteg = l.vy === 'start' ? 0 : l.vy === 'ark' ? 1 : l.vy === 'klart' ? 6 : 2 + Number(l.namn) + Number(l.vad) + Number(l.tel)
  return (
    <OvningRam framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
