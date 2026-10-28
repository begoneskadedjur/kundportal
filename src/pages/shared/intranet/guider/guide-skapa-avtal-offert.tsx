// src/pages/shared/intranet/guider/guide-skapa-avtal-offert.tsx
// Guidemodul: Skapa och skicka en offert (tekniker, nya arbetsvyn, telefon och dator).
// Avtalsförslaget har en egen guide: guide-skapa-avtalsforslag.
//
// Efterbildning av:
//   SkapaArk          Skapa > Vad vill du göra? > Avtal eller offert (/technician/oneflow)
//   OneflowContractCreator
//     bandet          Avtal & Offerter, Ny offert, "x % klart", Avbryt
//     stegen          Dokument, Mall, (Avtalspart), BeGone, Motpart, Tjänster, Offertinnehåll, Granska.
//                     Avtalspart döljs för offerter när mallen är vald (mallen bär kundtypen).
//     bottenlisten    Tillbaka, valideringstipset eller "Steg x av y", Nästa / Granska offerten
//     Granska         Kontroll före utskick (kontrolleraAvtal i src/shared/avtalsKontroll.ts,
//                     samma funktion som portalen), "Röd punkt stoppar. Rätta först, sedan går
//                     det vidare.", Skapa och visa Oneflows PDF
//     utkastet        Så här ser kunden offerten, Ser allt rätt ut?, Skicka offerten,
//                     Ändra i wizarden, Spara som utkast
//     bekräftelsen    Offerten är skickad, Skickat för granskning
//   CaseServiceSelector  Tjänster & fakturarader, Inga tjänster tillagda än, Lägg till tilläggstjänst
//   Motpart         rutan Befintlig kund (AvtalsKundVal, 3.100.0), ritad i _avtalsforslag.tsx
// Mallnamnen kommer från OFFER_TEMPLATES. Portalens tankstreck i namnen skrivs här med komma.
// Påhittad kund, ingenting skickas.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { OFFER_TEMPLATES } from '../../../../constants/oneflowTemplates'
import { kontrolleraAvtal, harStopp, AVTALSOBJEKT_MAX_TECKEN, type KontrollAvsnitt } from '../../../../shared/avtalsKontroll'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { Knapp, SkapaArket, ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'
import { BefintligKund, type Sok } from './_avtalsforslag'

// --- Data ---

const KUND = 'Familjen Exempel'
const TEL = '070-123 45 67'
const EPOST = 'familjen@exempel.se'
const TJANST = 'Sanering Geting'
const PRIS = '2 750 kr'
const FORSLAG = `Tjänster som ingår:\n\n- ${TJANST}`
const MALL_PRIVAT = '8919037'
const mallNamn = (namn: string) => namn.replace(/\s*\u2013\s*/g, ', ')

type Vy = 'start' | 'ark' | 'dokument' | 'mall' | 'begone' | 'motpart' | 'tjanster' | 'innehall' | 'granska' | 'pdf' | 'klart'

interface Lage {
  vy: Vy
  typ: 'contract' | 'offer'
  mall: string | null
  namn: boolean
  tel: boolean
  epost: boolean
  tjanst: boolean
  valjare: boolean
  text: boolean
  sok: Sok
}

const BAS: Lage = { vy: 'start', typ: 'contract', mall: null, namn: false, tel: false, epost: false, tjanst: false, valjare: false, text: false, sok: 'tom' }
const IFYLLD: Lage = { ...BAS, typ: 'offer', mall: MALL_PRIVAT, namn: true, tel: true, epost: true, tjanst: true, text: true }

const STEGEN: { vy: Vy; namn: string }[] = [
  { vy: 'dokument', namn: 'Dokument' },
  { vy: 'mall', namn: 'Mall' },
  { vy: 'begone', namn: 'BeGone' },
  { vy: 'motpart', namn: 'Motpart' },
  { vy: 'tjanster', namn: 'Tjänster' },
  { vy: 'innehall', namn: 'Offertinnehåll' },
  { vy: 'granska', namn: 'Granska' },
]

function kontroll(l: Lage) {
  return kontrolleraAvtal({
    dokumentTyp: 'offer',
    partTyp: 'individual',
    foretag: '',
    orgNr: '',
    kontaktperson: l.namn ? KUND : '',
    epost: l.epost ? EPOST : '',
    telefon: l.tel ? TEL : '',
    epostFaktura: '',
    avtalslangd: '',
    startdatum: '',
    avtalsobjekt: l.text ? FORSLAG : '',
    antalTjanster: l.tjanst ? 1 : 0,
  })
}

const AVSNITT: Record<KontrollAvsnitt, string> = { motpart: 'Motpart', avtalstid: 'BeGone', avtalsobjekt: 'Offertinnehåll', tjanster: 'Tjänster' }

/** Bottenlistens tips, som getValidationHint */
function tips(l: Lage): string {
  if (l.vy === 'dokument' && l.typ !== 'offer') return ''
  if (l.vy === 'mall' && !l.mall) return ''
  if (l.vy === 'motpart') {
    if (!l.namn) return 'Fyll i kontaktperson'
    if (!l.epost) return 'Fyll i e-postadress'
  }
  if (l.vy === 'tjanster' && !l.tjanst) return 'Lägg till minst en tjänst'
  return ''
}
const kanGaVidare = (l: Lage) => !(l.vy === 'mall' && !l.mall) && tips(l) === ''

// --- Delar ---

function Falt({ id, etikett, varde, tom, tryck, mk }: { id: string; etikett: string; varde: string; tom?: boolean; tryck: Tryck; mk: Mk }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[10px] font-bold text-slate-300">{etikett}</span>
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full truncate rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-left text-[11.5px] ${tom ? 'text-slate-500' : 'text-white'}`}>{varde}</button>
      </Markor>
    </div>
  )
}

function ValKort({ id, namn, text, vald, ikon, tryck, mk }: { id: string; namn: string; text?: string; vald: boolean; ikon: IconName; tryck: Tryck; mk: Mk }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-800 text-[#20c58f]"><Icon name={ikon} size={20} /></span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-white">{namn}</span>
          {text && <span className="block text-[10px] leading-snug text-slate-400">{text}</span>}
        </span>
      </button>
    </Markor>
  )
}

/** Det mörka bandet överst i wizarden */
function Band({ l, procent, tryck }: { l: Lage; procent: number; tryck: Tryck }) {
  const titel = l.vy === 'pdf' || l.vy === 'klart' ? `Offert, ${KUND}` : l.typ === 'offer' ? 'Ny offert' : 'Nytt avtal'
  const wizard = l.vy !== 'pdf' && l.vy !== 'klart'
  const aktivt = STEGEN.findIndex(s => s.vy === l.vy)
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
          {STEGEN.map((s, i) => <span key={s.vy} title={s.namn} className={`h-1 flex-1 rounded ${i <= aktivt ? 'bg-[#20c58f]' : 'bg-[#2a3d52]'}`} />)}
        </div>
      )}
    </div>
  )
}

function StegRubrik({ nr, rubrik, text }: { nr: number; rubrik: string; text: string }) {
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

const PUNKT_FARG = { rod: 'bg-red-500', gul: 'bg-amber-500', gron: 'bg-[#20c58f]' }

function Innehall({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const idx = STEGEN.findIndex(s => s.vy === l.vy) + 1
  switch (l.vy) {
    case 'dokument':
      return (
        <>
          <StegRubrik nr={1} rubrik="Vad ska du skapa?" text="Välj om kunden ska få ett avtalsförslag eller en offert." />
          <div className="grid gap-1.5">
            <ValKort id="typ:contract" namn="Avtalsförslag" text="Löpande avtal med årspremie. Kunden signerar i Oneflow." vald={l.typ === 'contract'} ikon="dok.avtal" tryck={tryck} mk={mk} />
            <ValKort id="typ:offer" namn="Offert" text="Engångsuppdrag med fast pris. Kunden godkänner i Oneflow." vald={l.typ === 'offer'} ikon="dok.offert" tryck={tryck} mk={mk} />
          </div>
        </>
      )
    case 'mall':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Välj mall" text="Mallen styr offertens fasta text i Oneflow." />
          <div className="grid gap-1">
            {OFFER_TEMPLATES.map(t => (
              <ValKort key={t.id} id={`mall:${t.id}`} namn={mallNamn(t.name)} text={t.category === 'company' ? 'Företag' : 'Privatperson'} vald={l.mall === t.id} ikon="dok.offert" tryck={tryck} mk={mk} />
            ))}
          </div>
        </>
      )
    case 'begone':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Ansvarig" text="Vem som står på offerten från Begone." />
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <Falt id="f:ansvarig" etikett="Ansvarig från BeGone" varde="Ditt namn" tryck={tryck} mk={mk} />
            <Falt id="f:ansvarig-epost" etikett="E-post ansvarig" varde="namn@begone.se" tryck={tryck} mk={mk} />
          </div>
        </>
      )
    case 'motpart':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Motpart" text="Välj en befintlig kund eller fyll i en ny. Uppgifterna gäller som de står i offerten." />
          <div className="mb-1.5"><BefintligKund avtal={false} kopplad={false} sok={l.sok} sokText={l.sok === 'ingen' ? KUND : undefined} tryck={tryck} mk={mk} /></div>
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <p className="text-[11px] font-semibold text-white">Privatpersonen</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Falt id="f:namn" etikett="Namn" varde={l.namn ? KUND : 'Förnamn Efternamn'} tom={!l.namn} tryck={tryck} mk={mk} />
              <Falt id="f:pnr" etikett="Personnummer" varde="ÅÅÅÅMMDD-XXXX" tom tryck={tryck} mk={mk} />
            </div>
            <p className="text-[11px] font-semibold text-white">Kontaktuppgifter</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Falt id="f:tel" etikett="Telefon" varde={l.tel ? TEL : '070-123 45 67'} tom={!l.tel} tryck={tryck} mk={mk} />
              <Falt id="f:epost" etikett="E-post" varde={l.epost ? EPOST : 'namn@exempel.se'} tom={!l.epost} tryck={tryck} mk={mk} />
            </div>
            <Falt id="f:faktura" etikett="E-post för faktura" varde="namn@exempel.se" tom tryck={tryck} mk={mk} />
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
              ? <p className="flex justify-between rounded-lg bg-slate-900 px-2 py-1.5 text-[11.5px] text-white"><span>{TJANST}</span><span className="font-semibold">{PRIS}</span></p>
              : <p className="py-1 text-center text-[10.5px] text-slate-500">Inga tjänster tillagda än</p>}
            {l.valjare ? (
              <div className="grid gap-1">
                <p className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-500"><Icon name="allman.sok" size={16} className="h-3 w-3" />Sök tilläggstjänst...</p>
                {[{ id: 'tj:geting', namn: TJANST, pris: PRIS }, { id: 'tj:inspektion', namn: 'Inspektion', pris: '1 200 kr' }].map(t => (
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
    case 'innehall': {
      const text = l.text ? FORSLAG : ''
      return (
        <>
          <StegRubrik nr={idx} rubrik="Offertinnehåll" text="Vad arbetet omfattar, med kundens egna ord." />
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <p className="text-[10px] font-bold text-slate-300">Offertinnehåll, arbetsbeskrivningen i offerten</p>
            <Markor markor={mk('forslag')}>
              <button type="button" onClick={() => tryck('forslag')} className="inline-flex items-center gap-1 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/10 px-2 py-1 text-[10.5px] font-semibold text-[#20c58f]">
                <Icon name="allman.blixt" size={16} className="h-3 w-3" />Skriv förslag från tjänsterna
              </button>
            </Markor>
            <button type="button" onClick={() => tryck('textruta')} className={`h-[72px] overflow-hidden whitespace-pre-line rounded-lg border border-slate-600 bg-slate-800/60 p-1.5 text-left text-[10.5px] leading-snug ${text ? 'text-white' : 'text-slate-500'}`}>
              {text || 'Beskriv arbetet med kundens egna ord'}
            </button>
            <p className="text-[9.5px] text-slate-400">{text.length.toLocaleString('sv-SE')} av {AVTALSOBJEKT_MAX_TECKEN.toLocaleString('sv-SE')} tecken</p>
          </div>
        </>
      )
    }
    case 'granska': {
      const punkter = kontroll(l)
      const stopp = harStopp(punkter)
      return (
        <>
          <p className="text-[9.5px] text-slate-400">Steg 7 av 7</p>
          <p className="mb-1.5 text-[14px] font-semibold text-white">Granska offerten</p>
          <div className="grid gap-1.5">
            <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2">
              <p className="text-[11.5px] font-bold text-white">Offert, {l.namn ? KUND : 'kund'}</p>
              <p className="text-[10.5px] font-bold text-white">Offertinnehåll</p>
              {l.text
                ? <p className="whitespace-pre-line text-[10px] text-slate-300">{FORSLAG}</p>
                : <p className="rounded border border-dashed border-red-500 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">Offertinnehållet är tomt.</p>}
              <p className="flex justify-between border-t border-slate-700 pt-1 text-[10.5px] text-white"><span>{l.tjanst ? TJANST : 'Inga tjänster är valda'}</span><span>{l.tjanst ? PRIS : ''}</span></p>
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
          </div>
        </>
      )
    }
    case 'pdf':
      return (
        <>
          <p className="mb-1 text-[14px] font-semibold text-white">Så här ser kunden offerten</p>
          <div className="grid gap-1.5">
            <button type="button" onClick={() => tryck('pdf-yta')} className="grid gap-0.5 rounded bg-white p-2 text-left text-[9.5px] text-slate-700 shadow">
              <span className="text-[11px] font-bold text-slate-900">Offert</span>
              <span>Kund: {KUND}</span>
              <span className="whitespace-pre-line">{FORSLAG}</span>
              <span className="flex justify-between border-t border-slate-200 pt-0.5"><span>{TJANST}</span><span>{PRIS}</span></span>
            </button>
            <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
              <p className="text-[11.5px] font-bold text-white">Ser allt rätt ut?</p>
              <Knapp id="skicka" text="Skicka offerten" prim full tryck={tryck} mk={mk} />
              <p className="text-[9.5px] text-slate-400">Skickas från info@begone.se till {EPOST}.</p>
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
          <p className="text-[15px] font-semibold text-white">Offerten är skickad</p>
          <p className="text-[10.5px] text-slate-400">Kunden har fått offerten för granskning från info@begone.se. Du skickas vidare till Dokumentsignering.</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2 text-[10.5px]">
            <span className="text-slate-400">Offert-ID</span><span className="font-mono text-white">#1234567</span>
            <span className="text-slate-400">Status</span><span className="inline-flex items-center gap-1 text-white"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Skickat för granskning</span>
          </div>
        </div>
      )
    default:
      return null
  }
}

function Wizard({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const total = l.typ === 'contract' ? 9 : l.mall ? 7 : 8
  const idx = Math.max(1, STEGEN.findIndex(s => s.vy === l.vy) + 1)
  const procent = Math.round(((idx - 1) / total) * 100)
  const granska = l.vy === 'granska'
  const stopp = granska && harStopp(kontroll(l))
  const hint = tips(l)
  const visaLista = l.vy !== 'pdf' && l.vy !== 'klart'
  return (
    <div className="-m-2.5 flex h-[calc(100%+20px)] min-h-[360px] flex-col">
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
          {!granska && <Knapp id="nasta" text={l.vy === 'innehall' ? 'Granska offerten' : 'Nästa'} prim inaktiv={!kanGaVidare(l)} tryck={tryck} mk={mk} />}
        </div>
      )}
    </div>
  )
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'start' || l.vy === 'ark') {
    return (
      <NySkarm sida="idag" titel="Idag" under="Måndag 26 oktober, 3 besök" onRam={tryck}
        over={l.vy === 'ark' ? <SkapaArket tryck={tryck} mk={mk} /> : undefined}>
        <NyGrupp titel="Dagens rutt" antal={3}>
          <NyRad titel={KUND} tid="08:00" under="Privat, getingbo" status="Bokad" />
          <NyRad titel="Exempel AB" tid="10:30" status="Bokad" />
          <NyRad titel="Brf Exempelgården" tid="13:00" status="Bokad" />
        </NyGrupp>
      </NySkarm>
    )
  }
  return (
    <NySkarm sida="avtal" titel="Avtal och offerter" onRam={tryck}
      over={l.vy === 'klart' ? <Notis text="Offerten är skickad" /> : undefined}>
      <Wizard l={l} tryck={tryck} mk={mk} />
    </NySkarm>
  )
}

// --- Visning ---

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'skapa-knapp' },
  { lage: { ...BAS, vy: 'ark' }, markera: 'skapa:Avtal eller offert' },
  { lage: { ...BAS, vy: 'dokument' }, markera: 'typ:offer' },
  { lage: { ...BAS, typ: 'offer', mall: MALL_PRIVAT, vy: 'motpart' }, markera: 'sok' },
  { lage: { ...IFYLLD, vy: 'innehall' }, markera: 'nasta' },
  { lage: { ...IFYLLD, vy: 'granska' }, markera: 'skapa-pdf' },
  { lage: { ...IFYLLD, vy: 'pdf' }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const skapaMal = enhet === 'dator' ? 'skapa' : 'nav:Skapa'
  if (v.markera === 'skapa-knapp') {
    return (
      <NySkarm sida="idag" titel="Idag" under="Måndag 26 oktober, 3 besök" markor={{ pa: true, nr: steg + 1, mal: skapaMal }} onRam={m => { if (m === skapaMal) onNasta() }}>
        <NyGrupp titel="Dagens rutt" antal={3}>
          <NyRad titel={KUND} tid="08:00" under="Privat, getingbo" status="Bokad" />
          <NyRad titel="Exempel AB" tid="10:30" status="Bokad" />
          <NyRad titel="Brf Exempelgården" tid="13:00" status="Bokad" />
        </NyGrupp>
      </NySkarm>
    )
  }
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${KUND} vill ha pris på att ta bort ett getingbo, ${PRIS}. Skapa offerten och skicka den. Börja med Skapa.` }

const FEL: Record<string, string> = {
  avbryt: 'Avbryt lämnar Skapa avtal eller offert och det du fyllt i försvinner. Fortsätt i stället.',
  band: 'Avtal & Offerter tar dig till Dokumentsignering. Gör klart offerten först.',
  'typ:contract': 'Avtalsförslag är för löpande avtal med årspremie. Ett getingbo är ett engångsjobb, alltså Offert.',
  'f:pnr': 'Personnumret är bra att ha men stoppar inte. Fyll i namn, telefon och e-post.',
  'f:faktura': 'E-post för faktura kan kunden fylla i vid signeringen. Fyll i namn, telefon och e-post.',
  'f:ansvarig': 'Ditt namn står redan här. Tryck Nästa.',
  'f:ansvarig-epost': 'Din e-post står redan här. Tryck Nästa.',
  'tj:inspektion': 'Uppdraget gäller getingboet. Välj Sanering Geting.',
  textruta: 'Du kan skriva egen text här. Enklast är Skriv förslag från tjänsterna.',
  'pdf-yta': 'Det här är Oneflows PDF. Ser den rätt ut skickar du med knappen under.',
  andra: 'Tillbaka och ändra tar bort utkastet. Allt stämmer, så skicka i stället.',
  utkast: 'Spara som utkast skickar inget. Uppdraget var att skicka offerten nu.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips2 = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (vy: Vy, extra: Partial<Lage> = {}) => setL(prev => ({ ...prev, ...extra, vy }))

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'start') {
      if (id === 'nav:Skapa' || id === 'skapa') { ga('ark'); tips2('Vad vill du göra?', 'Välj Avtal eller offert.') }
      else miss(enhet === 'dator' ? 'Skapa är den gröna knappen uppe i sidhuvudet.' : 'Skapa är den gröna knappen mitt i bottenmenyn.')
      return
    }
    if (l.vy === 'ark') {
      if (id === 'skapa:Avtal eller offert') { ga('dokument'); tips2('Skapa avtal eller offert är öppen', 'Avtalsförslag är förvalt. Välj Offert, eftersom det är ett engångsjobb.') }
      else miss('Offerten skapar du med Avtal eller offert, överst i rutan.')
      return
    }
    if (FEL[id] && !(id === 'typ:contract' && l.vy !== 'dokument')) { miss(FEL[id]); return }
    if (id === 'tillbaka') { miss('Tillbaka går ett steg bakåt. Du behöver inte gå tillbaka, fortsätt framåt.'); return }

    switch (l.vy) {
      case 'dokument':
        if (id === 'typ:offer') { ga('dokument', { typ: 'offer' }); tips2('Offert vald', 'Tryck Nästa.') }
        else if (id === 'nasta') {
          if (l.typ !== 'offer') miss('Avtalsförslag är förvalt. Välj Offert först.')
          else { ga('mall'); tips2('Välj mall', 'Familjen Exempel är privatpersoner och betalar inklusive moms. Välj mallen för det.') }
        } else miss('Välj Offert och tryck Nästa.')
        return
      case 'mall':
        if (id.startsWith('mall:')) {
          const mall = id.slice(5)
          ga('mall', { mall })
          if (mall === MALL_PRIVAT) tips2('Rätt mall', 'Tryck Nästa. Steget Avtalspart försvann, mallen säger redan att det är en privatperson.')
          else if (mall === '8598798') miss('Den mallen är för företag. Familjen Exempel är privatpersoner.')
          else miss('ROT och RUT gäller arbete i hemmet med skatteavdrag. Här räcker den vanliga mallen för privatpersoner inklusive moms.')
        } else if (id === 'nasta') {
          if (l.mall !== MALL_PRIVAT) miss('Välj Offertförslag, Inkl moms (Privatperson) först.')
          else { ga('begone'); tips2('Ansvarig', 'Ditt namn och din e-post är redan ifyllda. Tryck Nästa.') }
        } else miss('Välj en mall och tryck Nästa.')
        return
      case 'begone':
        if (id === 'nasta') { ga('motpart'); tips2('Motpart', 'Sök först om kunden redan finns. Tryck i sökfältet under Befintlig kund.') }
        else miss('Tryck Nästa.')
        return
      case 'motpart':
        if (id === 'sok') { ga('motpart', { sok: 'ingen' }); tips2('Ingen kund hittades', `${KUND} finns inte i kundregistret. Fyll i en ny kund nedan: namn, telefon och e-post.`) }
        else if (id === 'f:namn') { ga('motpart', { namn: true }); tips2('Namnet är ifyllt', 'Fyll i telefon och e-post.') }
        else if (id === 'f:tel') { ga('motpart', { tel: true }); tips2('Telefonen är ifylld', 'Bra, då kan du ringa om kunden inte signerar.') }
        else if (id === 'f:epost') { ga('motpart', { epost: true }); tips2('E-posten är ifylld', 'Offerten skickas dit. Tryck Nästa när allt är ifyllt.') }
        else if (id === 'nasta') {
          const h = tips({ ...l })
          if (h) miss(`Det står ${h} i bottenlisten. Nästa går inte förrän det är ifyllt.`)
          else { ga('tjanster'); tips2('Tjänster och pris', 'Lägg till tjänsten för getingboet.') }
        } else miss('Fyll i namn, telefon och e-post.')
        return
      case 'tjanster':
        if (id === 'lagg-till') { ga('tjanster', { valjare: true }); tips2('Sök tjänsten', 'Välj Sanering Geting i listan.') }
        else if (id === 'tj:geting') { ga('tjanster', { tjanst: true, valjare: false }); tips2('Tjänsten är tillagd', `${TJANST}, ${PRIS}. Tryck Nästa.`) }
        else if (id === 'nasta') {
          if (!l.tjanst) miss('Det står Lägg till minst en tjänst. Tryck Lägg till tilläggstjänst.')
          else { ga('innehall'); tips2('Offertinnehåll', 'Texten kunden läser i offerten. Tryck Skriv förslag från tjänsterna.') }
        } else miss('Lägg till tjänsten för getingboet.')
        return
      case 'innehall':
        if (id === 'forslag') { ga('innehall', { text: true }); tips2('Texten är skriven', 'Läs igenom och tryck Granska offerten.') }
        else if (id === 'nasta') {
          ga('granska')
          if (!l.text) miss('Du kom till granskningen, men Offertinnehållet är tomt. Röd punkt stoppar. Tryck Rätta under Offertinnehåll.')
          else tips2('Kontroll före utskick', 'Gula punkter stoppar inte. Skapa PDF:en.')
        } else miss('Tryck Skriv förslag från tjänsterna.')
        return
      case 'granska': {
        const stopp = harStopp(kontroll(l))
        if (id === 'ratta:avtalsobjekt') { ga('innehall'); tips2('Tillbaka i Offertinnehåll', 'Tryck Skriv förslag från tjänsterna och sedan Granska offerten.') }
        else if (id.startsWith('ratta:')) miss('Gul punkt stoppar inte. Kunden kan fylla i det vid signeringen.')
        else if (id === 'skapa-pdf') {
          if (stopp) miss('Knappen fungerar inte så länge en punkt är röd. Rätta under Offertinnehåll först.')
          else { ga('pdf'); tips2('Utkastet är skapat', 'Inget är skickat än. Titta på PDF:en och skicka.') }
        } else miss('Tryck Skapa och visa Oneflows PDF.')
        return
      }
      case 'pdf':
        if (id === 'skicka') {
          ga('klart')
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Offerten på ${PRIS} är skickad från info@begone.se till ${EPOST}. Du följer den under Dokumentsignering.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else miss('Tryck Skicka offerten.')
        return
    }
  }

  const ordning: Vy[] = ['start', 'ark', 'dokument', 'mall', 'begone', 'motpart', 'tjanster', 'innehall', 'granska', 'pdf', 'klart']
  const framsteg = Math.max(0, ordning.indexOf(l.vy) - 1)
  return (
    <OvningRam framsteg={framsteg} totalt={9} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
