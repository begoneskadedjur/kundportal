// src/pages/shared/intranet/guider/guide-mitt-konto.tsx
// Guidemodul: Ställ in Mitt konto och visningen (tekniker, nya arbetsvyn, telefon och dator).
//
// Efterbildning av:
//   NyMer                 telefonens Mer: Konto med Mitt konto och visning och temaraden
//                         (ThemeToggle variant row: "Mörkt tema", "Byt till ljust tema")
//   NyTeknikerLayout      datorns sidomeny: under Hjälp ligger Uppdateringar och Mitt konto,
//                         i sidhuvudet temaknappen (aria-label Byt tema)
//   VisningInstallningar  Visning: Visa hjälptexter, Visa genomgång första gången jag öppnar en ny
//                         sida, Visa genomgångarna igen (notisen "Genomgångarna visas igen"),
//                         "Valen sparas på ditt konto, inte bara i telefonen."
//   UserProfile           Min profil, Profilinformation, Byt lösenord (Nuvarande lösenord, Nytt
//                         lösenord, Bekräfta nytt lösenord, Lösenordskrav, knappen Byt lösenord,
//                         notisen "Lösenord uppdaterat!")
// Datorns sidomeny ritas här, eftersom skärmkitets sidomeny bara har länkarna i nyNavConfig och
// inte Uppdateringar och Mitt konto under Hjälp. Rutan Använd som app visas bara i telefonen och
// förklaras i den interaktiva delen AppenPaHemskarmen.

import { useState, type ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { Dator, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { MerSida, ingenMk, mkFor, nastaTema, type Mk, type Tema, type Tryck } from './_nyvy_salja'

type Sida = 'start' | 'mer' | 'konto'
type Del = 'visning' | 'losen'

interface Lage {
  sida: Sida
  del: Del
  tema: Tema
  hjalp: boolean
  genomgang: boolean
  nuvarande: boolean
  nytt: boolean
  notis: string | null
}

const BAS: Lage = { sida: 'start', del: 'visning', tema: 'Mörkt tema', hjalp: true, genomgang: true, nuvarande: false, nytt: false, notis: null }

// --- Datorns ram med Mitt konto under Hjälp ---

function DatorRam({ titel, tryck, mk, children, over }: { titel: string; tryck: Tryck; mk: Mk; children: ReactNode; over?: ReactNode }) {
  const lank = (id: string, text: string, aktiv = false, indrag = false) => (
    <Markor key={id} markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex w-full items-center rounded-md py-1 text-left text-[11px] ${indrag ? 'pl-6 pr-1.5' : 'px-1.5'} ${aktiv ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400 hover:text-white'}`}>
        <span className="truncate">{text}</span>
      </button>
    </Markor>
  )
  return (
    <Dator adress={titel}>
      <div className="flex min-h-[440px]">
        <nav className="hidden w-44 flex-none border-r border-slate-700 bg-slate-950/40 p-2 sm:block" aria-label="Sidomeny i exemplet">
          <p className="mb-2 px-2 text-[12px] font-bold text-[#20c58f]">BeGone</p>
          {NY_NAV_GRUPPER.map(g => (
            <div key={g.label} className="mb-2">
              <p className="px-2 pb-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
              {g.lankar.flatMap(l => l.under ? [lank(`nav:${l.label}`, l.label), ...l.under.map(u => lank(`nav:${u.label}`, u.label, false, true))] : [lank(`nav:${l.label}`, l.label)])}
              {g.label === 'Hjälp' && <>{lank('uppdateringar', 'Uppdateringar')}{lank('nav:Mitt konto', 'Mitt konto', titel === 'Mitt konto')}</>}
            </div>
          ))}
        </nav>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900/90 px-3 py-2">
            <p className="w-24 truncate text-[13px] font-semibold text-white">{titel}</p>
            <span className="flex h-7 w-36 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 text-[10.5px] text-slate-400"><Icon name="allman.sok" size={16} className="h-3 w-3" />Sök kund, adress eller ärende</span>
            <span className="ml-auto flex items-center gap-0.5">
              <span className="mr-1 flex h-7 items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 text-[11px] font-semibold text-[#04281c]"><Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Skapa</span>
              <span className="flex h-8 w-8 items-center justify-center text-amber-600/80"><Icon name="rapport.avvikelse" size={20} /></span>
              <span className="flex h-8 w-8 items-center justify-center text-slate-400"><Icon name="upphandling.notis" size={20} /></span>
              <Markor markor={mk('tema')}>
                <button type="button" onClick={() => tryck('tema')} aria-label="Byt tema" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"><Icon name="allman.tema" size={16} /></button>
              </Markor>
            </span>
          </div>
          <div className="relative min-h-0 flex-1 p-3">{children}</div>
          {over}
        </div>
      </div>
    </Dator>
  )
}

// --- Mitt konto ---

function Vaxel({ id, rubrik, text, pa, tryck, mk }: { id: string; rubrik: string; text: string; pa: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="min-w-0">
        <span className="block text-[11.5px] font-medium text-white">{rubrik}</span>
        <span className="block text-[10px] leading-snug text-slate-400">{text}</span>
      </span>
      <Markor markor={mk(id)}>
        <button type="button" role="switch" aria-checked={pa} onClick={() => tryck(id)} className={`relative mt-0.5 h-5 w-9 flex-none rounded-full ${pa ? 'bg-[#20c58f]' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow ${pa ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </Markor>
    </div>
  )
}

function Krav({ ok, text }: { ok: boolean; text: string }) {
  return <li className={`flex items-center gap-1 ${ok ? 'text-green-400' : 'text-slate-500'}`}><Icon name="allman.bock" size={16} className="h-3 w-3" />{text}</li>
}

function Konto({ l, tryck, mk, dator }: { l: Lage; tryck: Tryck; mk: Mk; dator: boolean }) {
  const visning = (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-2.5">
      <p className="text-[13px] font-semibold text-white">Visning</p>
      <div className="divide-y divide-slate-700/60">
        <Vaxel id="hjalp" rubrik="Visa hjälptexter" text="Förklaringen under rubrikerna. Avstängt ser du rubriken och en (i)-knapp som visar texten." pa={l.hjalp} tryck={tryck} mk={mk} />
        <Vaxel id="genomgang" rubrik="Visa genomgång första gången jag öppnar en ny sida" text="En kort rundtur som pekar ut det viktigaste. Den visas en gång per sida." pa={l.genomgang} tryck={tryck} mk={mk} />
        <div className="pt-1.5">
          <Markor markor={mk('aterstall')}>
            <button type="button" onClick={() => tryck('aterstall')} className="inline-flex h-7 items-center gap-1.5 rounded-xl border border-slate-600 px-2.5 text-[11px] font-medium text-white"><Icon name="allman.aterstall" size={16} className="h-3.5 w-3.5" />Visa genomgångarna igen</button>
          </Markor>
          <p className="mt-0.5 text-[10px] text-slate-400">Alla genomgångar visas på nytt nästa gång du öppnar sidorna.</p>
        </div>
      </div>
      <p className="mt-1.5 flex items-start gap-1 text-[10px] text-slate-400"><Icon name="kund.info" size={16} className="h-3 w-3 flex-none" />Valen sparas på ditt konto, inte bara i telefonen.</p>
    </section>
  )
  const nytt = l.nytt ? 'Exempel2026' : ''
  const losen = (
    <section className="rounded-xl border border-slate-700 bg-slate-800/40">
      <p className="border-b border-slate-700 px-2.5 py-1.5 text-[13px] font-semibold text-white">Byt lösenord</p>
      <div className="grid gap-1.5 p-2.5">
        {([['nuvarande', 'Nuvarande lösenord', l.nuvarande ? '••••••••' : '••••••••', !l.nuvarande], ['nytt', 'Nytt lösenord', l.nytt ? '•••••••••••' : 'Minst 8 tecken', !l.nytt], ['bekrafta', 'Bekräfta nytt lösenord', l.nytt ? '•••••••••••' : 'Upprepa lösenordet', !l.nytt]] as const).map(([id, et, v, tom]) => (
          <div key={id} className="grid gap-0.5">
            <span className="text-[10px] font-medium text-slate-300">{et}</span>
            <Markor markor={mk(id)} block>
              <button type="button" onClick={() => tryck(id)} className={`block h-6 w-full rounded-md border border-slate-600 bg-slate-900 px-1.5 text-left text-[11px] ${tom ? 'text-slate-500' : 'text-white'}`}>{v}</button>
            </Markor>
          </div>
        ))}
        <div className="rounded-lg bg-slate-800/50 p-1.5 text-[10px]">
          <p className="font-medium text-slate-300">Lösenordskrav:</p>
          <ul className="grid gap-0.5">
            <Krav ok={nytt.length >= 8} text="Minst 8 tecken" />
            <Krav ok={/[A-Z]/.test(nytt)} text="Minst en stor bokstav" />
            <Krav ok={/[a-z]/.test(nytt)} text="Minst en liten bokstav" />
            <Krav ok={/[0-9]/.test(nytt)} text="Minst en siffra" />
          </ul>
        </div>
        <Markor markor={mk('byt')} block>
          <button type="button" onClick={() => tryck('byt')} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 text-[11.5px] font-semibold text-slate-200"><Icon name="allman.las" size={16} className="h-3.5 w-3.5" />Byt lösenord</button>
        </Markor>
      </div>
    </section>
  )
  const profil = (
    <div className="px-0.5">
      <p className="text-[14px] font-bold text-white">Min profil</p>
      <p className="text-[10px] text-slate-400">Hantera dina kontouppgifter och inställningar</p>
    </div>
  )
  if (dator) {
    return (
      <div className="grid gap-2">
        {visning}
        {profil}
        <div className="grid grid-cols-2 gap-2">
          <section className="rounded-xl border border-slate-700 bg-slate-800/40">
            <p className="border-b border-slate-700 px-2.5 py-1.5 text-[13px] font-semibold text-white">Profilinformation</p>
            <div className="grid gap-1 p-2.5 text-[10.5px] text-slate-300"><span>Namn</span><span>E-postadress</span><span>Telefonnummer</span><span className="mt-1 rounded-lg bg-[#20c58f] py-1 text-center font-semibold text-[#fff]">Spara ändringar</span></div>
          </section>
          {losen}
        </div>
      </div>
    )
  }
  return l.del === 'visning' ? <div className="grid gap-2">{visning}{profil}</div> : <div className="grid gap-2">{profil}{losen}</div>
}

function Skarm({ l, mk, tryck, enhet, markor }: { l: Lage; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  const notis = l.notis ? <Notis text={l.notis} /> : undefined
  if (enhet === 'dator') {
    const titel = l.sida === 'konto' ? 'Mitt konto' : 'Idag'
    return (
      <DatorRam titel={titel} tryck={tryck} mk={mk} over={notis}>
        {l.sida === 'konto' ? <Konto l={l} tryck={tryck} mk={mk} dator /> : <p className="text-[11px] text-slate-400">Temat är nu: {l.tema.toLowerCase()}.</p>}
      </DatorRam>
    )
  }
  if (l.sida === 'konto') {
    return (
      <NySkarm sida="konto" titel="Mitt konto" onRam={tryck} markor={markor} over={notis}>
        <Konto l={l} tryck={tryck} mk={mk} dator={false} />
      </NySkarm>
    )
  }
  return (
    <NySkarm sida={l.sida === 'mer' ? 'mer' : 'idag'} titel={l.sida === 'mer' ? 'Mer' : 'Idag'} under={l.sida === 'mer' ? undefined : 'Måndag 26 oktober, 3 besök'} onRam={tryck} markor={markor}>
      {l.sida === 'mer' ? <MerSida tryck={tryck} mk={mk} tema={l.tema} grupper={['Sälja', 'Hjälp', 'Konto']} /> : <p className="text-[11px] text-slate-400">Dagens besök visas här.</p>}
    </NySkarm>
  )
}

// --- Visning ---

const KONTO: Lage = { ...BAS, sida: 'konto' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'tema-steg' },
  { lage: { ...BAS, sida: 'mer', tema: 'Ljust tema' }, markera: 'oppna' },
  { lage: KONTO, markera: 'hjalp' },
  { lage: { ...KONTO, hjalp: false }, markera: 'aterstall' },
  { lage: { ...KONTO, hjalp: false, del: 'losen' }, markera: 'nuvarande' },
  { lage: { ...KONTO, hjalp: false, del: 'losen', nuvarande: true }, markera: 'nytt' },
  { lage: { ...KONTO, hjalp: false, del: 'losen', nuvarande: true, nytt: true }, markera: 'byt' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  return <VisningSteg key={`${steg}-${enhet}`} steg={steg} onNasta={onNasta} enhet={enhet} />
}

function VisningSteg({ steg, onNasta, enhet }: { steg: number; onNasta: () => void; enhet: GuideEnhet }) {
  const [merOppen, setMerOppen] = useState(false)
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const nr = steg + 1
  if (v.markera === 'tema-steg') {
    if (enhet === 'dator') return <Skarm l={v.lage} enhet={enhet} mk={mkFor('tema', nr)} tryck={id => { if (id === 'tema') onNasta() }} />
    if (!merOppen) return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Mer' }} tryck={id => { if (id === 'nav:Mer') setMerOppen(true) }} />
    return <Skarm l={{ ...v.lage, sida: 'mer' }} enhet={enhet} mk={mkFor('tema', nr)} tryck={id => { if (id === 'tema') onNasta() }} />
  }
  if (v.markera === 'oppna') {
    const mal = enhet === 'dator' ? 'nav:Mitt konto' : 'konto'
    return <Skarm l={enhet === 'dator' ? { ...v.lage, sida: 'start' } : v.lage} enhet={enhet} mk={mkFor(mal, nr)} tryck={id => { if (id === mal) onNasta() }} />
  }
  return <Skarm l={v.lage} enhet={enhet} mk={mkFor(v.markera, nr)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Byt till ljust tema och stäng av genomgångarna som visas första gången du öppnar en sida.' }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const klart = !l.genomgang && l.tema === 'Ljust tema'

  const kolla = (n: Lage) => {
    if (!n.genomgang && n.tema === 'Ljust tema') {
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Portalen är ljus och genomgångarna visas inte längre. Valen sparas på ditt konto, så de gäller även på datorn.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
      return true
    }
    return false
  }

  const tryck = (id: string) => {
    if (klart) return
    if (id === 'tema') {
      const n = { ...l, tema: nastaTema(l.tema) }
      setL(n)
      if (kolla(n)) return
      if (n.tema === 'Ljust tema') tips('Ljust tema', enhet === 'dator' ? 'Bra. Öppna nu Mitt konto under Hjälp i sidomenyn.' : 'Bra. Tryck nu Mitt konto och visning.')
      else if (n.tema === 'Följer systemet') miss('Nu följer temat telefonens inställning. Tryck en gång till: efter Följer systemet kommer Mörkt tema och sedan Ljust tema.')
      else tips('Mörkt tema', 'Tryck en gång till för ljust tema.')
      return
    }
    if (l.sida === 'start') {
      if (enhet === 'mobil' && id === 'nav:Mer') { setL({ ...l, sida: 'mer' }); tips('Mer', 'Temat och Mitt konto ligger längst ner under Konto.'); return }
      if (enhet === 'dator' && id === 'nav:Mitt konto') { setL({ ...l, sida: 'konto' }); tips('Mitt konto', l.tema === 'Ljust tema' ? 'Stäng av genomgångarna.' : 'Temat byter du med knappen uppe till höger. Genomgångarna stänger du av här.'); return }
      miss(enhet === 'dator' ? 'Temat byter du uppe till höger, Mitt konto ligger under Hjälp i sidomenyn.' : 'Allt för kontot ligger under Mer, längst ner till höger.')
      return
    }
    if (l.sida === 'mer') {
      if (id === 'konto') { setL({ ...l, sida: 'konto' }); tips('Mitt konto', l.tema === 'Ljust tema' ? 'Stäng av genomgångarna.' : 'Temat byter du på raden under Konto på Mer. Genomgångarna stänger du av här.'); return }
      miss('Leta under Konto längst ner: Mitt konto och visning och raden med temat.')
      return
    }
    if (id === 'genomgang') {
      const n = { ...l, genomgang: !l.genomgang }
      setL(n)
      if (kolla(n)) return
      if (!n.genomgang) tips('Genomgångarna är avstängda', enhet === 'dator' ? 'Byt nu till ljust tema med knappen uppe till höger.' : 'Byt nu till ljust tema. Det gör du på Mer, under Konto.')
      else miss('Nu slog du på genomgångarna igen. Tryck en gång till.')
      return
    }
    if (id === 'hjalp') { setL({ ...l, hjalp: !l.hjalp }); miss('Det reglaget gäller hjälptexterna under rubrikerna. Uppdraget gäller genomgångarna, reglaget under.'); return }
    if (id === 'aterstall') { setL({ ...l, notis: 'Genomgångarna visas igen' }); miss('Visa genomgångarna igen visar alla genomgångar på nytt. Du ville stänga av dem.'); return }
    if (id === 'nav:Mer' && enhet === 'mobil') { setL({ ...l, sida: 'mer', notis: null }); tips('Mer', 'Raden med temat ligger under Konto.'); return }
    miss('Reglaget för genomgångarna är det andra under Visning.')
  }

  const framsteg = Number(l.tema === 'Ljust tema') + Number(!l.genomgang)
  return (
    <OvningRam framsteg={framsteg} totalt={2} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
