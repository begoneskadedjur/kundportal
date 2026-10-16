// src/pages/shared/intranet/guider/guide-fakturering-kontor.tsx
// Guidemodul: Fakturera från ärende till betalning (koordinator och admin, dator).
// Etiketterna kommer från src/pages/admin/invoicing/index.tsx (Fakturering, flikarna
// Privat & Företag, Avtalskunder, Merförsäljning Avtal), PrivateBusinessInvoicing
// (arbetskön Kräver godkännande, Redo för Fortnox, Förfallna, Fakturerat i <månad>,
// Sök fakturanr, kund..., Arkiv, Till Fortnox (n), radknapparna Godkänn/Detaljer/Makulera),
// InvoiceDetailModal (◔ Delfaktura, Att granska innan godkännande, Godkänn, Skapa utkast i
// Fortnox, Fortnox (nr ...), Synka, Exportera, Makulera) och InvoiceCaseChain (Ärendets
// fakturakedja). UnbilledAdhocBanner: Ofakturerad merförsäljning, Skapa faktura.
// Påhittade kunder, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Dator, DatorSida, Markor, Notis, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'

type FStatus = 'pending_approval' | 'ready' | 'draft' | 'sent'

const STATUS: Record<FStatus, { text: string; farg: string }> = {
  pending_approval: { text: 'Kräver godkännande', farg: 'bg-amber-400' },
  ready: { text: 'Redo för Fortnox', farg: 'bg-sky-400' },
  draft: { text: 'Utkast i Fortnox', farg: 'bg-orange-400' },
  sent: { text: 'Skickad', farg: 'bg-purple-400' },
}

interface Lage {
  flik: number
  filter: boolean
  arkiv: boolean
  oppen: boolean
  status: FStatus
}

const TOM: Lage = { flik: 0, filter: false, arkiv: false, oppen: false, status: 'pending_approval' }

type Bas = { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }

function Ko({ l, tryck, markera, nr }: Bas) {
  const vantar = l.status === 'pending_approval' ? 1 : 0
  const redo = 1 + (l.status === 'ready' ? 1 : 0)
  const cell = (id: string, rubrik: string, antal: number, summa: string, hint?: string, varn?: string) => (
    <Markor key={id} markor={mk(markera, id, nr)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`w-full border-b-2 px-3 py-2 text-left ${id === 'ko-godkannande' && l.filter ? 'border-b-[#20c58f]' : 'border-b-transparent'}`}>
        <span className="block text-[9.5px] uppercase tracking-wider text-slate-500">{rubrik}</span>
        <span className="block"><b className={`text-base ${antal > 0 && varn ? varn : 'text-white'}`}>{antal}</b><span className="text-[11px] text-slate-400"> · {summa}</span></span>
        {hint && <span className="block truncate text-[9.5px] text-slate-500">{hint}</span>}
      </button>
    </Markor>
  )
  return (
    <div className="grid grid-cols-2 divide-x divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 sm:grid-cols-4">
      {cell('ko-godkannande', 'Kräver godkännande', vantar, vantar ? '5 000 kr' : '0 kr', vantar ? 'äldsta väntar sedan 2026-10-14' : undefined, 'text-amber-400')}
      {cell('ko-redo', 'Redo för Fortnox', redo, redo === 2 ? '10 250 kr' : '5 250 kr', 'skapas som utkast, bokförs ej')}
      {cell('ko-forfallna', 'Förfallna', 0, '0 kr')}
      <div className="px-3 py-2">
        <span className="block text-[9.5px] uppercase tracking-wider text-slate-500">Fakturerat i oktober</span>
        <span className="block text-[13px] font-semibold text-slate-300">{l.status === 'sent' ? '5 000 kr' : '0 kr'}</span>
        <span className="block text-[9.5px] text-slate-500">avstämningstal · ej filter</span>
      </div>
    </div>
  )
}

interface FRow { id: string; nr: string; arende: string; kund: string; typ: string; belopp: string; status: FStatus }

function Lista({ l, tryck, markera, nr }: Bas) {
  const rader: FRow[] = [
    { id: 'fam', nr: 'INV-202610-0043', arende: 'BE-0002468', kund: 'Familjen Exempel', typ: 'Privat', belopp: '5 000 kr', status: l.status },
    { id: 'brf', nr: 'INV-202610-0040', arende: 'BE-0001234', kund: 'Brf Exempelgården', typ: 'Företag', belopp: '5 250 kr', status: 'ready' },
  ]
  const syns = rader.filter(r => {
    if (l.filter) return r.status === 'pending_approval'
    if (!l.arkiv) return r.status !== 'sent'
    return true
  })
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="grid grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr_70px] gap-2 bg-slate-900/80 px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Nr</span><span>Kund</span><span className="text-right">Belopp</span><span>Status</span><span />
      </div>
      {syns.length === 0 && <p className="px-3 py-4 text-center text-[12px] text-slate-400">Inget i arbetskön just nu</p>}
      {syns.map(r => (
        <div key={r.id} className="grid grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr_70px] items-center gap-2 border-t border-slate-800/60 px-3 py-1.5">
          <span><span className="block font-mono text-[11px] text-white">{r.nr}</span><span className="block font-mono text-[9.5px] text-slate-500">{r.arende}</span></span>
          <span><span className="block text-[12px] text-white">{r.kund}</span><span className="block text-[10.5px] text-slate-500">{r.typ}</span></span>
          <span className="text-right text-[12px] font-medium text-white">{r.belopp}</span>
          <Status text={STATUS[r.status].text} farg={STATUS[r.status].farg} />
          <span className="flex justify-end gap-0.5 text-slate-500">
            {r.status === 'pending_approval' && (
              <button type="button" title="Godkänn" aria-label="Godkänn" onClick={() => tryck(`godkann-${r.id}`)} className="rounded p-0.5 hover:text-[#20c58f]"><Icon name="allman.bock" size={16} /></button>
            )}
            {r.status !== 'sent' && (
              <button type="button" title="Makulera" aria-label="Makulera" onClick={() => tryck(`makulera-${r.id}`)} className="rounded p-0.5 hover:text-red-400"><Icon name="allman.stang" size={16} /></button>
            )}
            <Markor markor={mk(markera, `detaljer-${r.id}`, nr)}>
              <button type="button" title="Detaljer" aria-label="Detaljer" onClick={() => tryck(`detaljer-${r.id}`)} className="rounded p-0.5 hover:text-white"><Icon name="rapport.forhandsgranska" size={16} /></button>
            </Markor>
          </span>
        </div>
      ))}
      {!l.arkiv && !l.filter && (
        <p className="border-t border-slate-800 bg-slate-950/30 px-3 py-1.5 text-[10.5px] text-slate-500">
          {l.status === 'sent' ? 1 : 0} {l.status === 'sent' ? 'faktura' : 'fakturor'} i arkivet (bokförda, skickade, betalda)
        </p>
      )}
    </div>
  )
}

function FakturaModal({ l, tryck, markera, nr }: Bas) {
  const s = STATUS[l.status]
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
      <div className="grid w-full max-w-2xl gap-2 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm font-semibold text-white">INV-202610-0043</span>
            <span className="text-[11px] font-semibold text-teal-400">◔ Delfaktura</span>
            <span className="font-mono text-[11px] text-slate-400">BE-0002468</span>
            <Status text={s.text} farg={s.farg} />
          </div>
          <button type="button" aria-label="Stäng" onClick={() => tryck('stang')} className="rounded p-1 text-slate-400 hover:text-white"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="grid gap-2 px-3 sm:grid-cols-2">
          {l.status === 'pending_approval' ? (
            <div className="grid content-start gap-1 rounded-xl border border-orange-500/30 bg-slate-800/30 p-2">
              <p className="text-[12px] font-semibold text-white">Att granska innan godkännande</p>
              <div className="rounded-lg bg-slate-900/40 px-2 py-1">
                <p className="flex justify-between text-[11.5px] text-white"><span>Vägglusbekämpning</span><span className="text-orange-400">-10 %</span></p>
                <p className="text-[10.5px] text-slate-400">Rabatt given av Anna Exempel</p>
                <p className="text-[10.5px] italic text-slate-300">"Kunden fick vänta en vecka på första besöket."</p>
              </div>
            </div>
          ) : (
            <div className="grid content-start gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[11.5px] text-slate-300">
              <p className="text-[12px] font-semibold text-white">Fakturarader</p>
              <p className="flex justify-between"><span>Vägglusbekämpning</span><span>2 880 kr</span></p>
              <p className="flex justify-between"><span>Värmebehandling, tillägg</span><span>1 120 kr</span></p>
            </div>
          )}
          <div className="grid content-start gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
            <p className="text-[12px] font-semibold text-white">Ärendets fakturakedja</p>
            <p className="flex justify-between text-[11px]"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-teal-400" /><span className="font-mono text-white">INV-202610-0043</span><span className="text-teal-400">delfaktura</span></span><b className="text-white">5 000 kr</b></p>
            <p className="flex justify-between text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-500" />Slutfaktura, skapas vid avslut</span><span>·</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-slate-800/50 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            <PKnapp ikon="allman.ladda-ner" onClick={() => tryck('exportera')}>Exportera</PKnapp>
            {(l.status === 'draft' || l.status === 'sent') && <>
              <PKnapp onClick={() => tryck('fortnox-lank')} markor={mk(markera, 'fortnox-lank', nr)}>Fortnox (nr 1234)</PKnapp>
              <PKnapp ikon="allman.aterstall" onClick={() => tryck('synka')}>Synka</PKnapp>
            </>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {l.status === 'pending_approval' && <PKnapp ikon="allman.bock" onClick={() => tryck('godkann')} markor={mk(markera, 'godkann', nr)}>Godkänn</PKnapp>}
            {(l.status === 'pending_approval' || l.status === 'ready') && (
              <PKnapp prim ikon={l.status === 'pending_approval' ? 'allman.las' : 'allman.anteckning'} inaktiv={l.status === 'pending_approval'} onClick={() => tryck('utkast')} markor={mk(markera, 'utkast', nr)}>Skapa utkast i Fortnox</PKnapp>
            )}
            {l.status !== 'sent' && <PKnapp fara onClick={() => tryck('makulera')}>Makulera</PKnapp>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  const flikar = ['Privat & Företag', 'Avtalskunder', 'Merförsäljning Avtal']
  return (
    <Dator adress="fakturering">
      <div className="min-h-[430px]">
        <DatorSida meny={['Översikt', 'Ärenden', 'Fakturering']} aktiv="Fakturering" titel="Fakturering">
          <div className="mb-2 flex gap-4 border-b border-slate-700">
            {flikar.map((f, i) => (
              <Markor key={f} markor={i === 2 ? mk(markera, 'flik-merforsaljning', nr) : undefined}>
                <button type="button" onClick={() => tryck(i === 2 ? 'flik-merforsaljning' : `flik-${i}`)}
                  className={`-mb-px border-b-2 py-1.5 text-[12px] font-semibold ${l.flik === i ? 'border-[#20c58f] text-[#20c58f]' : 'border-transparent text-slate-400'}`}>{f}</button>
              </Markor>
            ))}
          </div>
          {l.flik === 2 ? (
            <div className="grid gap-2">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-300"><Icon name="rapport.avvikelse" size={16} />Ofakturerad merförsäljning, 1 ärende, 1 300 kr</p>
                <p className="mt-0.5 text-[10.5px] text-slate-400">Faktureringsrader utan koppling till någon faktura. Uppstår om fakturaskapandet misslyckades vid ärendeavslut.</p>
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1">
                  <span className="text-[12px] text-white">Exempel AB <span className="text-[10.5px] text-slate-400">1 rad · 1 300 kr</span></span>
                  <PKnapp prim ikon="allman.aterstall" onClick={() => tryck('skapa-faktura')}>Skapa faktura</PKnapp>
                </div>
              </div>
              <p className="text-[11.5px] text-slate-400">Fakturorna grupperas per månad.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Ko l={l} tryck={tryck} markera={markera} nr={nr} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => tryck('sok')} className="w-44 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-left text-[11.5px] text-slate-500">Sök fakturanr, kund...</button>
                <span className="flex-1" />
                <Markor markor={mk(markera, 'arkiv', nr)}>
                  <button type="button" aria-pressed={l.arkiv} onClick={() => tryck('arkiv')} className={`flex items-center gap-1.5 px-1.5 py-1 text-[12px] ${l.arkiv ? 'text-white' : 'text-slate-400'}`}>
                    <span className={`relative inline-flex h-3.5 w-6 rounded-full border ${l.arkiv ? 'border-[#20c58f] bg-[#20c58f]/30' : 'border-slate-600 bg-slate-800'}`}>
                      <span className={`absolute top-[2px] h-2 w-2 rounded-full ${l.arkiv ? 'left-[13px] bg-[#20c58f]' : 'left-[2px] bg-slate-500'}`} />
                    </span>
                    Arkiv
                  </button>
                </Markor>
                <PKnapp prim ikon="allman.ladda-ner" onClick={() => tryck('till-fortnox')}>Till Fortnox ({1 + (l.status === 'ready' ? 1 : 0)})</PKnapp>
              </div>
              <Lista l={l} tryck={tryck} markera={markera} nr={nr} />
            </div>
          )}
        </DatorSida>
      </div>
      {l.oppen && <FakturaModal l={l} tryck={tryck} markera={markera} nr={nr} />}
      {notis && <Notis text={notis} />}
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOM, markera: 'ko-godkannande' },
  { lage: { ...TOM, filter: true }, markera: 'detaljer-fam' },
  { lage: { ...TOM, filter: true, oppen: true }, markera: 'godkann' },
  { lage: { ...TOM, oppen: true, status: 'ready' }, markera: 'utkast' },
  { lage: { ...TOM, oppen: true, status: 'draft' }, markera: 'fortnox-lank' },
  { lage: { ...TOM, status: 'sent' }, markera: 'arkiv' },
  { lage: { ...TOM, status: 'sent', arkiv: true }, markera: 'flik-merforsaljning' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'En delfaktura till Familjen Exempel har rabatt och väntar på dig. Hitta den.' }

const TIPS: Record<string, string> = {
  'flik-1': 'Avtalskunder är årspremierna. Delfakturan till en privatkund ligger under Privat & Företag.',
  'flik-merforsaljning': 'Merförsäljning Avtal är extraarbeten hos avtalskunder. Familjen Exempel är privatkund.',
  'ko-redo': 'Redo för Fortnox är fakturor som redan är godkända. Familjen Exempels faktura väntar på godkännande.',
  'ko-forfallna': 'Förfallna är fakturor som passerat förfallodatum. Det gäller inte den här.',
  sok: 'Sökningen går bra, men fakturan syns redan i listan.',
  'detaljer-brf': 'Det är Brf Exempelgården. Uppdraget gäller Familjen Exempel.',
  'makulera-fam': 'Makulera stryker fakturan. Den ska godkännas, inte makuleras.',
  'makulera-brf': 'Makulera stryker fakturan. Låt den vara.',
  makulera: 'Makulera stryker fakturan. Den ska godkännas, inte makuleras.',
  'till-fortnox': 'Till Fortnox laddar ner en exportfil med fakturorna som är Redo för Fortnox. Uppdraget är att skapa utkastet direkt från fakturan.',
  exportera: 'Exportera laddar ner fakturan som fil. Den skickas inte till Fortnox.',
  arkiv: 'Arkivet visar bokförda, skickade och betalda fakturor. Den här är inte där än.',
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
    if (!l.oppen) {
      if (id === 'ko-godkannande') { setL({ ...l, filter: !l.filter }); tips(l.filter ? 'Filtret är av' : 'Bara det som väntar', l.filter ? 'Nu syns hela arbetskön igen.' : 'Öppna fakturan med ögat längst till höger på raden.') }
      else if (id === 'detaljer-fam') { setL({ ...l, oppen: true }); tips('Fakturan är öppen', l.status === 'pending_approval' ? 'Läs rabatten och motiveringen. Godkänn sedan.' : 'Den är godkänd. Skapa utkastet i Fortnox.') }
      else if (id === 'godkann-fam') {
        setL({ ...l, status: 'ready' }); setNotis('Faktura godkänd')
        tips('Godkänd i listan', 'Det går också. Öppna nu fakturan med ögat och skapa utkastet.')
      } else if (id === 'flik-0') tips('Privat & Företag', 'Du är redan här.')
      else miss(TIPS[id] ?? 'Leta efter Familjen Exempel i listan.')
      return
    }
    if (id === 'godkann') {
      setL({ ...l, status: 'ready' }); setNotis('Faktura godkänd inkl. rabatt')
      tips('Godkänd', 'Status är Redo för Fortnox och knappen Skapa utkast i Fortnox är upplåst.')
    } else if (id === 'utkast') {
      if (l.status === 'pending_approval') miss('Knappen är låst tills fakturan godkänts av faktureringsansvarig. Tryck Godkänn först.')
      else {
        setL({ ...l, status: 'draft' }); setNotis('Utkast skapat i Fortnox (nr 1234)'); setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Rabatten är godkänd och fakturan ligger som utkast i Fortnox, nummer 1234. Den är inte bokförd eller skickad än. Det gör du i Fortnox, och statusen följer sedan med till portalen.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else if (id === 'stang') {
      setL({ ...l, oppen: false }); tips('Fakturan stängd', 'Öppna den igen med ögat på raden.')
    } else miss(TIPS[id] ?? 'Godkänn fakturan och skapa sedan utkastet i Fortnox.')
  }

  const framsteg = klar ? 4 : l.status === 'ready' ? (l.oppen ? 3 : 2) : l.oppen ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(TOM); setSvar(BORJA); setFel(0); setNotis(undefined); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
