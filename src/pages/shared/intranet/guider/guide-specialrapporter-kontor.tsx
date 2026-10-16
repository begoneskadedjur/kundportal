// src/pages/shared/intranet/guider/guide-specialrapporter-kontor.tsx
// Guidemodul: Granska och skicka en specialrapport (admin och koordinator, dator).
// Etiketterna kommer från CaseSpecialReportsSection (Specialrapporter,
// Ändrad sedan utskicket, Öppna rapporten, Ladda ner PDF med ändringarna),
// SpecialReportEditorPage (Snygga till hela rapporten, Ladda ner PDF, Skicka till kund,
// Klar att skicka, Rapportens delar, N ändringar gjorda, Ångra), ReportPreview
// (Så ser kunden rapporten, Hela PDF:en, Tryck på något på sidan för att redigera det),
// BedomningOchAtgarder, PolishReviewModal (Snygga till texten, Så blir texten,
// Använd N ändringar) och SendSpecialReportModal (Skicka rapporten till kunden, Till,
// kontakt på ärendet, Ämne, Meddelande, Bifogas mejlet, Versioner, Skickas nu,
// Nytt sedan version, Skicka version N, Version N är skickad).
// Påhittad kund och påhittade texter, ingenting sparas eller skickas.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import {
  ArendeHuvud, Dator, Falt, Flikar, IkonKnapp, Knapprad, Kort, Kryssruta, Markor, Notis, OvningRam, PKnapp, Rad, Status,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import { KlarAttSkicka, RapportensDelar, type Del, type KlarNyckel } from './_specialrapport'
import type { GuideModul } from './registry'

type Vy = 'arende' | 'editor' | 'samm' | 'polish' | 'hela' | 'skicka' | 'skickad'

interface Lage {
  vy: Vy
  bedomning: boolean
  snyggad: boolean
  sett: boolean
  notis: string | null
}

const DELAR: Del[] = [
  { nr: 1, titel: 'Förrådet', typ: 'Område', handelser: 3, farg: '#20c58f' },
  { nr: 2, titel: 'Källaren', typ: 'Område', handelser: 4, farg: '#3b82f6' },
  { nr: 3, titel: 'Tätning av fasaden', typ: 'Underleverantör', handelser: 1, farg: '#f59e0b' },
]
const BEDOMNING = 'Aktiviteten har minskat i förrådet. I källaren finns fortfarande spår vid tvättstugan.'

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function HuvudKnapp({ ikon, text, onClick, markor, gron }: { ikon: IconName; text: string; onClick: () => void; markor?: MarkorProps; gron?: boolean }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] ${gron ? 'border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-400' : 'border-slate-700 text-slate-200'}`}>
        <Icon name={ikon} size={16} />{text}
      </button>
    </Markor>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const klara: KlarNyckel[] = ['intro', 'delar', 'handelser', 'rekommendationer', ...(l.bedomning ? ['bedomning' as const] : [])]

  if (l.vy === 'arende') {
    return (
      <Dator adress="Ärenden">
        <div className="mx-auto max-w-xl">
          <ArendeHuvud nr="BE-0001234" status={<Status text="Pågående" />} kund="Brf Exempelgården · Exempelgatan 12, Solna"
            ikoner={<IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />} />
          <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={1} onClick={() => tryck('flik')} />
          <div className="m-2.5 grid gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white"><Icon name="rapport.rapport" size={16} className="text-[#20c58f]" />Specialrapporter <span className="font-normal text-slate-500">1</span></span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => tryck('rad')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="h-2 w-2 flex-none rounded-full bg-amber-400" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-100">Råttor hos Brf Exempelgården</span>
                  <span className="block truncate text-[11px] text-slate-400"><span className="text-amber-400">Ändrad sedan utskicket</span> · version 1 skickad 2026-10-02, ändrad 2026-10-15 av Anna Exempel · 3 delar, 8 händelser</span>
                </span>
              </button>
              <IkonKnapp ikon="rapport.ladda-pdf" etikett="Ladda ner PDF med ändringarna" onClick={() => tryck('pdf-lista')} />
              <IkonKnapp ikon="rapport.oppna" etikett="Öppna rapporten" onClick={() => tryck('oppna')} markor={mk(markera, 'oppna', nr)} />
            </div>
          </div>
          <Kort titel="Bilder" ikon="allman.foto"><Rad v="12 bilder" /></Kort>
        </div>
      </Dator>
    )
  }

  const skickad = l.vy === 'skickad'
  return (
    <Dator adress="Specialrapporter">
      {/* Rubrikraden */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-2 py-1.5">
        <button type="button" aria-label="Tillbaka till ärendet" onClick={() => tryck('tillbaka')} className="flex h-8 w-8 items-center justify-center text-slate-300"><Icon name="rapport.tillbaka" size={16} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">Råttor hos Brf Exempelgården</p>
          <p className="flex items-center gap-1.5 truncate text-[10.5px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Sparad 14:05 · Saneringsrapport · version {skickad ? 3 : 2} pågår</p>
        </div>
        <HuvudKnapp ikon="rapport.snygga" text="Snygga till hela rapporten" gron onClick={() => tryck('snygga')} markor={mk(markera, 'snygga', nr)} />
        <HuvudKnapp ikon="rapport.ladda" text="Ladda ner PDF" onClick={() => tryck('ladda')} />
        <Markor markor={mk(markera, 'skicka-huvud', nr)}>
          <button type="button" onClick={() => tryck('skicka-huvud')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#20c58f] px-2.5 text-[11.5px] font-semibold text-[#04140d]">
            <Icon name="rapport.skicka" size={16} />Skicka till kund
          </button>
        </Markor>
      </div>

      <div className="grid min-h-[360px] grid-cols-[170px_minmax(0,1fr)_170px]">
        <aside className="grid content-start gap-2 border-r border-slate-800 p-2">
          <KlarAttSkicka klara={klara} tryck={k => tryck(`klar-${k}`)} markor={markera === 'klar-bedomning' ? { key: 'bedomning', pa: true, nr } : undefined} />
          <RapportensDelar delar={DELAR} omraden={2} kartanMed tryck={tryck} nr={nr} />
        </aside>

        <main className="grid content-start gap-2 bg-slate-950 p-3">
          {l.vy === 'samm' ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6ee7b7]">Din slutsats till kunden</p>
              <p className="text-sm font-semibold text-white">Bedömning och åtgärder</p>
              <Falt etikett="Bedömning · Hur ser läget ut nu? Två eller tre meningar." varde={l.bedomning ? BEDOMNING : 'Hur ser läget ut nu?'} tom={!l.bedomning} onClick={() => tryck('bedomning-falt')} markor={mk(markera, 'bedomning-falt', nr)} />
              <Kort titel="Rekommenderade åtgärder" ikon="rapport.atgarder">
                <Rad v="1. Täta ventilen vid tvättstugan." />
                <Rad v="2. Flytta avfallskärlen från fasaden." />
                <Rad v="3. Håll förrådsdörren stängd." />
              </Kort>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Översiktskarta</p>
              <p className="text-[11px] text-slate-400">2 av 3 delar har ett ritat område. Varje område får sin egen färg, i kartan och i rapporten.</p>
              <div className="relative h-48 overflow-hidden rounded-xl border border-slate-700 bg-[linear-gradient(135deg,#3f4f3a,#55624a_40%,#47533f)]" aria-hidden>
                <span className="absolute left-[18%] top-[22%] h-16 w-24 rounded border-2 border-[#20c58f] bg-[#20c58f]/25" />
                <span className="absolute left-[55%] top-[45%] h-14 w-20 rounded border-2 border-[#3b82f6] bg-[#3b82f6]/25" />
              </div>
            </>
          )}
        </main>

        <aside className="grid content-start justify-items-center gap-2 border-l border-slate-800 bg-slate-950/40 p-2">
          <div className="flex w-full items-center gap-1 border-b border-slate-800 pb-1">
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200">Så ser kunden rapporten</span>
            <Markor markor={mk(markera, 'hela', nr)}>
              <button type="button" onClick={() => tryck('hela')} className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-700 px-1.5 text-[10.5px] text-slate-200">
                <Icon name="rapport.forhandsgranska" size={16} className="h-3.5 w-3.5" />Hela PDF:en
              </button>
            </Markor>
          </div>
          <button type="button" onClick={() => tryck('sida')} className="grid w-[130px] gap-1 rounded bg-white p-2 text-left shadow">
            <span className="h-1.5 w-10 rounded bg-[#20c58f]" />
            <span className="text-[9px] font-bold text-slate-900">Saneringsrapport</span>
            <span className="text-[7.5px] text-slate-600">Brf Exempelgården</span>
            <span className="h-10 rounded bg-slate-200" />
            <span className="h-1 w-full rounded bg-slate-200" /><span className="h-1 w-3/4 rounded bg-slate-200" />
          </button>
          <span className="text-center text-[10px] text-slate-500">Tryck på något på sidan för att redigera det</span>
        </aside>
      </div>

      {/* Snygga till */}
      {l.vy === 'polish' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="grid w-full max-w-2xl gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3.5">
            <div>
              <p className="text-sm font-bold text-white">Snygga till texten</p>
              <p className="text-xs text-slate-400">Hela rapporten. Inget ändras förrän du trycker Använd.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid content-start gap-1 rounded-lg border border-slate-700 p-2 text-xs leading-relaxed text-slate-200">
                <span className="text-[10.5px] uppercase tracking-wider text-slate-400">Så blir texten</span>
                <span>
                  <span className="bg-red-500/15 px-0.5 text-red-400 line-through">aktivitetn</span><span className="bg-emerald-500/15 px-0.5 text-emerald-400">Aktiviteten</span> har minskat i förrådet<span className="bg-emerald-500/15 px-0.5 text-emerald-400">.</span> I källaren finns <span className="bg-red-500/15 px-0.5 text-red-400 line-through">fortfarnde</span><span className="bg-emerald-500/15 px-0.5 text-emerald-400">fortfarande</span> spår vid tvättstugan.
                </span>
              </div>
              <div className="grid content-start gap-1 text-xs text-slate-200">
                <Kryssruta pa text="aktivitetn till Aktiviteten" onClick={() => tryck('kryss')} />
                <Kryssruta pa text="Punkt efter förrådet" onClick={() => tryck('kryss')} />
                <Kryssruta pa text="fortfarnde till fortfarande" onClick={() => tryck('kryss')} />
              </div>
            </div>
            <Knapprad>
              <PKnapp onClick={() => tryck('avbryt-polish')}>Avbryt</PKnapp>
              <PKnapp prim onClick={() => tryck('anvand')} markor={mk(markera, 'anvand', nr)}>Använd 3 ändringar</PKnapp>
            </Knapprad>
          </div>
        </div>
      )}

      {/* Hela PDF:en */}
      {l.vy === 'hela' && (
        <div className="absolute inset-0 z-20 grid grid-rows-[auto_1fr] bg-slate-950/95">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-white">Hela rapporten</span>
              <span className="block truncate text-[11px] text-slate-400">Förhandsvisning, den riktiga PDF:en skapas när du laddar ner eller skickar</span>
            </span>
            <span className="text-xs text-slate-300">Sida 1 av 6</span>
            <PKnapp ikon="rapport.ladda" onClick={() => tryck('ladda')}>Ladda ner PDF</PKnapp>
            <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka-hela')} markor={mk(markera, 'skicka-hela', nr)}>Skicka till kund</PKnapp>
            <IkonKnapp ikon="allman.stang" etikett="Stäng" onClick={() => tryck('stang-hela')} />
          </div>
          <div className="flex flex-wrap content-start justify-center gap-3 p-4">
            {['Framsida', 'Om rapporten', 'Översiktskarta', 'Förrådet', 'Källaren', 'Bedömning och åtgärder'].map(s => (
              <span key={s} className="grid h-32 w-24 content-start gap-1 rounded bg-white p-1.5 shadow">
                <span className="h-1 w-8 rounded bg-[#20c58f]" />
                <span className="text-[8px] font-bold text-slate-900">{s}</span>
                <span className="h-8 rounded bg-slate-200" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skicka */}
      {(l.vy === 'skicka') && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3">
          <div className="grid w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-700 px-3.5 py-2">
              <p className="text-sm font-bold text-white">Skicka rapporten till kunden</p>
              <p className="text-xs text-slate-400">Råttor hos Brf Exempelgården · version 2</p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_200px]">
              <div className="grid content-start gap-2 p-3">
                {!l.bedomning && (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-amber-400" />1 sak saknas: bedömning. Du kan ändå skicka rapporten.
                  </p>
                )}
                <div className="grid gap-1">
                  <span className="text-xs text-slate-300">Till</span>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">AE</span>
                    <span className="min-w-0"><span className="block text-xs text-white">Anna Exempel</span><span className="block truncate text-[10.5px] text-slate-400">anna@exempelgarden.se · kontakt på ärendet</span></span>
                  </div>
                </div>
                <Falt etikett="Ämne" varde="Rapport: Råttor hos Brf Exempelgården (BE-0001234)" onClick={() => tryck('amne')} />
                <Falt etikett="Meddelande" varde="Hej Anna, Här kommer en uppdaterad rapport. Sedan förra versionen har vi lagt till: ..." onClick={() => tryck('meddelande')} />
                <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/20 p-2">
                  <span className="flex h-8 w-7 items-end justify-center rounded bg-slate-100 pb-0.5 text-[8px] font-extrabold text-red-600">PDF</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs text-white">Råttor hos Brf Exempelgården, version 2.pdf</span><span className="block text-[10.5px] text-slate-400">Bifogas mejlet</span></span>
                </div>
              </div>
              <aside className="grid content-start gap-1.5 border-l border-slate-700/50 bg-slate-950/30 p-2.5 text-[11px]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Versioner</span>
                <div className="grid gap-0.5 rounded-lg border-[1.5px] border-[#20c58f] bg-[#20c58f]/5 p-2">
                  <span className="flex justify-between"><span className="font-bold text-white">Version 2</span><Status text="Skickas nu" /></span>
                  <span className="text-slate-400">Nytt sedan version 1:</span>
                  <span className="text-slate-300">Källaren: betning (2026-10-14)</span>
                  <span className="text-slate-300">Källaren: avvikelse (2026-10-15)</span>
                </div>
                <div className="rounded-lg border border-slate-700/50 p-2">
                  <span className="block font-semibold text-white">Version 1</span>
                  <Status text="Skickad 2026-10-02" farg="bg-[#20c58f]" />
                </div>
              </aside>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-700 px-3 py-2">
              <PKnapp ikon="rapport.ladda" onClick={() => tryck('ladda')}>Ladda ned PDF</PKnapp>
              <span className="flex-1" />
              <PKnapp onClick={() => tryck('avbryt-skicka')}>Avbryt</PKnapp>
              <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka-version')} markor={mk(markera, 'skicka-version', nr)}>Skicka version 2</PKnapp>
            </div>
          </div>
        </div>
      )}

      {l.notis && <Notis text={l.notis} />}
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'arende', bedomning: false, snyggad: false, sett: false, notis: null }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'oppna' },
  { lage: { ...BAS, vy: 'editor' }, markera: 'klar-bedomning' },
  { lage: { ...BAS, vy: 'samm', bedomning: true }, markera: 'snygga' },
  { lage: { ...BAS, vy: 'polish', bedomning: true }, markera: 'anvand' },
  { lage: { ...BAS, vy: 'samm', bedomning: true, snyggad: true }, markera: 'hela' },
  { lage: { ...BAS, vy: 'hela', bedomning: true, snyggad: true }, markera: 'skicka-hela' },
  { lage: { ...BAS, vy: 'skicka', bedomning: true, snyggad: true, sett: true }, markera: 'skicka-version' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet. Rapporten ligger i rutan Specialrapporter. Öppna den.' }

const TIPS: Record<string, string> = {
  historik: 'Klockan är ärendehistoriken. Öppna rapporten med pilen i rutan Specialrapporter.',
  flik: 'Du är redan på rätt flik.',
  'pdf-lista': 'Den knappen laddar ner PDF:en direkt. Du ska skriva bedömningen först, så öppna rapporten.',
  tillbaka: 'Pilen tar dig tillbaka till ärendet. Allt är sparat, men uppdraget är inte klart.',
  ladda: 'Ladda ner PDF ger dig filen. Uppdraget var att granska och sedan skicka.',
  sida: 'Ett tryck på sidan tar dig till rätt fält. Leta efter den grå raden i Klar att skicka i stället.',
  om: 'Inledningen är redan skriven. Det som saknas är grått i Klar att skicka.',
  oversikt: 'Kartan är klar. Det som saknas är grått i Klar att skicka.',
  'lagg-till-del': 'Rapporten har sina delar. Det som saknas är bedömningen.',
  'klar-intro': 'Den raden är grön, inledningen är klar. Leta efter den grå raden.',
  'klar-delar': 'Den raden är grön. Leta efter den grå raden.',
  'klar-handelser': 'Den raden är grön. Leta efter den grå raden.',
  'klar-rekommendationer': 'Den raden är grön. Leta efter den grå raden.',
  kryss: 'Alla tre förslagen är rätt. Låt kryssen stå och tryck Använd.',
  'avbryt-polish': 'Avbryt stänger rutan utan ändringar. Förslagen är rätt, använd dem.',
  'stang-hela': 'Du kan skicka direkt härifrån.',
  amne: 'Ämnet är förifyllt med titeln och ärendenumret. Det duger.',
  meddelande: 'Meddelandet räknar redan upp det som är nytt sedan version 1.',
  'avbryt-skicka': 'Avbryt stänger utan att skicka. Allt är klart, skicka.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const satt = (p: Partial<Lage>) => setL(x => ({ ...x, notis: null, ...p }))
  const oppnaSkicka = () => {
    satt({ vy: 'skicka' })
    tips('Utskicket', l.bedomning ? 'Mottagaren är förifylld med kontakten på ärendet. Skicka.' : 'Det står att bedömningen saknas. Uppdraget var att skriva den först.')
  }

  const tryck = (id: string) => {
    if (l.vy === 'skickad') return
    if (l.vy === 'arende') {
      if (id === 'oppna' || id === 'rad') { satt({ vy: 'editor' }); tips('Redigeraren', 'Klar att skicka visar vad som saknas. Leta efter den grå raden.') }
      else miss(TIPS[id] ?? 'Öppna rapporten med pilen.')
      return
    }
    if (l.vy === 'polish') {
      if (id === 'anvand') { satt({ vy: 'samm', snyggad: true, notis: '3 ändringar gjorda' }); tips('Ändringarna är gjorda', 'Ångra finns i rutan som kom upp. Granska nu hela PDF:en.') }
      else miss(TIPS[id] ?? 'Tryck Använd 3 ändringar.')
      return
    }
    if (l.vy === 'hela') {
      if (id === 'skicka-hela') oppnaSkicka()
      else if (id === 'stang-hela') { satt({ vy: 'samm' }); tips('Stängd', 'Skicka till kund finns i rubrikraden.') }
      else miss(TIPS[id] ?? 'Tryck Skicka till kund.')
      return
    }
    if (l.vy === 'skicka') {
      if (id === 'skicka-version') {
        if (!l.bedomning) { miss('Det går att skicka ändå, men uppdraget var att skriva bedömningen först. Tryck Avbryt och tryck på den grå raden i Klar att skicka.'); return }
        if (!l.sett) { miss('Granska hela PDF:en innan du skickar. Tryck Avbryt och sedan Hela PDF:en.'); return }
        satt({ vy: 'skickad', notis: 'Version 2 är skickad' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Version 2 är skickad till Anna Exempel med PDF:en bifogad. Den versionen är nu låst. Ändrar någon i rapporten blir det version 3.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'avbryt-skicka') { satt({ vy: l.bedomning ? 'samm' : 'editor' }); tips('Tillbaka i rapporten', l.bedomning ? 'Granska hela PDF:en.' : 'Tryck på den grå raden i Klar att skicka.') }
      else miss(TIPS[id] ?? 'Tryck Skicka version 2.')
      return
    }
    // Redigeraren
    if (id === 'klar-bedomning' || id === 'samm') { satt({ vy: 'samm' }); tips('Bedömning och åtgärder', 'Fältet Bedömning är tomt. Tryck i det och skriv.') }
    else if (id === 'bedomning-falt') { satt({ bedomning: true }); tips('Bedömningen är skriven', 'Klar att skicka visar 5 av 5. Granska hela PDF:en innan du skickar.') }
    else if (id === 'snygga') {
      if (!l.bedomning) miss('Skriv bedömningen först, så läses den också igenom.')
      else if (l.snyggad) tips('Redan genomläst', 'Texten är redan tillsnyggad. Granska hela PDF:en.')
      else { satt({ vy: 'polish' }); tips('Förslagen', 'Läs förslagen. Rött tas bort, grönt läggs till.') }
    } else if (id === 'hela') {
      satt({ vy: 'hela', sett: true }); tips('Hela PDF:en', 'Så här ser kunden rapporten. Skicka till kund finns uppe till höger.')
    } else if (id === 'skicka-huvud') oppnaSkicka()
    else if (id.startsWith('del-')) miss('Delarna är klara. Det som saknas är bedömningen, grått i Klar att skicka.')
    else miss(TIPS[id] ?? 'Leta efter den grå raden i Klar att skicka.')
  }

  const framsteg = l.vy === 'skickad' ? 6 : l.vy === 'skicka' && l.bedomning && l.sett ? 5 : l.sett ? 4 : l.bedomning ? 3 : l.vy === 'samm' ? 2 : l.vy === 'arende' ? 0 : 1
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
