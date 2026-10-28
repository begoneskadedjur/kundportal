// src/pages/shared/intranet/guider/_avtalsforslag.tsx
// Delade delar för guiderna om att skapa ett avtalsförslag (guide-skapa-avtalsforslag för
// tekniker, guide-skapa-avtalsforslag-kontor för kontoret) och för rutan Befintlig kund
// som också visas i offertguiden (guide-skapa-avtal-offert).
//
// Efterbildning av OneflowContractCreator i avtalsläget (3.100.0):
//   stegen          Dokument, Mall, Avtalspart, Motpart, Kundgrupp, BeGone, Tjänster,
//                   Avtalsobjekt, Granska (CONTRACT_STEPS). Kundgrupp hoppas över när den
//                   kopplade kunden har en kundgrupp, stegraden visar då "Från kundkortet".
//   Motpart         AvtalsKundVal: "Befintlig kund", "Sök kund", "Namn, org.nr eller kundnummer",
//                   träffraden med Koppla, "Ingen kund hittades. Fyll i en ny kund nedan.",
//                   kopplad: "Kopplad till ..." (kopplingsText) med ikonknappen Koppla bort kunden,
//                   "Avtalet läggs på", "Vilka enheter omfattar avtalet?", Hela verksamheten,
//                   Bara huvudkontoret, kryss per enhet.
//   bottenlisten    getValidationHint: Fyll i företagsnamn, Fyll i organisationsnummer,
//                   Fyll i kontaktperson, Fyll i e-postadress, Välj vilka enheter avtalet omfattar,
//                   Välj en kundgrupp, Lägg till minst en tjänst. Knappen Granska avtalet.
//   Granska         Kontroll före utskick (kontrolleraAvtal), Skapa och visa Oneflows PDF,
//                   "Avtalet skapas som utkast i Oneflow. Inget skickas till kunden förrän du
//                   godkänt PDF:en."
//   utkastet        Så här ser kunden avtalet, Ser allt rätt ut?, Skicka för signering,
//                   Tillbaka och ändra, Spara som utkast
//   bekräftelsen    Avtalet är skickat, Skickat för signering
// Mallarna kommer från CONTRACT_TEMPLATES. Kundgrupperna är portalens namn.
// Påhittade kunder, ingenting skickas.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { CONTRACT_TEMPLATES } from '../../../../constants/oneflowTemplates'
import { AVTALETS_STANDARDTEXT, harStopp, kontrolleraAvtal, type KontrollAvsnitt } from '../../../../shared/avtalsKontroll'
import { Markor } from '../skarmkit'
import { Knapp, type Mk, type Tryck } from './_nyvy_salja'

// --- Data ---

/** Befintlig kund i visningen: huvudkontor med två enheter och kundgrupp på kundkortet */
export const ORG = {
  namn: 'Exempel AB',
  kundnr: '3512',
  orgnr: '556677-8899',
  adress: 'Exempelgatan 1, 123 45 Exempelstad',
  kontakt: 'Anna Exempel',
  tel: '070-123 45 67',
  epost: 'anna@exempel.se',
  grupp: 'Företag Privat lokalt',
}
export const ENHETER = [
  { namn: 'Exempel AB Göteborg', kod: 'GBG', adress: 'Hamngatan 2, 411 01 Göteborg' },
  { namn: 'Exempel AB Malmö', kod: 'MLM', adress: 'Storgatan 3, 211 01 Malmö' },
]

/** Ny kund i övningen */
export const NY = {
  namn: 'Brf Exempelgården',
  orgnr: '769600-1234',
  kontakt: 'Bo Exempel',
  tel: '070-765 43 21',
  epost: 'styrelsen@exempelgarden.se',
  grupp: 'BRF / Samfällighet',
}

export const TJANST = 'Skadedjursavtal Gnagare'
export const PREMIE = '8 400 kr'
export const MALL = '8486368'
const FORSLAG = `Tjänster som ingår:\n\n- ${TJANST}`

/** Kundgrupperna som de heter i portalen (customer_groups), i portalens ordning */
export const KUNDGRUPPER = [
  'BRF / Samfällighet',
  'Fastighetsbolag Bostad Regional',
  'Fastighetsbolag Bostad Riks',
  'Fastighetsbolag Kommersiell Regional',
  'HORECA Regional',
  'Företag Privat lokalt',
  'LOU Fastighetsbolag / Kommun',
  'Privatperson',
]

// --- Läget ---

export type AvtalVy = 'start' | 'ark' | 'dokument' | 'mall' | 'avtalspart' | 'motpart' | 'kundgrupp'
  | 'begone' | 'tjanster' | 'innehall' | 'granska' | 'pdf' | 'klart'

export type Sok = 'tom' | 'traff' | 'ingen'

export interface AvtalLage {
  vy: AvtalVy
  mall: string | null
  part: 'company' | 'individual'
  /** Kopplad till Exempel AB (befintlig kund) */
  kopplad: boolean
  sok: Sok
  /** Omfattningen för huvudkontoret med enheter */
  omf: null | 'alla' | 'hk'
  foretag: boolean
  orgnr: boolean
  namn: boolean
  tel: boolean
  epost: boolean
  grupp: string | null
  tjanst: boolean
  valjare: boolean
  /** Avtalsobjektet skrivet från tjänsterna i stället för standardtexten */
  forslag: boolean
}

export const AVTAL_BAS: AvtalLage = {
  vy: 'start', mall: null, part: 'company', kopplad: false, sok: 'tom', omf: null,
  foretag: false, orgnr: false, namn: false, tel: false, epost: false,
  grupp: null, tjanst: false, valjare: false, forslag: false,
}

/** Exempel AB kopplad, hela verksamheten, allt ifyllt */
export const AVTAL_KOPPLAD: AvtalLage = {
  ...AVTAL_BAS, mall: MALL, kopplad: true, omf: 'alla',
  foretag: true, orgnr: true, namn: true, tel: true, epost: true,
  grupp: ORG.grupp, tjanst: true, forslag: true,
}

export const AVTAL_STEGEN: { vy: AvtalVy; namn: string }[] = [
  { vy: 'dokument', namn: 'Dokument' },
  { vy: 'mall', namn: 'Mall' },
  { vy: 'avtalspart', namn: 'Avtalspart' },
  { vy: 'motpart', namn: 'Motpart' },
  { vy: 'kundgrupp', namn: 'Kundgrupp' },
  { vy: 'begone', namn: 'BeGone' },
  { vy: 'tjanster', namn: 'Tjänster' },
  { vy: 'innehall', namn: 'Avtalsobjekt' },
  { vy: 'granska', namn: 'Granska' },
]

/** Kundgruppen kom från kundkortet: steget hoppas över */
export const gruppFranKortet = (l: AvtalLage) => l.kopplad && l.grupp === ORG.grupp

const kund = (l: AvtalLage) => (l.kopplad ? ORG : NY)

export function avtalKontroll(l: AvtalLage) {
  const k = kund(l)
  return kontrolleraAvtal({
    dokumentTyp: 'contract',
    partTyp: 'company',
    foretag: l.foretag ? k.namn : '',
    orgNr: l.orgnr ? k.orgnr : '',
    kontaktperson: l.namn ? k.kontakt : '',
    epost: l.epost ? k.epost : '',
    telefon: l.tel ? k.tel : '',
    epostFaktura: '',
    avtalslangd: '1 år',
    startdatum: '2026-11-01',
    avtalsobjekt: l.forslag ? FORSLAG : AVTALETS_STANDARDTEXT,
    antalTjanster: l.tjanst ? 1 : 0,
  })
}

const AVSNITT: Record<KontrollAvsnitt, string> = { motpart: 'Motpart', avtalstid: 'BeGone', avtalsobjekt: 'Avtalsobjekt', tjanster: 'Tjänster' }

/** Bottenlistens tips, som getValidationHint i avtalsläget */
export function avtalTips(l: AvtalLage): string {
  if (l.vy === 'motpart') {
    if (!l.foretag) return 'Fyll i företagsnamn'
    if (!l.orgnr) return 'Fyll i organisationsnummer'
    if (!l.namn) return 'Fyll i kontaktperson'
    if (!l.epost) return 'Fyll i e-postadress'
    if (l.kopplad && l.omf === null) return 'Välj vilka enheter avtalet omfattar'
  }
  if (l.vy === 'kundgrupp' && !l.grupp) return 'Välj en kundgrupp'
  if (l.vy === 'tjanster' && !l.tjanst) return 'Lägg till minst en tjänst'
  return ''
}
export const avtalKanGaVidare = (l: AvtalLage) => !(l.vy === 'mall' && !l.mall) && avtalTips(l) === ''

/** Texten efter "Kopplad till", som kopplingsText */
export function kopplingsText(omf: AvtalLage['omf'], avtal: boolean): string {
  const bas = `${ORG.namn}, kundnr ${ORG.kundnr}`
  if (!avtal) return `${bas}, ${ENHETER.length} enheter`
  if (omf === 'alla') return `${bas}, hela verksamheten, ${ENHETER.length} enheter`
  if (omf === 'hk') return `${bas}, bara huvudkontoret`
  return `${bas}, ${ENHETER.length} enheter, välj omfattning`
}

// --- Delar ---

export function Falt({ id, etikett, varde, tom, under, tryck, mk }: { id: string; etikett: string; varde: string; tom?: boolean; under?: ReactNode; tryck: Tryck; mk: Mk }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[10px] font-bold text-slate-300">{etikett}</span>
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full truncate rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-left text-[11.5px] ${tom ? 'text-slate-500' : 'text-white'}`}>{varde}</button>
      </Markor>
      {under}
    </div>
  )
}

export function ValKort({ id, namn, text, vald, ikon, tryck, mk }: { id: string; namn: string; text?: string; vald: boolean; ikon?: IconName; tryck: Tryck; mk: Mk }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
        {ikon && <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-800 text-[#20c58f]"><Icon name={ikon} size={20} /></span>}
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-white">{namn}</span>
          {text && <span className="block text-[10px] leading-snug text-slate-400">{text}</span>}
        </span>
      </button>
    </Markor>
  )
}

export function StegRubrik({ nr, rubrik, text }: { nr: number; rubrik: string; text: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-[14px] text-emerald-400">{nr}</span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-tight text-white">{rubrik}</p>
        <p className="text-[10px] leading-snug text-slate-400">{text}</p>
      </div>
    </div>
  )
}

function Prick({ ton, children }: { ton: 'gul' | 'gron' | 'bla'; children: ReactNode }) {
  const farg = ton === 'gul' ? 'bg-amber-500' : ton === 'bla' ? 'bg-sky-400' : 'bg-[#20c58f]'
  return (
    <span className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-300">
      <span className={`mt-[4px] h-1.5 w-1.5 flex-none rounded-full ${farg}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

/**
 * Rutan Befintlig kund överst i Motpart (AvtalsKundVal). Används av avtalsguiderna och
 * offertguiden. Id: 'sok' (sökfältet), 'koppla' (träffraden), 'koppla-bort',
 * 'omf:alla', 'omf:hk', 'enhet:<kod>'.
 */
export function BefintligKund({ avtal, kopplad, sok, sokText, omf, tryck, mk }: {
  avtal: boolean; kopplad: boolean; sok: Sok; sokText?: string; omf?: AvtalLage['omf']; tryck: Tryck; mk: Mk
}) {
  const dok = avtal ? 'avtalet' : 'offerten'
  if (!kopplad) {
    return (
      <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f]/10 text-emerald-300"><Icon name="allman.sok" size={16} /></span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold text-white">Befintlig kund</span>
            <span className="block text-[10px] leading-snug text-slate-400">Sök i kundregistret, eller fyll i en ny kund nedan.</span>
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-300">Sök kund</span>
        <Markor markor={mk('sok')} block>
          <button type="button" onClick={() => tryck('sok')}
            className="flex w-full items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 px-2 py-1 text-left text-[11px]">
            <Icon name="allman.sok" size={16} className="h-3 w-3 flex-none text-slate-500" />
            <span className={`truncate ${sokText ? 'text-white' : 'text-slate-500'}`}>{sokText || 'Namn, org.nr eller kundnummer'}</span>
          </button>
        </Markor>
        {sok === 'traff' && (
          <Markor markor={mk('koppla')} block>
            <button type="button" onClick={() => tryck('koppla')}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/30 px-2 py-1.5 text-left">
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-semibold text-white">{ORG.namn}</span>
                <span className="block truncate text-[9.5px] text-slate-400">kundnr {ORG.kundnr} · {ORG.orgnr} · huvudkontor · {ORG.adress}</span>
              </span>
              <span className="inline-flex flex-none items-center gap-1 text-[10.5px] font-bold text-emerald-400"><Icon name="allman.plus" size={16} className="h-3 w-3" />Koppla</span>
            </button>
          </Markor>
        )}
        {sok === 'ingen' && <p className="text-[10px] text-slate-500">Ingen kund hittades. Fyll i en ny kund nedan.</p>}
      </div>
    )
  }

  const allaValda = omf === 'alla'
  return (
    <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f]/10 text-emerald-300"><Icon name="allman.foretag" size={16} /></span>
        <span className="min-w-0">
          <span className="block text-[12px] font-bold text-white">Befintlig kund</span>
          <span className="block text-[10px] leading-snug text-slate-400">Ändringar i fälten nedan gäller bara {dok}. Kundkortet ändras inte.</span>
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1.5 text-[11px] text-white">
          <span className="mt-[5px] h-1.5 w-1.5 flex-none rounded-full bg-[#20c58f]" />
          <span className="min-w-0">Kopplad till {kopplingsText(omf ?? null, avtal)}</span>
        </span>
        <Markor markor={mk('koppla-bort')}>
          <button type="button" onClick={() => tryck('koppla-bort')} aria-label="Koppla bort kunden" title="Koppla bort kunden"
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-800">
            <Icon name="allman.stang" size={16} />
          </button>
        </Markor>
      </div>
      <div className="grid gap-0.5">
        <span className="text-[10px] font-bold text-slate-300">{avtal ? 'Avtalet läggs på' : 'Offerten gäller'}</span>
        <button type="button" onClick={() => tryck('lagg-pa')}
          className="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-800/60 px-2 py-1 text-left text-[11px] text-white">
          <span className="truncate">Huvudkontoret, {ORG.namn}</span>
          <Icon name="allman.chevron" size={16} className="h-3 w-3 flex-none rotate-90 text-slate-500" />
        </button>
        <span className="text-[9.5px] text-slate-400">{avtal ? 'Avtalet läggs på huvudkontoret och omfattar enheterna du väljer nedan.' : 'Offerten ställs till huvudkontoret.'}</span>
      </div>
      {avtal && (
        <div className="grid gap-1">
          <span className="text-[10px] font-bold text-slate-300">Vilka enheter omfattar avtalet?</span>
          <div className="flex flex-wrap gap-1">
            {([['omf:alla', 'Hela verksamheten', allaValda], ['omf:hk', 'Bara huvudkontoret', omf === 'hk']] as const).map(([id, text, vald]) => (
              <Markor key={id} markor={mk(id)}>
                <button type="button" onClick={() => tryck(id)}
                  className={`rounded-lg px-2 py-1 text-[10.5px] font-bold ${vald ? 'border-2 border-[#20c58f] bg-[#20c58f]/10 text-emerald-300' : 'border border-slate-600 bg-slate-900 text-white'}`}>{text}</button>
              </Markor>
            ))}
          </div>
          {allaValda && <p className="text-[9.5px] text-slate-400">Avtalet omfattar alla nuvarande och framtida enheter.</p>}
          {[{ namn: 'Huvudkontoret', kod: '', adress: ORG.adress }, ...ENHETER].map(e => {
            const vald = allaValda || (omf === 'hk' && !e.kod)
            return (
              <button key={e.namn} type="button" onClick={() => tryck(`enhet:${e.kod || 'hk'}`)}
                className={`flex w-full items-start gap-1.5 rounded-lg border px-2 py-1 text-left ${vald ? 'border-[#20c58f]/50 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/20'} ${allaValda ? 'opacity-70' : ''}`}>
                <span className={`mt-[2px] flex h-3 w-3 flex-none items-center justify-center rounded-sm border ${vald ? 'border-[#20c58f] bg-[#20c58f] text-[#04281c]' : 'border-slate-500'}`}>
                  {vald && <Icon name="allman.bock" size={16} className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] text-white">{e.namn}{e.kod && <span className="text-slate-400">, enhetskod {e.kod}</span>}</span>
                  <span className="block truncate text-[9.5px] text-slate-400">{e.adress}</span>
                </span>
              </button>
            )
          })}
          {omf === null && <Prick ton="gul">Välj hela verksamheten, bara huvudkontoret eller kryssa i enheterna.</Prick>}
        </div>
      )}
    </div>
  )
}

/** Det mörka bandet överst i Skapa avtal eller offert, avtalsläget */
function Band({ l, procent, tryck }: { l: AvtalLage; procent: number; tryck: Tryck }) {
  const titel = l.vy === 'pdf' || l.vy === 'klart' ? `Avtal, ${kund(l).namn}` : 'Nytt avtal'
  const wizard = l.vy !== 'pdf' && l.vy !== 'klart'
  const aktivt = AVTAL_STEGEN.findIndex(s => s.vy === l.vy)
  return (
    <div className="flex-none bg-[#0e1c2b] px-2.5 pb-2 pt-2 text-[#e8eef4]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-[#20c58f] text-[#052e22]"><Icon name="rapport.rapport" size={16} className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <button type="button" onClick={() => tryck('band')} className="block text-[9.5px] text-[#8ea3b8]">Avtal &amp; Offerter</button>
            <p className="truncate text-[12.5px] font-semibold text-[#fff]">{titel}</p>
          </div>
        </div>
        {wizard ? (
          <span className="flex flex-none items-center gap-2 pt-1 text-[9.5px]">
            <span className="text-[#8ea3b8]">{procent} % klart</span>
            <button type="button" onClick={() => tryck('avbryt')} className="text-[#c9d6e2]">Avbryt</button>
          </span>
        ) : l.vy === 'pdf' ? (
          <span className="flex flex-none items-center gap-1 pt-1 text-[9.5px] text-[#c9d6e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />Utkast i Oneflow · ID 1234567</span>
        ) : null}
      </div>
      {wizard && (
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {AVTAL_STEGEN.map((s, i) => (
            <span key={s.vy} title={s.vy === 'kundgrupp' && gruppFranKortet(l) ? 'Kundgrupp, från kundkortet' : s.namn}
              className={`h-1 flex-1 rounded ${i <= aktivt ? 'bg-[#20c58f]' : 'bg-[#2a3d52]'}`} />
          ))}
        </div>
      )}
      {wizard && gruppFranKortet(l) && aktivt >= 3 && (
        <p className="mt-1 text-[9px] text-[#8ea3b8]">Kundgrupp: Från kundkortet</p>
      )}
    </div>
  )
}

const PUNKT_FARG = { rod: 'bg-red-500', gul: 'bg-amber-500', gron: 'bg-[#20c58f]' }

function Innehall({ l, tryck, mk }: { l: AvtalLage; tryck: Tryck; mk: Mk }) {
  const idx = AVTAL_STEGEN.findIndex(s => s.vy === l.vy) + 1
  const k = kund(l)
  switch (l.vy) {
    case 'dokument':
      return (
        <>
          <StegRubrik nr={1} rubrik="Vad ska du skapa?" text="Välj om kunden ska få ett avtalsförslag eller en offert." />
          <div className="grid gap-1.5">
            <ValKort id="typ:contract" namn="Avtalsförslag" text="Löpande avtal med årspremie. Kunden signerar i Oneflow." vald ikon="dok.avtal" tryck={tryck} mk={mk} />
            <ValKort id="typ:offer" namn="Offert" text="Engångsuppdrag med fast pris. Kunden godkänner i Oneflow." vald={false} ikon="dok.offert" tryck={tryck} mk={mk} />
          </div>
        </>
      )
    case 'mall':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Välj mall" text="Mallen styr avtalets fasta text i Oneflow." />
          <div className="grid gap-1">
            {CONTRACT_TEMPLATES.map(t => (
              <ValKort key={t.id} id={`mall:${t.id}`} namn={t.name} text={t.popular ? 'Mest använd' : undefined} vald={l.mall === t.id} ikon="dok.avtal" tryck={tryck} mk={mk} />
            ))}
          </div>
        </>
      )
    case 'avtalspart':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Vem är avtalspart?" text="Företag eller privatperson." />
          <div className="grid gap-1.5">
            <ValKort id="part:company" namn="Företag" text="Org.nr och kontaktperson hos bolaget." vald={l.part === 'company'} ikon="allman.foretag" tryck={tryck} mk={mk} />
            <ValKort id="part:individual" namn="Privatperson" text="Personnummer. ROT-avdrag kan bli aktuellt." vald={l.part === 'individual'} tryck={tryck} mk={mk} />
          </div>
        </>
      )
    case 'motpart':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Motpart" text="Välj en befintlig kund eller fyll i en ny. Uppgifterna gäller som de står i avtalet." />
          <div className="grid gap-1.5">
            <BefintligKund avtal kopplad={l.kopplad} sok={l.sok} sokText={l.sok === 'traff' ? 'Exempel' : l.sok === 'ingen' ? NY.namn : undefined} omf={l.omf} tryck={tryck} mk={mk} />
            <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
              <p className="text-[11px] font-semibold text-white">Bolaget</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Falt id="f:foretag" etikett="Företagsnamn" varde={l.foretag ? k.namn : 'Företaget AB'} tom={!l.foretag} tryck={tryck} mk={mk} />
                <Falt id="f:orgnr" etikett="Org.nr" varde={l.orgnr ? k.orgnr : '556123-4567'} tom={!l.orgnr} tryck={tryck} mk={mk} />
              </div>
              <p className="text-[11px] font-semibold text-white">Kontaktperson</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Falt id="f:namn" etikett="Namn" varde={l.namn ? k.kontakt : 'Förnamn Efternamn'} tom={!l.namn} tryck={tryck} mk={mk} />
                <Falt id="f:tel" etikett="Telefon" varde={l.tel ? k.tel : '070-123 45 67'} tom={!l.tel} tryck={tryck} mk={mk} />
                <Falt id="f:epost" etikett="E-post" varde={l.epost ? k.epost : 'namn@foretag.se'} tom={!l.epost} tryck={tryck} mk={mk} />
                <Falt id="f:faktura" etikett="E-post för faktura, valfritt" varde="faktura@foretag.se" tom tryck={tryck} mk={mk} />
              </div>
              <p className="text-[9.5px] text-slate-400">Lämnas det tomt fyller kunden i det vid signering.</p>
            </div>
          </div>
        </>
      )
    case 'kundgrupp':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Kundgrupp" text="Styr prislista och hur kunden följs upp. Kundnumret tilldelas vid signering." />
          {gruppFranKortet(l) && (
            <div className="mb-1.5 flex items-start gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 p-1.5 text-[10px] text-slate-200">
              <Icon name="kund.info" size={16} className="h-3.5 w-3.5 flex-none text-sky-400" />
              Förvald från kundkortet. Steget hoppas över när kunden har en kundgrupp, men du kan välja en annan här.
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            {KUNDGRUPPER.map(g => <ValKort key={g} id={`grupp:${g}`} namn={g} vald={l.grupp === g} tryck={tryck} mk={mk} />)}
          </div>
        </>
      )
    case 'begone':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Avtalstid och ansvarig" text="Vem som står på avtalet från Begone, och hur länge det gäller." />
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <Falt id="f:ansvarig" etikett="Ansvarig från BeGone" varde="Ditt namn" tryck={tryck} mk={mk} />
            <Falt id="f:ansvarig-epost" etikett="E-post ansvarig" varde="namn@begone.se" tryck={tryck} mk={mk} />
            <Falt id="f:langd" etikett="Avtalslängd" varde="1 år" tryck={tryck} mk={mk} />
            <Falt id="f:start" etikett="Startdatum" varde="2026-11-01" tryck={tryck} mk={mk} />
            <p className="col-span-2 text-[9.5px] text-slate-400">I avtalet: "inledande period om 1 år"</p>
          </div>
        </>
      )
    case 'tjanster':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Tjänster och pris" text="Det kunden betalar, och artiklarna som ingår internt." />
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="sok.faktura" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Tjänster &amp; fakturarader</p>
            {l.tjanst
              ? <p className="flex justify-between rounded-lg bg-slate-900 px-2 py-1.5 text-[11.5px] text-white"><span>{TJANST}</span><span className="font-semibold">{PREMIE}</span></p>
              : <p className="py-1 text-center text-[10.5px] text-slate-500">Inga tjänster tillagda än</p>}
            {l.valjare ? (
              <div className="grid gap-1">
                <p className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-500"><Icon name="allman.sok" size={16} className="h-3 w-3" />Sök tilläggstjänst...</p>
                {[{ id: 'tj:gnagare', namn: TJANST, pris: PREMIE }, { id: 'tj:geting', namn: 'Sanering Geting', pris: '2 750 kr' }].map(t => (
                  <Markor key={t.id} markor={mk(t.id)} block>
                    <button type="button" onClick={() => tryck(t.id)} className="flex w-full justify-between rounded-lg bg-slate-800/50 px-2 py-1 text-left text-[11px] text-white">
                      <span>{t.namn}</span><span className="text-[#20c58f]">{t.pris}</span>
                    </button>
                  </Markor>
                ))}
              </div>
            ) : (
              <Markor markor={mk('lagg-till')}>
                <button type="button" onClick={() => tryck('lagg-till')} className="flex items-center gap-1 text-[10.5px] text-slate-400"><Icon name="allman.plus" size={16} className="h-3 w-3" />Lägg till tilläggstjänst</button>
              </Markor>
            )}
          </div>
        </>
      )
    case 'innehall':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Avtalsobjekt" text="Vad som ingår, med kundens egna ord." />
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <p className="text-[10px] font-bold text-slate-300">Står under § 2 Avtalsobjekt</p>
            <Markor markor={mk('forslag')}>
              <button type="button" onClick={() => tryck('forslag')} className="inline-flex items-center gap-1 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/10 px-2 py-1 text-[10.5px] font-semibold text-[#20c58f]">
                <Icon name="allman.blixt" size={16} className="h-3 w-3" />Skriv förslag från tjänsterna
              </button>
            </Markor>
            <button type="button" onClick={() => tryck('textruta')} className="h-[64px] overflow-hidden whitespace-pre-line rounded-lg border border-slate-600 bg-slate-800/60 p-1.5 text-left text-[10px] leading-snug text-white">
              {l.forslag ? FORSLAG : AVTALETS_STANDARDTEXT}
            </button>
            <p className="text-[11px] font-semibold text-white">Villkor i portalen</p>
            <p className="text-[9.5px] text-slate-400">Styr bevakning och fakturering. Skickas inte till Oneflow och syns inte för kunden.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Falt id="f:uppsagning" etikett="Uppsägningstid" varde="3 månader" tryck={tryck} mk={mk} />
              <Falt id="f:intervall" etikett="Faktureringsintervall" varde="Årsvis (1 gång per år)" tryck={tryck} mk={mk} />
            </div>
          </div>
        </>
      )
    case 'granska': {
      const punkter = avtalKontroll(l)
      const stopp = harStopp(punkter)
      return (
        <>
          <p className="mb-1.5 text-[14px] font-semibold text-white">Granska avtalet</p>
          <div className="grid gap-1.5">
            <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2">
              <p className="text-[11.5px] font-bold text-white">Avtal, {k.namn}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kund</p>
              {l.kopplad
                ? <Prick ton="gron">Kopplad till {kopplingsText(l.omf, true)}</Prick>
                : <span className="flex items-start gap-1.5 text-[10px] text-slate-300"><span className="mt-[4px] h-1.5 w-1.5 flex-none rounded-full bg-slate-500" />Ny kund. Kunden läggs upp när avtalet signeras.</span>}
              <p className="text-[10.5px] font-bold text-white">2. Avtalsobjekt</p>
              <p className="line-clamp-2 whitespace-pre-line text-[10px] text-slate-300">{l.forslag ? FORSLAG : AVTALETS_STANDARDTEXT}</p>
              <p className="flex justify-between border-t border-slate-700 pt-1 text-[10.5px] text-white"><span>{l.tjanst ? TJANST : 'Inga tjänster är valda'}</span><span>{l.tjanst ? PREMIE : ''}</span></p>
              <p className="flex justify-between text-[10.5px] font-bold text-white"><span>Årspremie exkl. moms</span><span>{l.tjanst ? PREMIE : '0 kr'}</span></p>
            </div>
            <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
              <p className="text-[11.5px] font-bold text-white">Kontroll före utskick</p>
              <ul className="grid gap-0.5">
                {punkter.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className={`mt-[5px] h-1.5 w-1.5 flex-none rounded-full ${PUNKT_FARG[p.niva]}`} />
                    <span className="min-w-0">
                      <span className="block text-[10.5px] text-slate-100">{p.text}</span>
                      {p.niva !== 'gron' && (
                        <Markor markor={mk(`ratta:${p.avsnitt}`)}>
                          <button type="button" onClick={() => tryck(`ratta:${p.avsnitt}`)} className="text-[10px] font-semibold text-emerald-400">{p.niva === 'rod' ? 'Rätta' : 'Fyll i'} under {AVSNITT[p.avsnitt]}</button>
                        </Markor>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-slate-700/60 pt-1 text-[9.5px] text-slate-400">Röd punkt stoppar. Rätta först, sedan går det vidare.</p>
            </div>
            <Knapp id="skapa-pdf" text="Skapa och visa Oneflows PDF" prim full inaktiv={stopp} tryck={tryck} mk={mk} />
            <p className="text-[9.5px] text-slate-400">Avtalet skapas som utkast i Oneflow. Inget skickas till kunden förrän du godkänt PDF:en.</p>
          </div>
        </>
      )
    }
    case 'pdf':
      return (
        <>
          <p className="mb-1 text-[14px] font-semibold text-white">Så här ser kunden avtalet</p>
          <p className="mb-1 text-[9.5px] text-slate-400">Oneflows egen PDF, med mallens fasta text. Bläddra igenom och godkänn innan det skickas.</p>
          <div className="grid gap-1.5">
            <button type="button" onClick={() => tryck('pdf-yta')} className="grid gap-0.5 rounded bg-white p-2 text-left text-[9.5px] text-slate-700 shadow">
              <span className="text-[11px] font-bold text-slate-900">Skadedjursavtal</span>
              <span>Kund: {k.namn}, {k.orgnr}</span>
              <span className="font-semibold text-slate-900">§ 2 Avtalsobjekt</span>
              <span className="line-clamp-2 whitespace-pre-line">{l.forslag ? FORSLAG : AVTALETS_STANDARDTEXT}</span>
              <span className="flex justify-between border-t border-slate-200 pt-0.5"><span>Årspremie</span><span>{PREMIE}</span></span>
            </button>
            <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
              <p className="text-[11.5px] font-bold text-white">Ser allt rätt ut?</p>
              <Knapp id="skicka" text="Skicka för signering" prim full tryck={tryck} mk={mk} />
              <p className="text-[9.5px] text-slate-400">Skickas från info@begone.se till {k.epost}.</p>
              <div className="grid grid-cols-2 gap-1 border-t border-slate-700/60 pt-1">
                <Knapp id="andra" text="Tillbaka och ändra" full tryck={tryck} mk={mk} />
                <Knapp id="utkast" text="Spara som utkast" full tryck={tryck} mk={mk} />
              </div>
            </div>
          </div>
        </>
      )
    case 'klart':
      return (
        <div className="grid gap-1.5">
          <p className="text-[15px] font-semibold text-white">Avtalet är skickat</p>
          <p className="text-[10.5px] text-slate-400">Kunden har fått avtalet för signering från info@begone.se. Du skickas vidare till Dokumentsignering.</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2 text-[10.5px]">
            <span className="text-slate-400">Avtals-ID</span><span className="font-mono text-white">#1234567</span>
            <span className="text-slate-400">Status</span><span className="inline-flex items-center gap-1 text-white"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Skickat för signering</span>
          </div>
        </div>
      )
    default:
      return null
  }
}

/** Skapa avtal eller offert i avtalsläget: bandet, steget och bottenlisten */
export function AvtalWizard({ l, tryck, mk }: { l: AvtalLage; tryck: Tryck; mk: Mk }) {
  const total = AVTAL_STEGEN.length
  const idx = Math.max(1, AVTAL_STEGEN.findIndex(s => s.vy === l.vy) + 1)
  const procent = Math.round(((idx - 1) / total) * 100)
  const granska = l.vy === 'granska'
  const stopp = granska && harStopp(avtalKontroll(l))
  const hint = avtalTips(l)
  const visaLista = l.vy !== 'pdf' && l.vy !== 'klart'
  return (
    <div className="-m-2.5 flex h-[calc(100%+20px)] min-h-[380px] flex-col">
      <Band l={l} procent={procent} tryck={tryck} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-950/40 p-2.5"><Innehall l={l} tryck={tryck} mk={mk} /></div>
      {visaLista && (
        <div className="flex flex-none items-center justify-between gap-1.5 border-t border-slate-700 bg-slate-900/90 px-2.5 py-1.5">
          <Knapp id="tillbaka" text="Tillbaka" tryck={tryck} mk={mk} />
          <span className="min-w-0 flex-1 truncate text-center text-[10px]">
            {granska
              ? (stopp ? <span className="text-red-400">Rätta de röda punkterna först</span> : <span className="text-slate-400">Steg {idx} av {total}</span>)
              : hint ? <span className="text-amber-400">{hint}</span> : <span className="text-slate-400">Steg {idx} av {total}</span>}
          </span>
          {!granska && <Knapp id="nasta" text={l.vy === 'innehall' ? 'Granska avtalet' : 'Nästa'} prim inaktiv={!avtalKanGaVidare(l)} tryck={tryck} mk={mk} />}
        </div>
      )}
    </div>
  )
}

// --- Övningen: samma logik för tekniker och kontor ---

export interface AvtalSvar { typ: 'tips' | 'fel' | 'ok'; titel: string; text: string }

const FEL: Record<string, string> = {
  avbryt: 'Avbryt lämnar Skapa avtal eller offert och det du fyllt i försvinner. Fortsätt i stället.',
  band: 'Avtal & Offerter tar dig till Dokumentsignering. Gör klart avtalet först.',
  'part:individual': 'Brf Exempelgården är en bostadsrättsförening med org.nr. Behåll Företag.',
  'f:faktura': 'E-post för faktura är valfritt. Lämnas det tomt fyller kunden i det vid signering.',
  'f:ansvarig': 'Ditt namn står redan här. Tryck Nästa.',
  'f:ansvarig-epost': 'Din e-post står redan här. Tryck Nästa.',
  'f:langd': 'Avtalslängden är 1 år från början. Uppdraget säger inget annat, så tryck Nästa.',
  'f:start': 'Startdatumet står redan. Tryck Nästa.',
  'tj:geting': 'Sanering Geting är ett engångsjobb. Avtalet gäller löpande kontroll av gnagare.',
  'f:uppsagning': 'Uppsägningstiden syns bara i portalen. Den är redan ifylld. Tryck Granska avtalet.',
  'f:intervall': 'Faktureringsintervallet syns bara i portalen. Det är redan ifyllt. Tryck Granska avtalet.',
  'pdf-yta': 'Det här är Oneflows PDF. Ser den rätt ut skickar du med knappen under.',
  andra: 'Tillbaka och ändra tar bort utkastet i Oneflow. Allt stämmer, så skicka i stället.',
  utkast: 'Spara som utkast skickar inget. Uppdraget var att skicka avtalet nu.',
  'lagg-pa': 'Brf Exempelgården är ingen befintlig kund. Fyll i en ny kund.',
}

/** Ett tryck i övningen. Start och Skapa sköts av guiden, resten här. */
export function avtalOvningTryck(l: AvtalLage, id: string, fel: number): { lage?: AvtalLage; svar: AvtalSvar; miss?: boolean } | null {
  const ga = (vy: AvtalVy, extra: Partial<AvtalLage> = {}): AvtalLage => ({ ...l, ...extra, vy })
  const tips = (lage: AvtalLage, titel: string, text: string) => ({ lage, svar: { typ: 'tips' as const, titel, text } })
  const miss = (text: string) => ({ miss: true, svar: { typ: 'fel' as const, titel: 'Inte där', text } })

  if (FEL[id]) return miss(FEL[id])
  if (id === 'tillbaka') return miss('Tillbaka går ett steg bakåt. Du behöver inte gå tillbaka, fortsätt framåt.')

  switch (l.vy) {
    case 'dokument':
      if (id === 'typ:offer') return miss('Offert är för engångsjobb med fast pris. Brf Exempelgården ska ha ett löpande avtal, och Avtalsförslag är redan valt.')
      if (id === 'nasta' || id === 'typ:contract') return tips(ga('mall'), 'Välj mall', 'Välj Skadedjursavtal, den mest använda mallen.')
      return miss('Avtalsförslag är redan valt. Tryck Nästa.')
    case 'mall':
      if (id.startsWith('mall:')) {
        const mall = id.slice(5)
        if (mall === MALL) return tips(ga('mall', { mall }), 'Rätt mall', 'Tryck Nästa.')
        return miss('Uppdraget gäller ett vanligt skadedjursavtal. Välj Skadedjursavtal.')
      }
      if (id === 'nasta') {
        if (l.mall !== MALL) return miss('Välj Skadedjursavtal först.')
        return tips(ga('avtalspart'), 'Vem är avtalspart?', 'Föreningen har org.nr, alltså Företag. Det är redan valt. Tryck Nästa.')
      }
      return miss('Välj Skadedjursavtal och tryck Nästa.')
    case 'avtalspart':
      if (id === 'part:company') return tips(l, 'Företag är valt', 'Tryck Nästa.')
      if (id === 'nasta') return tips(ga('motpart'), 'Motpart', 'Sök först om föreningen redan är kund. Tryck i sökfältet under Befintlig kund.')
      return miss('Behåll Företag och tryck Nästa.')
    case 'motpart':
      if (id === 'sok') return tips(ga('motpart', { sok: 'ingen' }), 'Ingen kund hittades', 'Brf Exempelgården finns inte i kundregistret. Fyll i en ny kund i fälten nedan. Tryck på fälten.')
      if (id === 'f:foretag') return tips(ga('motpart', { foretag: true }), 'Företagsnamnet är ifyllt', 'Fyll i org.nr.')
      if (id === 'f:orgnr') return tips(ga('motpart', { orgnr: true }), 'Org.nr är ifyllt', 'Fyll i kontaktpersonens namn, telefon och e-post.')
      if (id === 'f:namn') return tips(ga('motpart', { namn: true }), 'Namnet är ifyllt', 'Fyll i telefon och e-post.')
      if (id === 'f:tel') return tips(ga('motpart', { tel: true }), 'Telefonen är ifylld', 'Bra, då kan du ringa om kunden inte signerar.')
      if (id === 'f:epost') return tips(ga('motpart', { epost: true }), 'E-posten är ifylld', 'Avtalet skickas dit. Tryck Nästa när allt är ifyllt.')
      if (id === 'nasta') {
        const h = avtalTips(l)
        if (h) return miss(`Det står ${h} i bottenlisten. Nästa går inte förrän det är ifyllt.`)
        return tips(ga('kundgrupp'), 'Kundgrupp', 'Föreningen är en ny kund, så du väljer kundgruppen. En bostadsrättsförening är BRF / Samfällighet. Är du osäker på kundgruppen, fråga Peter Bergqvist, peter.bergqvist@begone.se.')
      }
      return miss('Fyll i företagsnamn, org.nr, namn, telefon och e-post.')
    case 'kundgrupp':
      if (id.startsWith('grupp:')) {
        const grupp = id.slice(6)
        if (grupp === NY.grupp) return tips(ga('kundgrupp', { grupp }), 'Rätt kundgrupp', 'Tryck Nästa.')
        return miss('En bostadsrättsförening hör till BRF / Samfällighet. Är du osäker, fråga Peter Bergqvist, peter.bergqvist@begone.se.')
      }
      if (id === 'nasta') {
        if (!l.grupp) return miss('Det står Välj en kundgrupp. Välj BRF / Samfällighet.')
        return tips(ga('begone'), 'Avtalstid och ansvarig', 'Ditt namn, avtalslängd 1 år och startdatum står redan. Tryck Nästa.')
      }
      return miss('Välj BRF / Samfällighet och tryck Nästa.')
    case 'begone':
      if (id === 'nasta') return tips(ga('tjanster'), 'Tjänster och pris', 'Lägg till tjänsten för avtalet.')
      return miss('Tryck Nästa.')
    case 'tjanster':
      if (id === 'lagg-till') return tips(ga('tjanster', { valjare: true }), 'Sök tjänsten', `Välj ${TJANST} i listan.`)
      if (id === 'tj:gnagare') return tips(ga('tjanster', { tjanst: true, valjare: false }), 'Tjänsten är tillagd', `${TJANST}, ${PREMIE} per år. Tryck Nästa.`)
      if (id === 'nasta') {
        if (!l.tjanst) return miss('Det står Lägg till minst en tjänst. Tryck Lägg till tilläggstjänst.')
        return tips(ga('innehall'), 'Avtalsobjekt', 'Standardtexten står redan. Tryck Skriv förslag från tjänsterna så att texten stämmer med tjänsten.')
      }
      return miss('Lägg till tjänsten för avtalet.')
    case 'innehall':
      if (id === 'forslag') return tips(ga('innehall', { forslag: true }), 'Texten är skriven', 'Läs igenom och tryck Granska avtalet.')
      if (id === 'textruta') return tips(l, 'Egen text', 'Här kan du skriva vad som ingår med kundens egna ord. Enklast är Skriv förslag från tjänsterna.')
      if (id === 'nasta') return tips(ga('granska'), 'Kontroll före utskick', 'Gula punkter stoppar inte. Tryck Skapa och visa Oneflows PDF.')
      return miss('Tryck Granska avtalet.')
    case 'granska':
      if (id.startsWith('ratta:')) return miss('Gul punkt stoppar inte. Kunden kan fylla i det vid signeringen.')
      if (id === 'skapa-pdf') {
        if (harStopp(avtalKontroll(l))) return miss('Knappen fungerar inte så länge en punkt är röd.')
        return tips(ga('pdf'), 'Utkastet är skapat', 'Inget är skickat än. Titta på PDF:en och tryck Skicka för signering.')
      }
      return miss('Tryck Skapa och visa Oneflows PDF.')
    case 'pdf':
      if (id === 'skicka') {
        return {
          lage: ga('klart'),
          svar: {
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Avtalet med ${NY.namn} är skickat för signering från info@begone.se till ${NY.epost}. Du följer det under Dokumentsignering.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          },
        }
      }
      return miss('Tryck Skicka för signering.')
    default:
      return null
  }
}

export const AVTAL_ORDNING: AvtalVy[] = ['start', 'ark', 'dokument', 'mall', 'avtalspart', 'motpart', 'kundgrupp', 'begone', 'tjanster', 'innehall', 'granska', 'pdf', 'klart']
