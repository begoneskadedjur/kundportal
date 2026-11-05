// src/pages/shared/intranet/guider/guide-avtalsfakturor-kontor.tsx
// Guidemodul: Skicka avtalsfakturor i tid (admin och koordinator, dator), 3.124.0.
// Etiketterna kommer från src/pages/admin/invoicing/index.tsx (flikarna, växeln
// Att hantera | Arkiv), queue/ContractSchedule.tsx (nyckeltalen Perioden har
// börjat, Försenade, Kommande 30 dagar, Skickat i <månad>, grupperna, kolumnerna
// Skicka, Kund och faktura, Perioden, Förfaller om skickad idag, Belopp exkl.,
// Kontroll), queue/QueueParts.tsx (Inga fakturor markerade, Godkänn markerade (n),
// Skicka godkända till Fortnox (n), Avmarkera), InvoiceDetailModal (Skulle skickas,
// Perioden börjar, Förfaller om skickad idag, Skapa utkast i Fortnox),
// queue/EarlySendDialog.tsx (Fakturan gäller <månad>, Vänta till, Skicka ändå) och
// queue/InvoiceArchive.tsx (Fakturerat, Betalt, Obetalt, ej förfallet, Förfallet,
// Visa makulerade, Exportera). Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Dator, DatorSida, Markor, Notis, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'

interface Lage {
  flik: number
  grupp: boolean
  godkand: boolean
  oppen: boolean
  varning: boolean
  arkiv: boolean
}

const TOM: Lage = { flik: 0, grupp: false, godkand: false, oppen: false, varning: false, arkiv: false }

type Bas = { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }

const RUTA = 'h-3.5 w-3.5 flex-none rounded border-[1.5px] flex items-center justify-center'

function Ruta({ pa, onClick, markor, etikett }: { pa: boolean; onClick: () => void; markor?: ReturnType<typeof mk>; etikett: string }) {
  return (
    <Markor markor={markor}>
      <button type="button" role="checkbox" aria-checked={pa} aria-label={etikett} onClick={onClick}
        className={`${RUTA} ${pa ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>
        {pa && <Icon name="allman.bock" size={16} className="h-2.5 w-2.5" strokeWidth={2.6} />}
      </button>
    </Markor>
  )
}

function Nyckeltal() {
  const t = (rubrik: string, farg: string, antal: number, summa: string) => (
    <div key={rubrik} className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${farg}`} />{rubrik}</p>
      <p className="text-[13px] font-bold text-white">{antal} <span className="text-[10.5px] font-normal text-slate-300">{summa}</span></p>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {t('Perioden har börjat', 'bg-red-400', 0, '0 kr')}
      {t('Försenade', 'bg-orange-400', 2, '31 400 kr')}
      {t('Kommande 30 dagar', 'bg-[#20c58f]', 0, '0 kr')}
      {t('Skickat i november', 'bg-sky-400', 3, '42 100 kr')}
    </div>
  )
}

function Schema({ l, tryck, markera, nr }: Bas) {
  const rad = (id: string, skicka: string, status: string, farg: string, kund: string, under: string, period: string, forfaller: string, rod: boolean, belopp: string, valbar: boolean) => (
    <div key={id} className="flex items-center gap-2 border-t border-slate-800/60 px-2 py-1.5">
      {valbar ? <Ruta pa={l.grupp} etikett={`Markera ${kund}`} onClick={() => tryck(`ruta-${id}`)} /> : <span className="w-3.5" />}
      <Markor markor={mk(markera, `rad-${id}`, nr)} block>
        <button type="button" onClick={() => tryck(`rad-${id}`)} className="grid w-full grid-cols-[86px_1.5fr_80px_96px_60px] items-center gap-2 text-left">
          <span><span className="block font-mono text-[11px] text-white">{skicka}</span><span className={`flex items-center gap-1 text-[9.5px] ${farg}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span></span>
          <span className="min-w-0"><span className="block truncate text-[11.5px] text-white">{kund}</span><span className="block truncate text-[9.5px] text-slate-500">{under}</span></span>
          <span className="font-mono text-[10px] text-slate-300">{period}</span>
          <span className={`font-mono text-[10px] ${rod ? 'text-red-400' : 'text-slate-300'}`}>{forfaller}</span>
          <span className="text-right text-[11.5px] font-semibold text-white">{belopp}</span>
        </button>
      </Markor>
    </div>
  )
  const valda = l.grupp && !l.godkand ? 2 : 0
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5">
        <span className="text-[11px] font-semibold text-white">{valda ? '2 fakturor markerade' : 'Inga fakturor markerade'} <span className="font-normal text-slate-400">{valda ? '31 400 kr exkl. moms' : ''}</span></span>
        <span className="flex gap-1.5">
          <PKnapp ikon="allman.bock" inaktiv={!valda} onClick={() => tryck('godkann-markerade')} markor={mk(markera, 'godkann-markerade', nr)}>Godkänn markerade ({valda})</PKnapp>
          <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka-godkanda')}>Skicka godkända till Fortnox ({l.godkand ? 3 : 1})</PKnapp>
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 bg-slate-800/40 px-2 py-1.5">
          <Ruta pa={l.grupp} etikett="Markera alla i Försenade" onClick={() => tryck('grupp-forsenade')} markor={mk(markera, 'grupp-forsenade', nr)} />
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><span className="h-2 w-2 rounded-full bg-orange-400" />Försenade</span>
          <span className="truncate text-[10px] text-slate-500">Skicka idag, perioden har inte börjat än</span>
        </div>
        {rad('brf', '2026-10-28', l.godkand ? 'Försenad 8 dagar, godkänd' : 'Försenad 8 dagar', 'text-orange-400', 'Brf Exempelgården', '1234 · INV-202610-0101 · Årsvis', '2026-12-01', '2026-12-05', true, '24 400', true)}
        {rad('ab', '2026-11-03', l.godkand ? 'Försenad 2 dagar, godkänd' : 'Försenad 2 dagar', 'text-orange-400', 'Exempel AB', '5678 · INV-202610-0102 · Årsvis', '2026-12-15', '2026-12-05', false, '7 000', true)}
        <div className="flex items-center gap-2 bg-slate-800/40 px-2 py-1.5">
          <span className="w-3.5" />
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><span className="h-2 w-2 rounded-full bg-[#20c58f]" />Kommande</span>
          <span className="truncate text-[10px] text-slate-500">Skickas på sitt datum</span>
        </div>
        {rad('manad', '2027-01-01', 'Om 57 dagar', 'text-[#20c58f]', 'Exempel AB', '5678 · INV-202611-0120 · Månadsvis', '2027-01-01', '2026-12-05', false, '950', false)}
      </div>
    </div>
  )
}

function Arkiv() {
  const rad = (datum: string, fnx: string, inv: string, kund: string, belopp: string, status: string, farg: string, under: string) => (
    <div key={inv} className="grid grid-cols-[80px_80px_1.4fr_70px_1fr] items-center gap-2 border-t border-slate-800/60 px-2 py-1.5">
      <span className="font-mono text-[11px] text-white">{datum}</span>
      <span className="font-mono text-[10px]"><span className="block text-white">{fnx}</span><span className="block text-slate-500">{inv}</span></span>
      <span className="truncate text-[11.5px] text-white">{kund}</span>
      <span className="text-right text-[11.5px] font-semibold text-white">{belopp}</span>
      <span><Status text={status} farg={farg} /><span className="block text-[9.5px] text-slate-500">{under}</span></span>
    </div>
  )
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[['Fakturerat', '57 125 kr'], ['Betalt', '30 500 kr'], ['Obetalt, ej förfallet', '8 750 kr'], ['Förfallet', '17 875 kr']].map(([r, s]) => (
          <div key={r} className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">{r}</p>
            <p className="text-[12.5px] font-bold text-white">{s}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-400">
        <span className="rounded-md border border-slate-700 px-2 py-0.5">Senaste 30 dagarna</span>
        <span className="rounded-md border border-slate-700 px-2 py-0.5">Alla · Obetalda · Förfallna · Betalda</span>
        <span>Visa makulerade (1)</span>
        <span className="inline-flex items-center gap-1"><Icon name="allman.ladda-ner" size={16} className="h-3 w-3" />Exportera</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
        <p className="bg-slate-800/40 px-2 py-1.5 text-[11.5px] font-semibold text-white">Oktober 2026</p>
        {rad('2026-10-27', '1234', 'INV-202610-0090', 'Brf Exempelgården', '30 500', 'Betald', 'bg-[#20c58f]', '2026-11-03')}
        {rad('2026-10-22', '1230', 'INV-202610-0085', 'Exempel AB', '8 750', 'Skickad', 'bg-sky-400', 'Obetald')}
        {rad('2026-10-01', '1201', 'INV-202609-0300', 'Exempel Fastigheter AB', '17 875', 'Förfallen 5 dagar', 'bg-red-400', 'Obetald')}
      </div>
    </div>
  )
}

function FakturaModal({ l, tryck, markera, nr }: Bas) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-2">
          <span className="flex items-baseline gap-2"><span className="font-mono text-sm font-semibold text-white">INV-202611-0120</span><Status text="Redo för Fortnox" farg="bg-sky-400" /></span>
          <button type="button" aria-label="Stäng" onClick={() => tryck('stang')} className="rounded p-1 text-slate-400 hover:text-white"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-slate-700/50 px-3 py-1.5 text-[10.5px] text-slate-400">
          <span>Skulle skickas <span className="font-mono text-white">2027-01-01</span></span>
          <span>Perioden börjar <span className="font-mono text-white">2027-01-01</span></span>
          <span>Förfaller om skickad idag <span className="font-mono text-white">2026-12-05</span></span>
        </div>
        <div className="grid gap-1 px-3 py-2 text-[11.5px] text-slate-300">
          <p className="text-[12px] font-semibold text-white">Exempel AB</p>
          <p className="flex justify-between"><span>Månadspremie, 2027-01-01 t.o.m. 2027-01-31</span><span>950 kr</span></p>
        </div>
        <div className="flex justify-end gap-1.5 border-t border-slate-700 bg-slate-800/50 px-3 py-2">
          <PKnapp prim ikon="allman.anteckning" onClick={() => tryck('utkast')} markor={mk(markera, 'utkast', nr)}>Skapa utkast i Fortnox</PKnapp>
          <PKnapp fara onClick={() => tryck('makulera')}>Makulera</PKnapp>
        </div>
      </div>
      {l.varning && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3">
          <div className="grid w-full max-w-sm gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white"><Icon name="rapport.avvikelse" size={16} className="text-orange-400" />Fakturan gäller januari 2027</p>
            <p className="text-[11px] text-slate-300">Månadsfakturor skickas den 1:a i den månad de gäller. Skickar du nu har kunden flera obetalda månadsfakturor samtidigt, och det kan se ut som dubbelfakturering.</p>
            <p className="rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1 text-[10.5px] text-slate-300">Ska skickas <span className="font-mono text-white">2027-01-01</span> · Idag <span className="font-mono text-white">2026-11-05</span>, 57 dagar före perioden</p>
            <div className="flex justify-end gap-1.5">
              <PKnapp onClick={() => tryck('vanta')} markor={mk(markera, 'vanta', nr)}>Vänta till 2027-01-01</PKnapp>
              <PKnapp onClick={() => tryck('skicka-anda')}>Skicka ändå</PKnapp>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  const flikar = ['Privat & Företag', 'Avtalskunder', 'Merförsäljning Avtal']
  return (
    <Dator adress="fakturering">
      <div className="relative min-h-[440px]">
        <DatorSida meny={['Översikt', 'Ärenden', 'Fakturering']} aktiv="Fakturering" titel="Fakturering">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b border-slate-700">
            <div className="flex gap-4">
              {flikar.map((f, i) => (
                <Markor key={f} markor={i === 1 ? mk(markera, 'flik-avtal', nr) : undefined}>
                  <button type="button" onClick={() => tryck(i === 1 ? 'flik-avtal' : `flik-${i}`)}
                    className={`-mb-px border-b-2 py-1.5 text-[12px] font-semibold ${l.flik === i ? 'border-[#20c58f] text-[#20c58f]' : 'border-transparent text-slate-400'}`}>{f}</button>
                </Markor>
              ))}
            </div>
            {l.flik === 1 && (
              <span className="mb-1 inline-flex overflow-hidden rounded-md border border-slate-700 text-[11px]">
                <button type="button" onClick={() => tryck('hantera')} className={`px-2 py-0.5 ${!l.arkiv ? 'bg-slate-800 font-semibold text-white' : 'text-slate-400'}`}>Att hantera</button>
                <Markor markor={mk(markera, 'arkiv', nr)}>
                  <button type="button" onClick={() => tryck('arkiv')} className={`border-l border-slate-700 px-2 py-0.5 ${l.arkiv ? 'bg-slate-800 font-semibold text-white' : 'text-slate-400'}`}>Arkiv</button>
                </Markor>
              </span>
            )}
          </div>
          {l.flik !== 1 ? (
            <p className="py-6 text-center text-[11.5px] text-slate-400">Tryck på fliken Avtalskunder.</p>
          ) : l.arkiv ? (
            <Arkiv />
          ) : (
            <div className="grid gap-2">
              <Nyckeltal />
              <Schema l={l} tryck={tryck} markera={markera} nr={nr} />
            </div>
          )}
        </DatorSida>
        {l.oppen && <FakturaModal l={l} tryck={tryck} markera={markera} nr={nr} />}
        {notis && <Notis text={notis} />}
      </div>
    </Dator>
  )
}

// ─── Visning ───

const AVTAL: Lage = { ...TOM, flik: 1 }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOM, markera: 'flik-avtal' },
  { lage: AVTAL, markera: 'grupp-forsenade' },
  { lage: { ...AVTAL, grupp: true }, markera: 'godkann-markerade' },
  { lage: { ...AVTAL, godkand: true }, markera: 'rad-manad' },
  { lage: { ...AVTAL, godkand: true, oppen: true }, markera: 'utkast' },
  { lage: { ...AVTAL, godkand: true, oppen: true, varning: true }, markera: 'vanta' },
  { lage: { ...AVTAL, godkand: true }, markera: 'arkiv' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Två avtalsfakturor är försenade. Godkänn båda på en gång.' }

const TIPS: Record<string, string> = {
  'flik-0': 'Privat & Företag är engångsärenden. Avtalsfakturorna ligger under Avtalskunder.',
  'flik-2': 'Merförsäljning Avtal är extraarbeten hos avtalskunder. Avtalsfakturorna ligger under Avtalskunder.',
  'rad-manad': 'Det är en månadsfaktura som ska skickas 2027-01-01. Uppdraget gäller de försenade.',
  'rad-brf': 'Raden öppnar fakturan. Bocka i rutan på gruppraden Försenade för att markera båda.',
  'rad-ab': 'Raden öppnar fakturan. Bocka i rutan på gruppraden Försenade för att markera båda.',
  'skicka-godkanda': 'Skicka godkända tar fakturor som redan är godkända. Godkänn de försenade först.',
  arkiv: 'Arkivet visar skickade fakturor. De försenade är inte skickade än.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(TOM)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [notis, setNotis] = useState<string | undefined>()
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    setNotis(undefined)
    if (id === 'flik-avtal') { setL({ ...l, flik: 1, arkiv: false }); tips('Faktureringsschemat', 'Hitta gruppen Försenade och markera hela gruppen.') }
    else if (id === 'hantera') setL({ ...l, arkiv: false })
    else if (id === 'grupp-forsenade' || id === 'ruta-brf' || id === 'ruta-ab') {
      setL({ ...l, grupp: !l.grupp })
      tips(l.grupp ? 'Avmarkerat' : 'Båda markerade', l.grupp ? 'Bocka i rutan på gruppraden Försenade igen.' : 'Knappraden visar 2 fakturor markerade. Godkänn dem.')
    } else if (id === 'godkann-markerade') {
      if (!l.grupp) miss('Inga fakturor är markerade än. Bocka i rutan på gruppraden Försenade först.')
      else {
        setL({ ...l, godkand: true, grupp: false }); setNotis('2 fakturor godkända'); setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Båda försenade fakturorna är godkända och kan skickas till Fortnox.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Gå till Avtalskunder, markera gruppen Försenade och godkänn.')
  }

  const framsteg = klar ? 3 : l.grupp ? 2 : l.flik === 1 ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={() => { setL(TOM); setSvar(BORJA); setFel(0); setNotis(undefined); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
