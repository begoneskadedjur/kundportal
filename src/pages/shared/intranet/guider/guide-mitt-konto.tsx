// src/pages/shared/intranet/guider/guide-mitt-konto.tsx
// Guidemodul: Ställ in Mitt konto (tekniker, nya arbetsvyn, telefon och dator).
//
// Efterbildning av:
//   NyMer                 telefonens Mer: Konto med Mitt konto och temaraden
//                         (ThemeToggle variant row: "Mörkt tema", "Byt till ljust tema")
//   NyTeknikerLayout      datorns sidomeny: under Hjälp ligger Uppdateringar och Mitt konto,
//                         i sidhuvudet temaknappen (aria-label Byt tema)
//   UserProfile           Mitt konto i grupper: Profil, Visning (Tema: Mörkt, Ljust, Som enheten),
//                         Appen på hemskärmen, Säkerhet (Byt lösenord, Nuvarande lösenord, Nytt
//                         lösenord, Bekräfta nytt lösenord, Lösenordskrav:, knappen Byt lösenord,
//                         notisen "Lösenord uppdaterat!"), Konto (Roll, Logga ut)
//   VisningInstallningar  Visa hjälptexter, Visa genomgång första gången jag öppnar en ny sida,
//                         Visa genomgångarna igen (notisen "Genomgångarna visas igen")
// Datorns sidomeny ritas här, eftersom skärmkitets sidomeny bara har länkarna i nyNavConfig och
// inte Uppdateringar och Mitt konto under Hjälp. Gruppen Appen på hemskärmen förklaras i den
// interaktiva delen AppenPaHemskarmen.

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { Dator, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { MerSida, ingenMk, mkFor, nastaTema, temaIkon, type Mk, type Tema, type Tryck } from './_nyvy_salja'

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

// Temavalet på Mitt konto: tre knappar, id tema:<värde>
const TEMAVAL: { id: string; text: string; tema: Tema; ikon: IconName }[] = [
  { id: 'tema:mork', text: 'Mörkt', tema: 'Mörkt tema', ikon: 'allman.tema' },
  { id: 'tema:ljus', text: 'Ljust', tema: 'Ljust tema', ikon: 'konto.sol' },
  { id: 'tema:system', text: 'Som enheten', tema: 'Följer systemet', ikon: 'konto.system' },
]

// --- Datorns ram med Mitt konto under Hjälp ---

function DatorRam({ titel, tema, tryck, mk, children, over }: { titel: string; tema: Tema; tryck: Tryck; mk: Mk; children: ReactNode; over?: ReactNode }) {
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
                <button type="button" onClick={() => tryck('tema')} aria-label="Byt tema" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"><Icon name={temaIkon(tema)} size={16} /></button>
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

// --- Mitt konto, i samma grupper som sidan ---

function Grupp({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-0.5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">{titel}</p>
      <div className="rounded-xl border border-slate-700/60 bg-slate-900 p-1">{children}</div>
    </section>
  )
}

function Vaxel({ id, ikon, rubrik, text, pa, tryck, mk }: { id: string; ikon: IconName; rubrik: string; text: string; pa: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="flex items-start gap-1.5 px-1.5 py-1.5">
      <Icon name={ikon} size={16} className="mt-0.5 flex-none text-slate-400" />
      <span className="min-w-0 flex-1">
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
  return (
    <li className={`flex items-center gap-1 ${ok ? 'text-[#20c58f]' : 'text-slate-400'}`}>
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${ok ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />{text}
    </li>
  )
}

function Konto({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const profil = (
    <Grupp titel="Profil">
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#20c58f]/15 text-[10.5px] font-semibold text-[#20c58f]">AE</span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-white">Anna Exempel</span>
          <span className="block truncate text-[10px] text-slate-400">Tekniker</span>
        </span>
      </div>
    </Grupp>
  )

  if (l.del === 'visning') {
    return (
      <div className="grid gap-2">
        {profil}
        <Grupp titel="Visning">
          <div className="px-1.5 py-1.5">
            <p className="text-[11.5px] font-medium text-white">Tema</p>
            <div className="mt-1 grid grid-cols-3 gap-0.5 rounded-lg border border-slate-700 p-0.5">
              {TEMAVAL.map(t => {
                const vald = l.tema === t.tema
                return (
                  <Markor key={t.id} markor={mk(t.id)} block>
                    <button type="button" role="radio" aria-checked={vald} onClick={() => tryck(t.id)}
                      className={`flex h-7 w-full items-center justify-center gap-1 rounded-md text-[10px] font-medium ${vald ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                      <Icon name={t.ikon} size={16} className={`h-3.5 w-3.5 ${vald ? 'text-[#20c58f]' : ''}`} />{t.text}
                    </button>
                  </Markor>
                )
              })}
            </div>
          </div>
          <div className="divide-y divide-slate-700/60 border-t border-slate-700/60">
            <Vaxel id="hjalp" ikon="konto.hjalptext" rubrik="Visa hjälptexter" text="Förklaringen under rubrikerna. Avstängt ser du rubriken och en (i)-knapp som visar texten." pa={l.hjalp} tryck={tryck} mk={mk} />
            <Vaxel id="genomgang" ikon="guide.visning" rubrik="Visa genomgång första gången jag öppnar en ny sida" text="En kort rundtur som pekar ut det viktigaste. Den visas en gång per sida." pa={l.genomgang} tryck={tryck} mk={mk} />
            <div className="px-1.5 py-1.5">
              <Markor markor={mk('aterstall')}>
                <button type="button" onClick={() => tryck('aterstall')} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 text-[11px] font-medium text-white"><Icon name="allman.aterstall" size={16} className="h-3.5 w-3.5" />Visa genomgångarna igen</button>
              </Markor>
            </div>
          </div>
          <p className="flex items-start gap-1 px-1.5 pb-1 text-[10px] text-slate-400"><Icon name="kund.info" size={16} className="h-3 w-3 flex-none" />Valen sparas på ditt konto, inte bara i telefonen.</p>
        </Grupp>
      </div>
    )
  }

  const nytt = l.nytt ? 'Exempel2026' : ''
  const falt: [string, string, string, boolean][] = [
    ['nuvarande', 'Nuvarande lösenord', '••••••••', !l.nuvarande],
    ['nytt', 'Nytt lösenord', l.nytt ? '•••••••••••' : 'Minst 8 tecken', !l.nytt],
    ['bekrafta', 'Bekräfta nytt lösenord', l.nytt ? '•••••••••••' : 'Upprepa lösenordet', !l.nytt],
  ]
  return (
    <div className="grid gap-2">
      <Grupp titel="Appen på hemskärmen">
        <p className="flex items-start gap-1.5 px-1.5 py-1 text-[10.5px] text-slate-300"><Icon name="konto.app" size={16} className="flex-none text-slate-400" />Lägg portalen på hemskärmen så öppnas den som en app.</p>
      </Grupp>
      <Grupp titel="Säkerhet">
        <div className="grid gap-1.5 p-1.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-white"><Icon name="allman.las" size={16} className="text-slate-400" />Byt lösenord</p>
          {falt.map(([id, et, v, tom]) => (
            <div key={id} className="grid gap-0.5">
              <span className="text-[10px] font-medium text-slate-300">{et}</span>
              <Markor markor={mk(id)} block>
                <button type="button" onClick={() => tryck(id)} className={`flex h-7 w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-1.5 text-left text-[11px] ${tom ? 'text-slate-500' : 'text-white'}`}>
                  {v}<Icon name="konto.oga" size={16} className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </Markor>
            </div>
          ))}
          <div className="text-[10px]">
            <p className="font-medium text-slate-300">Lösenordskrav:</p>
            <ul className="grid grid-cols-2 gap-0.5">
              <Krav ok={nytt.length >= 8} text="Minst 8 tecken" />
              <Krav ok={/[A-Z]/.test(nytt)} text="Minst en stor bokstav" />
              <Krav ok={/[a-z]/.test(nytt)} text="Minst en liten bokstav" />
              <Krav ok={/[0-9]/.test(nytt)} text="Minst en siffra" />
            </ul>
          </div>
          <Markor markor={mk('byt')} block>
            <button type="button" onClick={() => tryck('byt')} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 text-[11.5px] font-semibold text-white"><Icon name="allman.las" size={16} className="h-3.5 w-3.5" />Byt lösenord</button>
          </Markor>
        </div>
      </Grupp>
    </div>
  )
}

function Skarm({ l, mk, tryck, enhet, markor }: { l: Lage; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  const notis = l.notis ? <Notis text={l.notis} /> : undefined
  if (enhet === 'dator') {
    const titel = l.sida === 'konto' ? 'Mitt konto' : 'Idag'
    return (
      <DatorRam titel={titel} tema={l.tema} tryck={tryck} mk={mk} over={notis}>
        {l.sida === 'konto' ? <div className="max-w-sm"><Konto l={l} tryck={tryck} mk={mk} /></div> : <p className="text-[11px] text-slate-400">Dagens besök visas här.</p>}
      </DatorRam>
    )
  }
  if (l.sida === 'konto') {
    return (
      <NySkarm sida="konto" titel="Mitt konto" under="Dina uppgifter, visningen och lösenordet" onRam={tryck} markor={markor} over={notis}>
        <Konto l={l} tryck={tryck} mk={mk} />
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
const LOSEN: Lage = { ...KONTO, tema: 'Ljust tema', hjalp: false, del: 'losen' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'oppna' },
  { lage: KONTO, markera: 'tema:ljus' },
  { lage: { ...KONTO, tema: 'Ljust tema' }, markera: 'hjalp' },
  { lage: { ...KONTO, tema: 'Ljust tema', hjalp: false }, markera: 'aterstall' },
  { lage: LOSEN, markera: 'nuvarande' },
  { lage: { ...LOSEN, nuvarande: true }, markera: 'nytt' },
  { lage: { ...LOSEN, nuvarande: true, nytt: true }, markera: 'byt' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  return <VisningSteg key={`${steg}-${enhet}`} steg={steg} onNasta={onNasta} enhet={enhet} />
}

function VisningSteg({ steg, onNasta, enhet }: { steg: number; onNasta: () => void; enhet: GuideEnhet }) {
  const [merOppen, setMerOppen] = useState(false)
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const nr = steg + 1
  if (v.markera === 'oppna') {
    // Datorn: Mitt konto under Hjälp. Telefonen: först Mer, sedan Mitt konto under Konto.
    if (enhet === 'dator') return <Skarm l={v.lage} enhet={enhet} mk={mkFor('nav:Mitt konto', nr)} tryck={id => { if (id === 'nav:Mitt konto') onNasta() }} />
    if (!merOppen) return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Mer' }} tryck={id => { if (id === 'nav:Mer') setMerOppen(true) }} />
    return <Skarm l={{ ...v.lage, sida: 'mer' }} enhet={enhet} mk={mkFor('konto', nr)} tryck={id => { if (id === 'konto') onNasta() }} />
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

  const efterTema = (n: Lage) => {
    if (kolla(n)) return
    if (n.tema === 'Ljust tema') tips('Ljust tema', n.sida === 'konto' ? 'Bra. Stäng nu av genomgångarna, reglaget under Visa hjälptexter.' : enhet === 'dator' ? 'Bra. Öppna nu Mitt konto under Hjälp i sidomenyn.' : 'Bra. Tryck nu Mitt konto under Konto.')
    else if (n.tema === 'Följer systemet') miss('Nu följer temat telefonens inställning. Du ville ha ljust tema.')
    else miss('Det är mörkt tema. Du ville ha ljust.')
  }

  const tryck = (id: string) => {
    if (klart) return
    // Temaknappen i sidhuvudet (datorn) och temaraden på Mer (telefonen) byter i ordning
    if (id === 'tema') {
      const n = { ...l, tema: nastaTema(l.tema) }
      setL(n)
      if (kolla(n)) return
      if (n.tema === 'Ljust tema') efterTema(n)
      else if (n.tema === 'Följer systemet') miss('Nu följer temat telefonens inställning. Tryck en gång till: efter Följer systemet kommer Mörkt tema och sedan Ljust tema. Det går också att välja Ljust direkt på Mitt konto.')
      else tips('Mörkt tema', 'Tryck en gång till för ljust tema.')
      return
    }
    const val = TEMAVAL.find(t => t.id === id)
    if (val) {
      const n = { ...l, tema: val.tema }
      setL(n)
      efterTema(n)
      return
    }
    if (l.sida === 'start') {
      if (enhet === 'mobil' && id === 'nav:Mer') { setL({ ...l, sida: 'mer' }); tips('Mer', 'Mitt konto ligger längst ner under Konto.'); return }
      if (enhet === 'dator' && id === 'nav:Mitt konto') { setL({ ...l, sida: 'konto' }); tips('Mitt konto', 'Tema och genomgångar ligger båda under Visning.'); return }
      miss(enhet === 'dator' ? 'Mitt konto ligger under Hjälp i sidomenyn.' : 'Allt för kontot ligger under Mer, längst ner till höger.')
      return
    }
    if (l.sida === 'mer') {
      if (id === 'konto') { setL({ ...l, sida: 'konto' }); tips('Mitt konto', 'Tema och genomgångar ligger båda under Visning.'); return }
      miss('Leta under Konto längst ner: Mitt konto.')
      return
    }
    if (id === 'genomgang') {
      const n = { ...l, genomgang: !l.genomgang }
      setL(n)
      if (kolla(n)) return
      if (!n.genomgang) tips('Genomgångarna är avstängda', 'Välj nu Ljust under Tema.')
      else miss('Nu slog du på genomgångarna igen. Tryck en gång till.')
      return
    }
    if (id === 'hjalp') { setL({ ...l, hjalp: !l.hjalp }); miss('Det reglaget gäller hjälptexterna under rubrikerna. Uppdraget gäller genomgångarna, reglaget under.'); return }
    if (id === 'aterstall') { setL({ ...l, notis: 'Genomgångarna visas igen' }); miss('Visa genomgångarna igen visar alla genomgångar på nytt. Du ville stänga av dem.'); return }
    if (id === 'nav:Mer' && enhet === 'mobil') { setL({ ...l, sida: 'mer', notis: null }); tips('Mer', 'Mitt konto ligger under Konto.'); return }
    miss('Tema och genomgångar ligger under Visning på Mitt konto.')
  }

  const framsteg = Number(l.tema === 'Ljust tema') + Number(!l.genomgang)
  return (
    <OvningRam framsteg={framsteg} totalt={2} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
