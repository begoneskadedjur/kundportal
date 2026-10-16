// src/pages/shared/intranet/guider/guide-tillaggsstationer.tsx
// Guidemodul: Sätt ut en tilläggsstation (tekniker, telefon).
// Etiketterna följer EquipmentPlacementForm (Produkt, Ingen produkt vald, Tillägg utöver
// avtal, Skapa placering), AddonModelPicker (Betalas, per år, per månad, per kontroll,
// pris saknas), TechnicianEquipment (Station placerad!, Färdig med etablering, Stäng ärende
// och skicka följande för fakturering, Stäng & fakturera) och AddonLabourStep (Arbetstid för
// att hantera tilläggen, Nya tillägg du har satt ut, Hur mycket arbetstid ska vi debitera
// för att hantera dessa tillägg?, timmar per år, Så faktureras det). Påhittad kund,
// priserna är Automatisk prislista (144: 3 600 kr per år, 135: 1 016 kr per timme).

import { useState } from 'react'
import {
  Falt, Markor, Notis, OvningRam, PKnapp, Rad, Telefon,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { ArkHuvud, Dubbelknapp, LokalIkon, TYPER, TypRuta } from './_stationer'

type Vy = 'form' | 'klar' | 'summa' | 'klart'
type Modell = 'ar' | 'manad' | 'kontroll'
type Produkt = 'nature' | 'collect' | null

interface Lage {
  vy: Vy
  produkt: Produkt
  lista: boolean
  tillagg: boolean
  modell: Modell | null
  timmar: string
  fel: string | null
}

const PRODUKTER: { id: Exclude<Produkt, null>; namn: string }[] = [
  { id: 'nature', namn: 'Aurotrap Nature' },
  { id: 'collect', namn: 'Aurotrap Collect' },
]
const MODELLER: { id: Modell; namn: string; pris: string }[] = [
  { id: 'ar', namn: 'per år', pris: '3 600 kr/år' },
  { id: 'manad', namn: 'per månad', pris: '300 kr/mån' },
  { id: 'kontroll', namn: 'per kontroll', pris: 'pris saknas' },
]

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Radio({ pa, namn, pris, onClick, markor }: { pa: boolean; namn: string; pris: string; onClick: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" role="radio" aria-checked={pa} onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12px] ${pa ? 'border-[#20c58f]/60 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'}`}>
        <span className={`h-3.5 w-3.5 flex-none rounded-full border-2 ${pa ? 'border-[#20c58f] bg-[#20c58f]' : 'border-slate-500'}`} aria-hidden />
        <span className="flex-1 text-slate-200">{namn}</span>
        <span className="text-[11px] text-slate-400">{pris}</span>
      </button>
    </Markor>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  if (l.vy === 'klar') {
    return (
      <Telefon>
        <div className="grid justify-items-center gap-1 p-6 pt-16 text-center">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <p className="text-base font-semibold text-white">Station placerad!</p>
          <p className="text-xs text-slate-400">Exempel AB Lager</p>
          <p className="mb-4 text-[11px] text-slate-500">1 station placerade denna session</p>
          <div className="grid w-full gap-2">
            <PKnapp prim onClick={() => tryck('fler')}>Placera fler utomhus</PKnapp>
            <PKnapp onClick={() => tryck('inne')}>Placera inomhus</PKnapp>
            <PKnapp onClick={() => tryck('fardig')} markor={mk(markera, 'fardig', nr)}>Färdig med etablering</PKnapp>
          </div>
        </div>
      </Telefon>
    )
  }

  if (l.vy === 'summa' || l.vy === 'klart') {
    const h = Number(l.timmar.replace(',', '.'))
    const arbete = Number.isFinite(h) && l.timmar !== '' ? Math.round(h * 1016) : null
    return (
      <Telefon>
        <div className="grid gap-2 overflow-hidden p-3">
          <div>
            <p className="text-[13px] font-semibold leading-tight text-white">Stäng ärende och skicka följande för fakturering</p>
            <p className="text-[11px] text-slate-400">Exempel AB Lager</p>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-violet-400"><span className="h-2 w-2 rounded-full bg-violet-500" />1 tilläggsstation placerade i denna etablering</p>
          <p className="text-[12.5px] font-semibold text-white">Arbetstid för att hantera tilläggen</p>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-2">
            <p className="mb-1 text-[11px] font-semibold text-white">Nya tillägg du har satt ut</p>
            <Rad v={<span><span className="text-[#c084fc]">● </span>Mekanisk fälla, 1 st</span>} h="3 600 kr" />
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
            <p className="text-[11.5px] font-medium text-slate-200">Hur mycket arbetstid ska vi debitera för att hantera dessa tillägg?</p>
            <div className="flex items-center gap-1.5">
              <Markor markor={mk(markera, 'timmar', nr)}>
                <button type="button" onClick={() => tryck('timmar')}
                  className="h-8 w-14 rounded-lg border border-slate-600 bg-slate-800 px-2 text-right text-[13px] text-white">{l.timmar}</button>
              </Markor>
              <span className="text-[11.5px] font-semibold text-white">timmar per år</span>
              <span className="text-[11px] text-slate-400">× 1 016 kr</span>
            </div>
            {l.fel && <p className="text-[11px] text-red-400">{l.fel}</p>}
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-2">
            <p className="text-[11px] font-semibold text-white">Så faktureras det</p>
            <Rad v="Från 1 jan 2027" h={arbete != null ? `${(3600 + arbete).toLocaleString('sv-SE')} kr per år` : '3 600 kr per år'} />
            <p className="text-[10.5px] text-slate-400">Egen faktura i samband med avtalets årsfaktura</p>
          </div>
          <p className="text-[10.5px] text-amber-400">● Kontoret beslutar tilläggen i avtalskartan. Dina timmar följer med som förslag.</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-1.5 border-t border-slate-700 bg-slate-900 px-3 py-2.5">
          <PKnapp onClick={() => tryck('avbryt-summa')}>Avbryt</PKnapp>
          <PKnapp prim onClick={() => tryck('stang')} markor={mk(markera, 'stang', nr)}>Stäng &amp; fakturera</PKnapp>
        </div>
        {l.vy === 'klart' && <Notis text="Etablering avslutad. 2 rad(er) skickade till fakturering." />}
      </Telefon>
    )
  }

  const valdProdukt = PRODUKTER.find(p => p.id === l.produkt)
  return (
    <Telefon>
      <ArkHuvud titel="Ny utrustningsplacering" under="Exempel AB Lager" onStang={() => tryck('kryss')} />
      <div className="grid gap-1.5 px-3 py-2">
        <div className="grid grid-cols-3 gap-1.5">
          <TypRuta typ={TYPER.mekanisk} vald onClick={() => tryck('typ')} />
          <TypRuta typ={TYPER.betong} onClick={() => tryck('typ-annan')} />
          <TypRuta typ={TYPER.ljus} onClick={() => tryck('typ-annan')} />
        </div>
        <div className="relative">
          <Falt etikett="Produkt (intern)" varde={valdProdukt?.namn ?? 'Ingen produkt vald'} tom={!valdProdukt} onClick={() => tryck('produkt')} markor={mk(markera, 'produkt', nr)} />
          {l.lista && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 grid rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
              {PRODUKTER.map(p => (
                <button key={p.id} type="button" onClick={() => tryck(`produkt-${p.id}`)} className="px-2.5 py-1.5 text-left text-[12.5px] text-slate-200 hover:bg-slate-700">{p.namn}</button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
          <Markor markor={mk(markera, 'tillagg', nr)}>
            <button type="button" role="checkbox" aria-checked={l.tillagg} onClick={() => tryck('tillagg')} className="flex items-start gap-2 text-left">
              <span className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${l.tillagg ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>
                {l.tillagg && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </span>
              <span>
                <span className="block text-[12.5px] font-medium text-slate-200">Tillägg utöver avtal</span>
                <span className="block text-[10.5px] leading-snug text-slate-400">Stationen ingår inte i avtalets årspremie. Välj hur den betalas: priserna kommer från kundens prislista.</span>
              </span>
            </button>
          </Markor>
          {l.tillagg && (
            <div className="grid gap-1">
              <p className="text-[11px] font-medium text-slate-400">Betalas</p>
              {MODELLER.map(m => (
                <Radio key={m.id} pa={l.modell === m.id} namn={m.namn} pris={m.pris} onClick={() => tryck(`modell-${m.id}`)} />
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Dubbelknapp titel="GPS hämtad" klar ikon={<LokalIkon namn="gps" />} onClick={() => tryck('gps')} />
          <Dubbelknapp titel="Välj på karta" ikon={<LokalIkon namn="karta" />} onClick={() => tryck('karta')} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-1.5 border-t border-slate-700 bg-slate-900 px-3 py-2.5">
        <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
        <PKnapp prim onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa placering</PKnapp>
      </div>
    </Telefon>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'form', produkt: null, lista: false, tillagg: false, modell: null, timmar: '', fel: null }
const MED: Lage = { ...BAS, produkt: 'collect', tillagg: true, modell: 'ar' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'produkt' },
  { lage: { ...BAS, produkt: 'collect' }, markera: 'tillagg' },
  { lage: MED, markera: 'skapa' },
  { lage: { ...MED, vy: 'klar' }, markera: 'fardig' },
  { lage: { ...MED, vy: 'summa' }, markera: 'timmar' },
  { lage: { ...MED, vy: 'summa', timmar: '1' }, markera: 'stang' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Typ, serienummer och GPS är redan ifyllda. Du satte ut en Aurotrap Collect. Var talar du om det?' }

const TIPS: Record<string, string> = {
  typ: 'Mekanisk fälla är redan vald. Det stämmer.',
  'typ-annan': 'Du satte ut en mekanisk fälla. Behåll den typen.',
  gps: 'Positionen är redan hämtad.',
  karta: 'Positionen är redan hämtad med GPS.',
  kryss: 'Krysset avslutar utplaceringen. Spara stationen först.',
  avbryt: 'Avbryt avslutar utplaceringen. Spara stationen först.',
  fler: 'Uppdraget var en station. Avsluta etableringen.',
  inne: 'Uppdraget var en station ute. Avsluta etableringen.',
  'avbryt-summa': 'Avbryt lämnar ärendet öppet. Svara på frågan och stäng ärendet.',
  'modell-manad': 'Per månad faktureras varje månad. Uppdraget var per år.',
  'modell-kontroll': 'Per kontroll debiteras vid varje kontrollrunda, och här saknas priset. Uppdraget var per år.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'form') {
      if (id === 'produkt') { setL({ ...l, lista: !l.lista }); return }
      if (id.startsWith('produkt-')) {
        const p = id.slice(8) as Exclude<Produkt, null>
        setL({ ...l, produkt: p, lista: false })
        if (p === 'collect') tips('Rätt produkt', 'Produkten är en intern kostnad. Kunden ser bara stationstypen. Nu: hur talar du om att den är utöver avtalet?')
        else miss('Det är Aurotrap Nature. Du satte ut en Aurotrap Collect.')
        return
      }
      if (id === 'tillagg') {
        const pa = !l.tillagg
        setL({ ...l, tillagg: pa, modell: pa ? 'ar' : null, lista: false })
        tips(pa ? 'Tillägg markerat' : 'Tillägget bortkryssat', pa ? 'Per år är förvalt eftersom kunden har avtal och ett årspris. Det var uppdraget.' : 'Uppdraget var en station utöver avtalet.')
        return
      }
      if (id === 'modell-ar') { setL({ ...l, modell: 'ar' }); tips('Per år', 'Kunden betalar för tiden kvar till avtalets nästa år och sedan årspriset.'); return }
      if (id === 'skapa') {
        if (l.produkt !== 'collect') miss('Välj produkten först, under Produkt.')
        else if (!l.tillagg) miss('Stationen är utöver avtalet. Kryssa i Tillägg utöver avtal först.')
        else if (l.modell !== 'ar') miss('Uppdraget var per år. Välj per år under Betalas.')
        else { setL({ ...l, vy: 'klar', lista: false }); tips('Station placerad', 'Kontoret har fått en notis om tillägget. Avsluta etableringen.') }
        return
      }
      miss(TIPS[id] ?? 'Välj produkt, kryssa i Tillägg utöver avtal och tryck Skapa placering.')
    } else if (l.vy === 'klar') {
      if (id === 'fardig') { setL({ ...l, vy: 'summa' }); tips('Frågan om arbetstid', 'Hur lång tid tar det att hantera fällan under ett helt år? Uppdraget var 1 timme.') }
      else miss(TIPS[id] ?? 'Tryck Färdig med etablering.')
    } else if (l.vy === 'summa') {
      if (id === 'timmar') { setL({ ...l, timmar: '1', fel: null }); tips('1 timme per år', 'Du ser vad kunden betalar per år från nästa avtalsår. Stäng ärendet.') }
      else if (id === 'stang') {
        if (l.timmar === '') {
          setL({ ...l, fel: 'Ange arbetstiden i timmar per år. Skriv 0 om ingen extra tid behövs.' })
          miss('Frågan måste besvaras. Tryck i rutan och skriv antalet timmar.')
        } else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Fällan är ett tillägg per år och ärendet är stängt. Kunden faktureras nu för tiden fram till avtalets nästa år, och dina timmar följer med som förslag till kontoret som beslutar i avtalskartan.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Skriv timmarna och tryck Stäng & fakturera.')
    }
  }

  const framsteg = l.vy === 'form' ? (l.produkt === 'collect' ? 1 : 0) + (l.tillagg ? 1 : 0) : l.vy === 'klar' ? 3 : l.vy === 'summa' ? (l.timmar ? 5 : 4) : 6
  return (
    <OvningRam framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
