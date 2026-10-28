// src/pages/shared/intranet/guider/guide-dokumentsignering-saljare.tsx
// Guidemodul: Skapa och skicka en offert (admin, koordinator och säljare, dator).
// Sluggen är kvar från guiden "Skicka en offert eller ett avtal för signering" så att
// läsloggen och länkarna fungerar. Sedan 3.106.0 är den kontorets offertguide, byggd
// som teknikerns (guide-skapa-avtal-offert). Avtalsförslaget har guiden
// guide-skapa-avtalsforslag-kontor.
//
// Efterbildning av:
//   sidomenyn        "Skapa Avtal & Offerter" överst (coordinatorNavConfig, saljareNavConfig)
//   OneflowContractCreator
//     bandet          Avtal & Offerter, Ny offert, "x % klart", Avbryt
//     stegen          Dokument, Mall, BeGone, Motpart, Tjänster, Offertinnehåll, Granska
//                     (Avtalspart döljs när offertmallen är vald, mallen bär kundtypen)
//     Mall            mallkorten med "Privatperson · ROT-avdrag" (template.deduction)
//     Tjänster        CaseServiceSelector: Tjänster & fakturarader, Lägg till tilläggstjänst,
//                     Dela upp för ROT/RUT, formuläret Varav arbetskostnad, Timmar, Avdrag,
//                     Kunden betalar, Dela upp. Mallen bestämmer vilket avdrag som syns
//                     (allowedDeduction). Inskjutet: "Varav arbetskostnad ..., ROT",
//                     "Material och övrigt", Fastighetsbeteckning *.
//     bottenlisten    getValidationHint, med ROT/RUT-felet ur src/shared/rotRutDokument.ts
//     Granska         Kontroll före utskick (kontrolleraAvtal + ROT/RUT-punkten)
//     utkastet        Så här ser kunden offerten, Skicka offerten, Tillbaka och ändra, Spara som utkast
//   Motpart          rutan Befintlig kund (AvtalsKundVal), ritad i _avtalsforslag.tsx
// Påhittad kund, ingenting skickas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { OFFER_TEMPLATES } from '../../../../constants/oneflowTemplates'
import { AVTALSOBJEKT_MAX_TECKEN, harStopp, kontrolleraAvtal, type KontrollAvsnitt, type KontrollPunkt } from '../../../../shared/avtalsKontroll'
import { mallensAvdrag, rotRutFel, tillatnaAvdrag } from '../../../../shared/rotRutDokument'
import { Dator, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { Knapp, ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'
import { BefintligKund, Falt, StegRubrik, ValKort, type Sok } from './_avtalsforslag'

// --- Data ---

const KUND = 'Familjen Exempel'
const TEL = '070-123 45 67'
const EPOST = 'familjen@exempel.se'
const TJANST = 'Tätning av ventil'
const TOTAL = 3750
const ARBETE = 2500
const TIMMAR = 2
const FASTIGHET = 'Exempelby 1:23'
const FORSLAG = `Tjänster som ingår:\n\n- ${TJANST}`
const MALL_ROT = '8919012'
const SKAPA = 'Skapa Avtal & Offerter'
const MENY = ['Översikt', SKAPA, 'Ärenden', 'Befintliga kunder', 'Dokumentsignering', 'Leads (B2B)']
const ARBETSTJANST = { rot_eligible: true, rut_eligible: true }

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`
const mallNamn = (namn: string) => namn.replace(/\s*[\u2013\u2014]\s*/g, ', ')
const mallen = (id: string | null) => OFFER_TEMPLATES.find(t => t.id === id)

type Vy = 'start' | 'dokument' | 'mall' | 'begone' | 'motpart' | 'tjanster' | 'innehall' | 'granska' | 'pdf' | 'klart'

interface Lage {
  vy: Vy
  typ: 'contract' | 'offer'
  mall: string | null
  sok: Sok
  namn: boolean
  tel: boolean
  epost: boolean
  tjanst: boolean
  valjare: boolean
  /** Formuläret Dela upp för ROT/RUT är öppet */
  form: boolean
  /** Avdraget som är valt i formuläret */
  formAvdrag: 'ROT' | 'RUT' | null
  /** Arbetskostnaden är uppdelad på en egen rad med detta avdrag */
  avdrag: 'ROT' | 'RUT' | null
  fastighet: boolean
  text: boolean
}

const BAS: Lage = {
  vy: 'start', typ: 'contract', mall: null, sok: 'tom', namn: false, tel: false, epost: false,
  tjanst: false, valjare: false, form: false, formAvdrag: null, avdrag: null, fastighet: false, text: false,
}
const MED_TJANST: Lage = { ...BAS, typ: 'offer', mall: MALL_ROT, sok: 'ingen', namn: true, tel: true, epost: true, tjanst: true }
const IFYLLD: Lage = { ...MED_TJANST, avdrag: 'ROT', fastighet: true, text: true }

const STEGEN: { vy: Vy; namn: string }[] = [
  { vy: 'dokument', namn: 'Dokument' },
  { vy: 'mall', namn: 'Mall' },
  { vy: 'begone', namn: 'BeGone' },
  { vy: 'motpart', namn: 'Motpart' },
  { vy: 'tjanster', namn: 'Tjänster' },
  { vy: 'innehall', namn: 'Offertinnehåll' },
  { vy: 'granska', namn: 'Granska' },
]

/** ROT/RUT-felet med portalens egen regel och text */
function rotFel(l: Lage): string {
  if (!l.avdrag) return ''
  const m = mallen(l.mall)
  const avdrag = mallensAvdrag(m)
  return rotRutFel(
    [{ rot_rut_type: l.avdrag, service_name: 'Skadedjurstekniker timpris', service: ARBETSTJANST }],
    avdrag ? { avdrag, namn: m ? mallNamn(m.name) : null } : null
  )
}

function kontroll(l: Lage): KontrollPunkt[] {
  const punkter = kontrolleraAvtal({
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
  const fel = rotFel(l)
  return fel ? [...punkter, { niva: 'rod', text: fel, avsnitt: 'tjanster' }] : punkter
}

const AVSNITT: Record<KontrollAvsnitt, string> = { motpart: 'Motpart', avtalstid: 'BeGone', avtalsobjekt: 'Offertinnehåll', tjanster: 'Tjänster' }

/** Bottenlistens tips, som getValidationHint */
function tips(l: Lage): string {
  if (l.vy === 'motpart') {
    if (!l.namn) return 'Fyll i kontaktperson'
    if (!l.epost) return 'Fyll i e-postadress'
  }
  if (l.vy === 'tjanster') {
    if (!l.tjanst) return 'Lägg till minst en tjänst'
    return rotFel(l)
  }
  return ''
}
const kanGaVidare = (l: Lage) => !(l.vy === 'mall' && !l.mall) && !(l.vy === 'dokument' && l.typ !== 'offer') && tips(l) === ''

// --- Skärmen ---

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

const PUNKT_FARG = { rod: 'bg-red-500', gul: 'bg-amber-500', gron: 'bg-[#20c58f]' }

/** Formuläret Dela upp för ROT/RUT. Mallen bestämmer vilka avdrag som syns. */
function DelaUpp({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const tillat = tillatnaAvdrag(mallensAvdrag(mallen(l.mall)))
  const pct = l.formAvdrag === 'ROT' ? 30 : l.formAvdrag === 'RUT' ? 50 : 0
  const avdrag = ARBETE * pct / 100
  return (
    <div className="grid gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/30 p-2">
      <p className="text-[10px] leading-snug text-slate-400">ROT/RUT gäller bara arbetskostnaden. Ange hur stor del av totalpriset {kr(TOTAL)} som är arbete. Arbetet blir en egen rad "Skadedjurstekniker timpris" som bär avdraget. Totalen mot kund ändras inte.</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Falt id="form:arbete" etikett="Varav arbetskostnad" varde={kr(ARBETE)} tryck={tryck} mk={mk} />
        <Falt id="form:timmar" etikett="Timmar" varde={`${TIMMAR} h`} tryck={tryck} mk={mk} />
        <div className="grid gap-0.5">
          <span className="text-[10px] font-bold text-slate-300">Avdrag</span>
          <div className="flex flex-wrap gap-x-2 gap-y-1 pt-0.5">
            {(['ROT', 'RUT'] as const).filter(t => (t === 'ROT' ? tillat.rot : tillat.rut)).map(t => (
              <Markor key={t} markor={mk(`form:${t}`)}>
                <button type="button" onClick={() => tryck(`form:${t}`)} className="flex items-center gap-1 text-[10.5px] text-slate-300">
                  <span className={`flex h-3 w-3 items-center justify-center rounded-full border ${l.formAvdrag === t ? 'border-[#20c58f]' : 'border-slate-500'}`}>
                    {l.formAvdrag === t && <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />}
                  </span>
                  {t} ({t === 'ROT' ? 30 : 50} %)
                </button>
              </Markor>
            ))}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-[10px]">
        <dt className="text-slate-400">Material och övrigt</dt><dd className="text-right text-slate-200">{kr(TOTAL - ARBETE)}</dd>
        <dt className="text-slate-400">Arbetskostnad</dt><dd className="text-right text-slate-200">{kr(ARBETE)}</dd>
        <dt className="text-slate-400">{l.formAvdrag ? `${l.formAvdrag}-avdrag (${pct} %)` : 'ROT- eller RUT-avdrag'}</dt>
        <dd className={`text-right ${l.formAvdrag ? 'text-[#20c58f]' : 'text-slate-500'}`}>{l.formAvdrag ? `-${kr(avdrag)}` : 'Välj ROT eller RUT'}</dd>
        <dt className="border-t border-slate-700/50 pt-0.5 font-medium text-slate-300">Kunden betalar</dt>
        <dd className="border-t border-slate-700/50 pt-0.5 text-right font-semibold text-white">{kr(TOTAL - avdrag)}</dd>
      </dl>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => tryck('form:avbryt')} className="text-[10.5px] text-slate-400">Avbryt</button>
        <Markor markor={mk('form:ok')}>
          <button type="button" onClick={() => tryck('form:ok')} className="rounded-md bg-[#20c58f] px-2 py-0.5 text-[10.5px] font-medium text-[#fff]">Dela upp</button>
        </Markor>
      </div>
    </div>
  )
}

function Tjanster({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const pct = l.avdrag === 'ROT' ? 30 : l.avdrag === 'RUT' ? 50 : 0
  return (
    <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white"><Icon name="sok.faktura" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Tjänster &amp; fakturarader</p>
      {l.tjanst ? (
        <div className="grid gap-1 rounded-lg border border-slate-700/50 bg-slate-800/40 p-2">
          <p className="flex justify-between text-[11.5px] text-white"><span>{TJANST}</span><span className="font-semibold">{kr(TOTAL)}{l.avdrag ? ' totalt' : ''}</span></p>
          {l.avdrag && (
            <div className="ml-1 grid gap-0.5 border-l-2 border-[#20c58f]/40 pl-2">
              <p className="text-[10.5px] text-slate-300"><span className="mr-1 text-[#20c58f]">●</span>Varav arbetskostnad <b className="font-semibold text-white">{kr(ARBETE)}</b>, {TIMMAR} h, {l.avdrag}</p>
              <p className="text-[10px] text-slate-500">Material och övrigt {kr(TOTAL - ARBETE)}</p>
              <Markor markor={mk('fastighet')} block>
                <button type="button" onClick={() => tryck('fastighet')}
                  className={`block w-full rounded border px-1.5 py-0.5 text-left text-[10px] ${l.fastighet ? 'border-slate-600 text-white' : 'border-slate-600 text-slate-500'}`}>
                  {l.fastighet ? FASTIGHET : 'Fastighetsbeteckning *'}
                </button>
              </Markor>
            </div>
          )}
          {l.form && <DelaUpp l={l} tryck={tryck} mk={mk} />}
          {!l.avdrag && !l.form && (
            <Markor markor={mk('dela-upp')}>
              <button type="button" onClick={() => tryck('dela-upp')} className="flex items-center gap-1 text-[10.5px] text-slate-400">
                <Icon name="allman.kalkyl" size={16} className="h-3 w-3" />Dela upp för ROT/RUT
              </button>
            </Markor>
          )}
        </div>
      ) : (
        <p className="py-1 text-center text-[10.5px] text-slate-500">Inga tjänster tillagda än</p>
      )}
      {l.valjare ? (
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-500"><Icon name="allman.sok" size={16} className="h-3 w-3" />Sök tilläggstjänst...</p>
          {[{ id: 'tj:tatning', namn: TJANST, pris: kr(TOTAL) }, { id: 'tj:inspektion', namn: 'Inspektion', pris: '1 200 kr' }].map(t => (
            <Markor key={t.id} markor={mk(t.id)} block>
              <button type="button" onClick={() => tryck(t.id)} className="flex w-full justify-between rounded-lg bg-slate-800/50 px-2 py-1 text-left text-[11px] text-white">
                <span>{t.namn}</span><span className="text-[#20c58f]">{t.pris}</span>
              </button>
            </Markor>
          ))}
        </div>
      ) : !l.tjanst && (
        <Markor markor={mk('lagg-till')}>
          <button type="button" onClick={() => tryck('lagg-till')} className="flex items-center gap-1 text-[10.5px] text-slate-400"><Icon name="allman.plus" size={16} className="h-3 w-3" />Lägg till tilläggstjänst</button>
        </Markor>
      )}
      {l.avdrag && (
        <div className="grid gap-0.5 border-t border-slate-700/50 pt-1 text-[10.5px]">
          <p className="flex justify-between"><span className="text-slate-400">Inkl. moms</span><span className="font-semibold text-white">{kr(TOTAL)}</span></p>
          <p className="flex justify-between text-[#20c58f]"><span>{l.avdrag}-avdrag</span><span>-{kr(ARBETE * pct / 100)}</span></p>
          <p className="flex justify-between"><span className="font-medium text-slate-300">Att betala (kund)</span><span className="font-bold text-[#20c58f]">{kr(TOTAL - ARBETE * pct / 100)}</span></p>
        </div>
      )}
    </div>
  )
}

function Innehall({ l, tryck, mk }: { l: Lage; tryck: Tryck; mk: Mk }) {
  const idx = STEGEN.findIndex(s => s.vy === l.vy) + 1
  switch (l.vy) {
    case 'dokument':
      return (
        <>
          <StegRubrik nr={1} rubrik="Vad ska du skapa?" text="Välj om kunden ska få ett avtalsförslag eller en offert." />
          <div className="grid grid-cols-2 gap-1.5">
            <ValKort id="typ:contract" namn="Avtalsförslag" text="Löpande avtal med årspremie. Kunden signerar i Oneflow." vald={l.typ === 'contract'} ikon="dok.avtal" tryck={tryck} mk={mk} />
            <ValKort id="typ:offer" namn="Offert" text="Engångsuppdrag med fast pris. Kunden godkänner i Oneflow." vald={l.typ === 'offer'} ikon="dok.offert" tryck={tryck} mk={mk} />
          </div>
        </>
      )
    case 'mall':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Välj mall" text="Mallen styr offertens fasta text i Oneflow." />
          <div className="grid grid-cols-2 gap-1">
            {OFFER_TEMPLATES.map(t => (
              <ValKort key={t.id} id={`mall:${t.id}`} namn={mallNamn(t.name)}
                text={[t.category === 'company' ? 'Företag' : 'Privatperson', t.deduction ? `${t.deduction}-avdrag` : null].filter(Boolean).join(' · ')}
                vald={l.mall === t.id} ikon="dok.offert" tryck={tryck} mk={mk} />
            ))}
          </div>
        </>
      )
    case 'begone':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Ansvarig" text="Vem som står på offerten från Begone." />
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
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
            <div className="grid grid-cols-3 gap-1.5">
              <Falt id="f:tel" etikett="Telefon" varde={l.tel ? TEL : '070-123 45 67'} tom={!l.tel} tryck={tryck} mk={mk} />
              <Falt id="f:epost" etikett="E-post" varde={l.epost ? EPOST : 'namn@exempel.se'} tom={!l.epost} tryck={tryck} mk={mk} />
              <Falt id="f:faktura" etikett="E-post för faktura" varde="namn@exempel.se" tom tryck={tryck} mk={mk} />
            </div>
          </div>
        </>
      )
    case 'tjanster':
      return (
        <>
          <StegRubrik nr={idx} rubrik="Tjänster och pris" text="Det kunden betalar, och artiklarna som ingår internt." />
          <Tjanster l={l} tryck={tryck} mk={mk} />
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
          <p className="mb-1.5 text-[14px] font-semibold text-white">Granska offerten</p>
          <div className="grid gap-1.5 sm:grid-cols-[1fr_200px]">
            <div className="grid content-start gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2">
              <p className="text-[11.5px] font-bold text-white">Offert, {l.namn ? KUND : 'kund'}</p>
              <p className="text-[10.5px] font-bold text-white">Offertinnehåll</p>
              {l.text
                ? <p className="whitespace-pre-line text-[10px] text-slate-300">{FORSLAG}</p>
                : <p className="rounded border border-dashed border-red-500 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">Offertinnehållet är tomt.</p>}
              <p className="flex justify-between border-t border-slate-700 pt-1 text-[10.5px] text-white"><span>{l.tjanst ? TJANST : 'Inga tjänster är valda'}</span><span>{l.tjanst ? kr(TOTAL) : ''}</span></p>
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
              <Knapp id="skapa-pdf" text="Skapa och visa Oneflows PDF" prim full inaktiv={stopp} tryck={tryck} mk={mk} />
            </div>
          </div>
        </>
      )
    }
    case 'pdf':
      return (
        <>
          <p className="mb-1 text-[14px] font-semibold text-white">Så här ser kunden offerten</p>
          <div className="grid gap-1.5 sm:grid-cols-[1fr_200px]">
            <button type="button" onClick={() => tryck('pdf-yta')} className="grid gap-0.5 rounded bg-white p-2 text-left text-[9.5px] text-slate-700 shadow">
              <span className="text-[11px] font-bold text-slate-900">Offert</span>
              <span>Kund: {KUND}</span>
              <span className="whitespace-pre-line">{FORSLAG}</span>
              <span className="flex justify-between border-t border-slate-200 pt-0.5"><span>{TJANST}</span><span>{kr((TOTAL - ARBETE) / 1.25)} exkl. moms</span></span>
              <span className="flex justify-between"><span>Skadedjurstekniker timpris, {TIMMAR} h</span><span>{kr(ARBETE / 1.25)} exkl. moms</span></span>
            </button>
            <div className="grid content-start gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
              <p className="text-[11.5px] font-bold text-white">Ser allt rätt ut?</p>
              <Knapp id="skicka" text="Skicka offerten" prim full tryck={tryck} mk={mk} />
              <p className="text-[9.5px] text-slate-400">Skickas från info@begone.se till {EPOST}.</p>
              <div className="grid gap-1 border-t border-slate-700/60 pt-1">
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
          <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2 text-[10.5px]">
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
    <div className="flex h-full min-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-700">
      <Band l={l} procent={procent} tryck={tryck} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-950/40 p-2.5"><Innehall l={l} tryck={tryck} mk={mk} /></div>
      {visaLista && (
        <div className="flex flex-none items-center justify-between gap-1.5 border-t border-slate-700 bg-slate-900/90 px-2.5 py-1.5">
          <Knapp id="tillbaka" text="Föregående" tryck={tryck} mk={mk} />
          <span className="min-w-0 flex-1 text-center text-[10px] leading-snug">
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
  const start = l.vy === 'start'
  return (
    <Dator adress={start ? 'koordinator › dashboard' : 'koordinator › oneflow-contract-creator'}>
      <div className="flex min-h-[460px]">
        <nav className="hidden w-40 flex-none border-r border-slate-700 bg-slate-950/40 p-2 sm:block" aria-label="Sidomeny i exemplet">
          <p className="mb-2 px-2 text-[11px] font-bold text-[#20c58f]">BeGone</p>
          {MENY.map(m => (
            <Markor key={m} markor={mk(`nav:${m}`)} block>
              <button type="button" onClick={() => tryck(`nav:${m}`)}
                className={`block w-full truncate rounded-md px-2 py-1 text-left text-[11.5px] ${(start ? m === 'Översikt' : m === SKAPA) ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400'}`}>{m}</button>
            </Markor>
          ))}
        </nav>
        <div className="relative min-w-0 flex-1 p-2.5">
          {start ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-white">Översikt</p>
              <div className="grid grid-cols-2 gap-2">
                {['Ärenden idag', 'Att boka in', 'Väntar på signering', 'Nya tips'].map((t, i) => (
                  <div key={t} className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                    <p className="text-[10px] text-slate-400">{t}</p>
                    <p className="text-[15px] font-semibold text-white">{[12, 3, 5, 2][i]}</p>
                  </div>
                ))}
              </div>
              {/* På smal skärm syns inte sidomenyn: länken står då här */}
              <Markor markor={mk(`nav:${SKAPA}`)}>
                <button type="button" onClick={() => tryck(`nav:${SKAPA}`)} className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] text-white sm:hidden">{SKAPA}</button>
              </Markor>
            </div>
          ) : (
            <Wizard l={l} tryck={tryck} mk={mk} />
          )}
          {l.vy === 'klart' && <Notis text="Offerten är skickad" />}
        </div>
      </div>
    </Dator>
  )
}

// --- Visning ---

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: `nav:${SKAPA}` },
  { lage: { ...BAS, vy: 'dokument' }, markera: 'typ:offer' },
  { lage: { ...BAS, typ: 'offer', vy: 'mall' }, markera: `mall:${MALL_ROT}` },
  { lage: { ...BAS, typ: 'offer', mall: MALL_ROT, vy: 'motpart' }, markera: 'sok' },
  { lage: { ...MED_TJANST, vy: 'tjanster' }, markera: 'dela-upp' },
  { lage: { ...MED_TJANST, vy: 'tjanster', form: true, formAvdrag: 'ROT' }, markera: 'form:ok' },
  { lage: { ...IFYLLD, vy: 'granska' }, markera: 'skapa-pdf' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${KUND} vill ha en offert på ${TJANST.toLowerCase()}, ${kr(TOTAL)} inkl. moms. ${kr(ARBETE)} av det är arbete, ${TIMMAR} timmar, och familjen ska ha ROT. Skapa offerten och skicka den. Börja i sidomenyn.` }

const FEL: Record<string, string> = {
  avbryt: 'Avbryt lämnar Skapa avtal eller offert och det du fyllt i försvinner. Fortsätt i stället.',
  band: 'Avtal & Offerter tar dig till Dokumentsignering. Gör klart offerten först.',
  'f:pnr': 'Personnumret behövs för ROT, men stoppar inte här. Fyll i namn, telefon och e-post.',
  'f:faktura': 'E-post för faktura kan kunden fylla i vid signeringen. Fyll i namn, telefon och e-post.',
  'f:ansvarig': 'Ditt namn står redan här. Tryck Nästa.',
  'f:ansvarig-epost': 'Din e-post står redan här. Tryck Nästa.',
  'tj:inspektion': 'Uppdraget gäller tätningen. Välj Tätning av ventil.',
  'form:arbete': `Arbetskostnaden ${kr(ARBETE)} står redan i rutan.`,
  'form:timmar': `${TIMMAR} timmar står redan i rutan.`,
  'form:avbryt': 'Avbryt stänger formuläret utan att dela upp. Familjen ska ha ROT, så dela upp.',
  textruta: 'Du kan skriva egen text här. Enklast är Skriv förslag från tjänsterna.',
  'pdf-yta': 'Det här är Oneflows PDF. Ser den rätt ut skickar du med knappen bredvid.',
  andra: 'Tillbaka och ändra tar bort utkastet. Allt stämmer, så skicka i stället.',
  utkast: 'Spara som utkast skickar inget. Uppdraget var att skicka offerten nu.',
}

const ORDNING: Vy[] = ['start', 'dokument', 'mall', 'begone', 'motpart', 'tjanster', 'innehall', 'granska', 'pdf', 'klart']

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips2 = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (vy: Vy, extra: Partial<Lage> = {}) => setL(prev => ({ ...prev, ...extra, vy }))

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (id.startsWith('nav:')) {
      if (l.vy === 'start' && id === `nav:${SKAPA}`) { ga('dokument'); tips2('Skapa avtal eller offert är öppen', 'Avtalsförslag är förvalt. Välj Offert, eftersom det är ett engångsjobb.') }
      else if (l.vy === 'start') miss(`Offerten skapar du under ${SKAPA}, överst i sidomenyn.`)
      else miss('Sidomenyn lämnar Skapa avtal eller offert. Gör klart offerten först.')
      return
    }
    if (l.vy === 'start') { miss(`Börja i sidomenyn: ${SKAPA}.`); return }
    if (FEL[id]) { miss(FEL[id]); return }
    if (id === 'tillbaka') { miss('Föregående går ett steg bakåt. Du behöver inte gå tillbaka, fortsätt framåt.'); return }

    switch (l.vy) {
      case 'dokument':
        if (id === 'typ:offer') { ga('dokument', { typ: 'offer' }); tips2('Offert vald', 'Tryck Nästa.') }
        else if (id === 'typ:contract') miss('Avtalsförslag är för löpande avtal med årspremie. Tätningen är ett engångsjobb, alltså Offert.')
        else if (id === 'nasta') {
          if (l.typ !== 'offer') miss('Avtalsförslag är förvalt. Välj Offert först.')
          else { ga('mall'); tips2('Välj mall', 'Familjen ska ha ROT. Mallen bestämmer avdraget, så välj ROT-mallen.') }
        } else miss('Välj Offert och tryck Nästa.')
        return
      case 'mall':
        if (id.startsWith('mall:')) {
          const mall = id.slice(5)
          ga('mall', { mall })
          if (mall === MALL_ROT) tips2('Rätt mall', 'Med ROT-mallen går bara ROT att välja i Tjänster. Tryck Nästa.')
          else if (mall === '8598798') miss('Den mallen är för företag. Familjen Exempel är privatpersoner.')
          else if (mall === '8919059') miss('RUT-mallen söker RUT-avdrag. Familjen ska ha ROT, välj ROT-mallen.')
          else miss('Den mallen har inget avdrag. Med den går ROT inte att välja i Tjänster. Välj ROT-mallen.')
        } else if (id === 'nasta') {
          if (l.mall !== MALL_ROT) miss('Välj Offertförslag, ROT (Privatperson) först.')
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
        else if (id === 'f:tel') { ga('motpart', { tel: true }); tips2('Telefonen är ifylld', 'Fyll i e-posten.') }
        else if (id === 'f:epost') { ga('motpart', { epost: true }); tips2('E-posten är ifylld', 'Offerten skickas dit. Tryck Nästa när allt är ifyllt.') }
        else if (id === 'nasta') {
          const h = tips(l)
          if (h) miss(`Det står ${h} i bottenlisten. Nästa går inte förrän det är ifyllt.`)
          else { ga('tjanster'); tips2('Tjänster och pris', 'Lägg till tjänsten för tätningen.') }
        } else miss('Fyll i namn, telefon och e-post.')
        return
      case 'tjanster':
        if (id === 'lagg-till') { ga('tjanster', { valjare: true }); tips2('Sök tjänsten', `Välj ${TJANST} i listan.`) }
        else if (id === 'tj:tatning') { ga('tjanster', { tjanst: true, valjare: false }); tips2('Tjänsten är tillagd', 'Avdraget gäller bara arbetet. Tryck Dela upp för ROT/RUT under tjänsten.') }
        else if (id === 'dela-upp') { ga('tjanster', { form: true, formAvdrag: 'ROT' }); tips2('Dela upp', `Arbetskostnad ${kr(ARBETE)} och ${TIMMAR} timmar står i rutorna. Bara ROT syns, eftersom mallen är ROT-mallen. Tryck Dela upp.`) }
        else if (id === 'form:ROT') { ga('tjanster', { formAvdrag: 'ROT' }); tips2('ROT är valt', 'Tryck Dela upp.') }
        else if (id === 'form:ok') { ga('tjanster', { form: false, avdrag: 'ROT' }); tips2('Arbetet är uppdelat', 'Under tjänsten står Varav arbetskostnad med ROT. Fyll i Fastighetsbeteckning.') }
        else if (id === 'fastighet') { ga('tjanster', { fastighet: true }); tips2('Fastighetsbeteckningen är ifylld', `${FASTIGHET}. Tryck Nästa.`) }
        else if (id === 'nasta') {
          if (!l.tjanst) miss('Det står Lägg till minst en tjänst. Tryck Lägg till tilläggstjänst.')
          else if (!l.avdrag) miss('Familjen ska ha ROT. Tryck Dela upp för ROT/RUT först.')
          else if (!l.fastighet) miss('Fyll i Fastighetsbeteckning under arbetskostnaden. Utan den går ärendet inte att fakturera med avdrag.')
          else { ga('innehall'); tips2('Offertinnehåll', 'Texten kunden läser i offerten. Tryck Skriv förslag från tjänsterna.') }
        } else miss('Lägg till tjänsten och dela upp arbetet för ROT.')
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
          setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Offerten på ${kr(TOTAL)} med ROT på arbetskostnaden är skickad från info@begone.se till ${EPOST}. Arbetsraden följer med till ärendet när offerten bokas in.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
        } else miss('Tryck Skicka offerten.')
        return
    }
  }

  const framsteg = Math.max(0, ORDNING.indexOf(l.vy))
  return (
    <OvningRam bred framsteg={framsteg} totalt={ORDNING.length - 1} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
