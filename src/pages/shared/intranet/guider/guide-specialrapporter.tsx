// src/pages/shared/intranet/guider/guide-specialrapporter.tsx
// Guidemodul: Skriv en specialrapport (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls så att länkar och läsloggen fungerar.
//
// Efterbildning av steget Rapport i EditCaseModal (HjalpText Rapport, Saneringsrapport,
// CaseSpecialReportsSection: Specialrapporter, "Ingen än. En fri rapport med delar,
// händelser och bilder.", plusknappen Skapa specialrapport), NewSpecialReportModal
// (Ny specialrapport, 1. Ärende, 2. Upplägg med Börja tomt, 3. Rapporten, Skapa rapport,
// toasten "Rapporten är skapad"), SpecialReportEditorPage (Klar att skicka, Rapportens
// delar, Om rapporten, Lägg till del, Sparad och klockslaget, Ny händelse, i telefonen
// flikarna Delar, Redigera och Visa som kund), AddSectionModal (Lägg till del, "Vad ska
// delen handla om? Du kan ändra det senare.", Område, Besök, Underleverantör, Fritt) och
// MobileAddEventSheet (Ny händelse, Del, Vad har du gjort?, Spara i rapporten, toasten
// "Händelsen är sparad i rapporten"). På datorn lägger Ny händelse till händelsen direkt
// i delen (EventsBlock).

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NyHjalp, NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { gorMk, ingenMk, type Mk, type Tryck } from './_arenden'
import { ArendeRam, KUND, NR } from './_nyvy_tickets'

type Vy = 'arende' | 'rapport' | 'ny' | 'editor' | 'laggtill' | 'del' | 'handelse' | 'sparad'

const TITEL = `Råttor hos ${KUND}`

// ─── Steget Rapport ───

function RapportSteg({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <div className="grid gap-2">
      <NyHjalp rubrik="Rapport">Skriv vad du gjorde i saneringsrapporten. Rapporten skickas inte av sig själv, ladda ned den eller skicka den med knapparna längst ner i steget.</NyHjalp>
      <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
        <p className="text-[11.5px] font-semibold text-white">Saneringsrapport</p>
        <p className="rounded-lg border border-slate-600 bg-slate-800/50 px-2 py-1.5 text-[11px] text-slate-500">Metoder, resultat, rekommendationer...</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
        <p className="flex flex-none items-center gap-1 text-[11.5px] font-semibold text-white"><Icon name="rapport.rapport" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Specialrapporter</p>
        <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-500">Ingen än. En fri rapport med delar, händelser och bilder.</p>
        <Markor markor={mk('sr-plus')}>
          <button type="button" onClick={() => tryck('sr-plus')} aria-label="Skapa specialrapport" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300"><Icon name="allman.plus" size={16} /></button>
        </Markor>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {(['Ladda ned', `Skicka till ${KUND}`] as const).map(t => (
          <button key={t} type="button" onClick={() => tryck('rapport-knapp')} className="flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-600 bg-slate-800/60 text-[11px] font-semibold text-white">{t}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Ny specialrapport ───

const UPPLAGG: { id: string; ikon: IconName; rubrik: string; text: string }[] = [
  { id: 'tom', ikon: 'rapport.tom', rubrik: 'Börja tomt', text: 'Lägg till delar efter hand' },
  { id: 'karta', ikon: 'rapport.omrade', rubrik: 'Börja med kartan', text: 'Varje område du ritar blir en del' },
  { id: 'per_besok', ikon: 'rapport.besok', rubrik: 'En del per besök', text: 'Ärendets besök hämtas in' },
  { id: 'kopia', ikon: 'rapport.kopia', rubrik: 'Utgå från tidigare rapport', text: 'Samma struktur, nya händelser' },
]

function NyRapport({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? '' : 'items-center justify-center p-3'}`}>
      <section className={`flex w-full flex-col overflow-hidden bg-slate-900 ${enhet === 'mobil' ? 'h-full' : 'max-h-full max-w-[460px] rounded-2xl border border-slate-700 shadow-2xl'}`}>
        <header className="flex items-start justify-between border-b border-slate-700 px-3 py-2">
          <div><p className="text-[13px] font-semibold text-white">Ny specialrapport</p><p className="text-[10px] text-slate-400">Koppla till ett ärende så hämtas kunden till rapporten</p></div>
          <button type="button" onClick={() => tryck('ny-stang')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </header>
        <div className="grid min-h-0 flex-1 content-start gap-2.5 overflow-hidden p-3">
          <p className="text-[9.5px] uppercase tracking-wider text-slate-500">1. Ärende</p>
          <div className="flex gap-2 rounded-xl border-[1.5px] border-[#20c58f] bg-[#20c58f]/5 p-2">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f] text-[#04140d]"><Icon name="rapport.lank" size={16} /></span>
            <div className="min-w-0 flex-1 text-[10.5px]">
              <p className="font-semibold text-white">{KUND} <span className="font-mono text-[10px] font-normal text-slate-400">{NR}</span></p>
              <p className="text-slate-400">Adress <span className="text-slate-200">Exempelvägen 4, Södertälje</span></p>
            </div>
            <button type="button" onClick={() => tryck('byt-arende')} aria-label="Byt ärende" className="self-start p-0.5 text-slate-400"><Icon name="allman.stang" size={16} className="h-3.5 w-3.5" /></button>
          </div>
          <p className="text-[9.5px] uppercase tracking-wider text-slate-500">2. Upplägg</p>
          <div className={`grid gap-1 ${enhet === 'dator' ? 'grid-cols-2' : ''}`}>
            {UPPLAGG.map(u => (
              <button key={u.id} type="button" aria-pressed={u.id === 'tom'} onClick={() => tryck(`upplagg-${u.id}`)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left ${u.id === 'tom' ? 'border-[#20c58f] bg-[#20c58f]/5' : 'border-slate-700/60 bg-slate-800/30'}`}>
                <Icon name={u.ikon} size={16} className={u.id === 'tom' ? 'text-[#20c58f]' : 'text-slate-400'} />
                <span className="min-w-0"><span className="block text-[11px] font-semibold text-slate-100">{u.rubrik}</span><span className="block truncate text-[9.5px] text-slate-400">{u.text}</span></span>
              </button>
            ))}
          </div>
          <p className="text-[9.5px] uppercase tracking-wider text-slate-500">3. Rapporten</p>
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <div><p className="mb-0.5 text-[10px] text-slate-400">Titel</p><p className="truncate rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] text-white">{TITEL}</p></div>
            <div><p className="mb-0.5 text-[10px] text-slate-400">Typ av rapport</p><p className="truncate rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] text-white">Saneringsrapport</p></div>
          </div>
          <p className="text-[9.5px] text-slate-500">Föreslagen utifrån ärendet</p>
        </div>
        <footer className="flex justify-end gap-1.5 border-t border-slate-700 px-3 py-2">
          <button type="button" onClick={() => tryck('ny-avbryt')} className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-[11px] font-medium text-white">Avbryt</button>
          <Markor markor={mk('skapa-rapport')}>
            <button type="button" onClick={() => tryck('skapa-rapport')} className="flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-1.5 text-[11px] font-semibold text-[#04281c]">Skapa rapport<Icon name="allman.chevron" size={16} className="h-3 w-3" /></button>
          </Markor>
        </footer>
      </section>
    </div>
  )
}

// ─── Redigeraren ───

function Editor({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const harDel = vy === 'del' || vy === 'handelse' || vy === 'sparad'
  const delOppen = harDel
  const harHandelse = vy === 'sparad' || (enhet === 'dator' && vy === 'handelse')

  const delar = (
    <div className="grid content-start gap-1.5">
      <div className="grid gap-1 rounded-xl border border-[#20c58f]/30 bg-[#20c58f]/5 p-2">
        <p className="text-[11px] font-bold text-white">Klar att skicka</p>
        <div className="h-1 rounded-full bg-[#20c58f]/20"><div className={`h-1 rounded-full bg-[#20c58f] ${harHandelse ? 'w-1/2' : harDel ? 'w-1/3' : 'w-1/6'}`} /></div>
      </div>
      <p className="text-[9.5px] uppercase tracking-wider text-slate-500">Rapportens delar</p>
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1">
        <p className="text-[11px] font-semibold text-white">Om rapporten</p>
        <p className="text-[9.5px] text-slate-400">Kund, adress och inledning</p>
      </div>
      {harDel && (
        <div className={`rounded-lg border px-2 py-1 ${delOppen ? 'border-[#20c58f]/50 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/30'}`}>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-white"><Icon name="rapport.besok" size={16} className="h-3.5 w-3.5 text-blue-400" />Besök</p>
          <p className="text-[9.5px] text-slate-400">{harHandelse ? '1 händelse' : 'Inga händelser än'}</p>
        </div>
      )}
      <Markor markor={mk('lagg-till-del')} block>
        <button type="button" onClick={() => tryck('lagg-till-del')} className="flex w-full items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-slate-600 px-2 py-1.5 text-[11px] text-slate-300">
          <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Lägg till del
        </button>
      </Markor>
    </div>
  )

  const delVy = (
    <div className="grid content-start gap-1.5 rounded-xl border border-slate-700 bg-slate-800/20 p-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400"><Icon name="rapport.besok" size={16} className="h-3.5 w-3.5" />Besök</p>
      <p className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-500">Rubrik</p>
      <p className="text-[10px] font-semibold text-slate-300">Händelser</p>
      {harHandelse ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-[10.5px]">
          <p className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${enhet === 'dator' ? 'bg-[#20c58f]' : 'bg-amber-500'}`} /><span className="font-mono text-slate-400">2026-10-26</span><span className="text-white">{enhet === 'dator' ? 'Besök' : 'Betning'}</span></p>
          <p className="text-slate-400">{enhet === 'dator' ? 'Skriv vad du gjorde.' : 'Betade i förrådet och längs husgrunden.'}</p>
        </div>
      ) : <p className="text-[10px] text-slate-500">Inga händelser än.</p>}
      {enhet === 'dator' && (
        <div className="flex items-center gap-1.5">
          <Markor markor={mk('ny-handelse')}>
            <button type="button" onClick={() => tryck('ny-handelse')} className="flex h-7 items-center gap-1 rounded-lg bg-[#20c58f] px-2 text-[11px] font-bold text-[#04140d]"><Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Ny händelse</button>
          </Markor>
          <button type="button" onClick={() => tryck('hamta')} className="flex h-7 items-center gap-1 px-1 text-[10.5px] text-slate-400"><Icon name="rapport.hamta" size={16} className="h-3.5 w-3.5" />Hämta från ärendet</button>
        </div>
      )}
    </div>
  )

  const huvud = (
    <div className="mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
      <button type="button" onClick={() => tryck('rapport-tillbaka')} aria-label="Tillbaka till ärendet" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300"><Icon name="rapport.tillbaka" size={16} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-white">{TITEL}</p>
        <p className="flex items-center gap-1 text-[9.5px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Sparad 07:52</p>
      </div>
      <button type="button" onClick={() => tryck('skicka-kund')} aria-label="Skicka till kund" className="flex h-7 items-center gap-1 rounded-lg border border-slate-600 px-2 text-[10.5px] text-white"><Icon name="rapport.skicka" size={16} className="h-3.5 w-3.5" />{enhet === 'dator' && 'Skicka till kund'}</button>
    </div>
  )

  if (enhet === 'dator') {
    return (
      <div className="h-full">
        {huvud}
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-2.5">
          {delar}
          {harDel ? delVy : <div className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-[10.5px] text-slate-500">Om rapporten: kund, adress och inledning</div>}
        </div>
      </div>
    )
  }
  const flik = harDel ? 'Redigera' : 'Delar'
  return (
    <div className="relative h-full">
      {huvud}
      {harDel ? delVy : delar}
      {(vy === 'del' || vy === 'sparad') && (
        <span className="absolute bottom-12 right-1">
          <Markor markor={mk('ny-handelse')}>
            <button type="button" onClick={() => tryck('ny-handelse')} className="flex h-9 items-center gap-1 rounded-xl bg-[#20c58f] px-3 text-[12px] font-bold text-[#04281c] shadow-lg"><Icon name="allman.plus" size={16} />Ny händelse</button>
          </Markor>
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 border-t border-slate-800 bg-slate-900">
        {([['Delar', 'allman.lista'], ['Redigera', 'allman.anteckning'], ['Visa som kund', 'rapport.forhandsgranska']] as const).map(([t, ikon]) => (
          <button key={t} type="button" onClick={() => tryck(`flik-${t}`)} className={`flex h-10 flex-col items-center justify-center text-[9.5px] ${t === flik ? 'font-bold text-[#20c58f]' : 'text-slate-400'}`}>
            <Icon name={ikon} size={16} className="h-3.5 w-3.5" />{t}
          </button>
        ))}
      </div>
    </div>
  )
}

function LaggTillDel({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const val: { id: string; ikon: IconName; rubrik: string; text: string; ton: string }[] = [
    { id: 'del-omrade', ikon: 'rapport.omrade', rubrik: 'Område', text: 'En plats du ritar på kartan, till exempel ett hus, en källare eller en del av tomten.', ton: 'bg-[#20c58f]/15 text-[#20c58f]' },
    { id: 'del-besok', ikon: 'rapport.besok', rubrik: 'Besök', text: 'Vad som gjordes en viss dag, oavsett var.', ton: 'bg-blue-500/15 text-blue-400' },
    { id: 'del-underlev', ikon: 'rapport.underlev', rubrik: 'Underleverantör', text: 'Arbete som någon annan utförde på vårt uppdrag, till exempel tätning.', ton: 'bg-orange-500/15 text-orange-400' },
    { id: 'del-fritt', ikon: 'rapport.text', rubrik: 'Fritt', text: 'Valfri rubrik med text och bilder.', ton: 'bg-slate-700/60 text-slate-300' },
  ]
  return (
    <Overlag mobilNer={enhet === 'mobil'} titel="Lägg till del" under="Vad ska delen handla om? Du kan ändra det senare.">
      <div className="grid gap-1">
        {val.map(v => (
          <Markor key={v.id} markor={mk(v.id)} block>
            <button type="button" onClick={() => tryck(v.id)} className="flex w-full items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-800/30 px-2 py-1.5 text-left">
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${v.ton}`}><Icon name={v.ikon} size={16} /></span>
              <span className="min-w-0"><span className="block text-[11.5px] font-semibold text-white">{v.rubrik}</span><span className="block text-[10px] leading-snug text-slate-400">{v.text}</span></span>
            </button>
          </Markor>
        ))}
      </div>
    </Overlag>
  )
}

function Overlag({ mobilNer, titel, under, children }: { mobilNer: boolean; titel: string; under?: string; children: ReactNode }) {
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${mobilNer ? 'items-end' : 'items-center justify-center p-3'}`}>
      <div className={`grid w-full gap-2 bg-slate-900 p-3 ${mobilNer ? 'rounded-t-2xl border-t border-slate-700' : 'max-w-[360px] rounded-2xl border border-slate-700 shadow-2xl'}`}>
        <div><p className="text-[13px] font-semibold text-white">{titel}</p>{under && <p className="text-[10.5px] text-slate-400">{under}</p>}</div>
        {children}
      </div>
    </div>
  )
}

const TYPER = ['Inspektion', 'Besök', 'Betning', 'Åtgärd', 'Notering', 'Avvikelse']

function NyHandelse({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <Overlag mobilNer titel="Ny händelse" under={`${TITEL} · ${NR}`}>
      <p className="text-[10.5px] font-medium text-slate-300">Del</p>
      <span className="w-fit rounded-lg border border-[#20c58f] bg-[#20c58f]/10 px-2 py-1 text-[10.5px] text-white">Besök</span>
      <p className="text-[10.5px] font-medium text-slate-300">Vad har du gjort?</p>
      <div className="grid grid-cols-3 gap-1">
        {TYPER.map(t => (
          <button key={t} type="button" onClick={() => tryck(`typ-${t}`)} className={`rounded-lg border px-1 py-1 text-[10.5px] ${t === 'Betning' ? 'border-[#20c58f] bg-[#20c58f]/10 text-white' : 'border-slate-700 text-slate-300'}`}>{t}</button>
        ))}
      </div>
      <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] text-white">Betning</p>
      <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] text-slate-300">Betade i förrådet och längs husgrunden.</p>
      <Markor markor={mk('spara-handelse')} block>
        <button type="button" onClick={() => tryck('spara-handelse')} className="flex h-9 w-full items-center justify-center rounded-xl bg-[#20c58f] text-[12px] font-semibold text-[#04281c]">Spara i rapporten</button>
      </Markor>
    </Overlag>
  )
}

function Skarm({ vy, mk, tryck, markor }: { vy: Vy; mk: Mk; tryck: Tryck; markor?: NyMarkor }) {
  const enhet = useGuideEnhet()
  if (vy === 'arende' || vy === 'rapport' || vy === 'ny') {
    return (
      <ArendeRam
        steg={vy === 'arende' ? 'framme' : 'rapport'}
        innehall={vy === 'arende' ? undefined : <RapportSteg mk={mk} tryck={tryck} />}
        markor={markor}
        onRam={tryck}
        mk={mk}
        tryck={tryck}
        ovanpa={vy === 'ny' ? <NyRapport mk={mk} tryck={tryck} /> : undefined}
      />
    )
  }
  return (
    <NySkarm sida="specialrapporter" titel="Specialrapporter" onRam={tryck}
      over={<>
        {vy === 'laggtill' && <LaggTillDel mk={mk} tryck={tryck} />}
        {vy === 'handelse' && enhet === 'mobil' && <NyHandelse mk={mk} tryck={tryck} />}
        {vy === 'editor' && <Notis text="Rapporten är skapad" />}
        {vy === 'sparad' && enhet === 'mobil' && <Notis text="Händelsen är sparad i rapporten" />}
      </>}>
      <Editor vy={vy} mk={mk} tryck={tryck} />
    </NySkarm>
  )
}

// ─── Visning ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arende', markera: 'steg:rapport' },
  { vy: 'rapport', markera: 'sr-plus' },
  { vy: 'ny', markera: 'skapa-rapport' },
  { vy: 'editor', markera: 'lagg-till-del' },
  { vy: 'laggtill', markera: 'del-besok' },
  { vy: 'del', markera: 'ny-handelse' },
  { vy: 'handelse', markera: 'spara-handelse' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  // På datorn finns ingen Spara i rapporten: händelsen ligger redan i delen och sparas medan du skriver
  if (enhet === 'dator' && v.vy === 'handelse') {
    return <Skarm vy="handelse" mk={() => undefined} tryck={() => onNasta()} />
  }
  const markor: NyMarkor | undefined = v.markera.startsWith('steg:') ? { pa: true, nr: steg + 1, mal: v.markera } : undefined
  return <Skarm vy={v.vy} mk={gorMk(v.markera, steg + 1)} markor={markor} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Ärendet hos Familjen Exempel är öppet. Skapa en specialrapport och lägg in dagens besök med betningen som en händelse.' }

const TIPS: Record<string, string> = {
  nasta: 'Jag är framme räknar arbetstiden i bakgrunden. Specialrapporten finns i steget Rapport, tryck på dess ikon i stegraden.',
  verktyg: 'Under Ärendets verktyg står Specialrapporter, och det valet leder till steget Rapport. Du kan också trycka på stegets ikon direkt.',
  flikvy: 'Alla uppgifter är den vanliga flikvyn. Specialrapporten finns i steget Rapport.',
  stang: 'Krysset stänger ärendet.',
  'steg:arbete': 'Det är steget Arbetet.',
  'steg:foton': 'Det är steget Foton och preparat.',
  'steg:pris': 'Det är steget Pris och fakturering.',
  'steg:klart': 'Det är steget Klart.',
  'rapport-knapp': 'De knapparna gäller saneringsrapporten.',
  'ny-avbryt': 'Avbryt stänger rutan och ingen rapport skapas.',
  'ny-stang': 'Krysset stänger rutan och ingen rapport skapas.',
  'byt-arende': 'Ärendet är rätt.',
  'upplagg-karta': 'Börja med kartan är för områden du ritar. Du ska lägga in ett besök, så Börja tomt räcker.',
  'upplagg-per_besok': 'En del per besök hämtar in ärendets besök. Här lägger du till delen själv.',
  'upplagg-kopia': 'Det finns ingen tidigare rapport att utgå från.',
  'rapport-tillbaka': 'Pilen går tillbaka till ärendet.',
  'skicka-kund': 'Rapporten är inte klar att skicka än.',
  'del-omrade': 'Område öppnar kartan. Dagens besök är en del av typen Besök.',
  'del-underlev': 'Underleverantör är arbete som någon annan gjorde.',
  'del-fritt': 'Fritt går också, men Besök passar för det som gjordes en viss dag.',
  hamta: 'Hämta från ärendet behövs inte nu.',
}

const FRAMSTEG: Record<Vy, number> = { arende: 0, rapport: 1, ny: 2, editor: 3, laggtill: 4, del: 5, handelse: 6, sparad: 7 }

function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>('arende')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); setSvar({ typ: 'tips', titel, text }) }
  const annars = (id: string, rad: string) => miss(TIPS[id] ? `${TIPS[id]} ${rad}` : (id.startsWith('flik-') ? `Flikarna byter vy i rapporten. ${rad}` : rad))
  const klart = () => {
    setVy('sparad')
    setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Rapporten har en del för besöket med betningen som händelse. Allt sparas medan du skriver, under titeln står Sparad och klockslaget.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
  }

  const tryck = (id: string) => {
    switch (vy) {
      case 'arende':
        if (id === 'steg:rapport') ga('rapport', 'Steget Rapport', 'Här står saneringsrapporten och rutan Specialrapporter. Tryck på plus i rutan.')
        else annars(id, 'Tryck på ikonen för Rapport i stegraden.')
        break
      case 'rapport':
        if (id === 'sr-plus') ga('ny', 'Ny specialrapport', 'Ärendet är valt och titeln ifylld. Börja tomt är valt. Tryck Skapa rapport.')
        else annars(id, 'Tryck på plus i rutan Specialrapporter.')
        break
      case 'ny':
        if (id === 'skapa-rapport') ga('editor', 'Rapporten är skapad', 'Redigeraren öppnades. Tryck Lägg till del.')
        else if (id === 'upplagg-tom') ga('ny', 'Börja tomt', 'Det är redan valt. Tryck Skapa rapport.')
        else annars(id, 'Tryck Skapa rapport.')
        break
      case 'editor':
        if (id === 'lagg-till-del') ga('laggtill', 'Lägg till del', 'Välj vad delen ska handla om.')
        else annars(id, 'Tryck Lägg till del.')
        break
      case 'laggtill':
        if (id === 'del-besok') ga('del', 'Delen Besök', enhet === 'dator' ? 'Delen öppnades till höger. Tryck Ny händelse i delen.' : 'Delen öppnades under Redigera. Tryck Ny händelse nere till höger.')
        else annars(id, 'Tryck Besök.')
        break
      case 'del':
        if (id === 'ny-handelse') {
          if (enhet === 'dator') klart()
          else ga('handelse', 'Ny händelse', 'Delen Besök är vald. Betning är vald under Vad har du gjort? Tryck Spara i rapporten.')
        } else annars(id, 'Tryck Ny händelse.')
        break
      case 'handelse':
        if (id === 'spara-handelse') klart()
        else if (id.startsWith('typ-')) setSvar({ typ: 'tips', titel: 'Det var betning', text: 'Betning är redan vald. Tryck Spara i rapporten.' })
        else annars(id, 'Tryck Spara i rapporten.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={enhet === 'dator' ? 6 : 7} svar={svar} onBorjaOm={() => { setVy('arende'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm vy={vy} mk={ingenMk} tryck={vy === 'sparad' ? () => {} : tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
