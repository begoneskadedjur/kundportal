// src/pages/shared/intranet/guider/_nyvy_arendet.tsx
// Delade delar för guiderna i gruppen "Ärendet steg för steg" (nya arbetsvyn, 2026-10-24):
// guide-utfora-arende, guide-prissattning, guide-fakturering, guide-aterbesok och
// guide-delfakturering. Ingen guidemodul (filen börjar med _).
//
// Etiketterna är kontrollerade mot källkoden 2026-10-24:
//  - EditCaseModal.tsx (nyArbetsvy): hjälptexterna i stegen, Öppna i kartor, Ring <namn>,
//    rapportknapparna Ladda ned / Skicka till <namn>, Jag är framme (startaTidVidFramme),
//    Ärendets verktyg (verktygGrupper) och Alla uppgifter (flikvyn Ärende, Utförande, Ekonomi).
//  - KlartSteg.tsx: Kontrollera innan du stänger, Vad är klart?, Hela ärendet, Bara besöket,
//    Det här händer när du stänger, Stäng hela ärendet, Spara utan att stänga.
//  - CaseServiceSelector.tsx: Tjänster & fakturarader, Prisguide, Lägg till tilläggstjänst,
//    Dela upp för ROT/RUT, Interna kostnader. CommissionSection.tsx: Provision.
//  - RevisitModal.tsx: Boka återbesök, Datum för återbesök *, Besökslängd, Visa förslag →,
//    Smarta förslag, Ange tid manuellt, Anteckning (valfritt), Skapa delfaktura för nuvarande tjänster.
// Portalens egna tankstreck (till exempel i underrubriken Förslag och tisdag) skrivs här med
// punkt i stället, enligt skrivreglerna.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import { Markor, Notis, type MarkorProps } from '../skarmkit'
import { NyArende, NyGrupp, NyHjalp, NyRad, NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'

export type Enhet = 'mobil' | 'dator'

/** Markör bara på det element som är målet i det här steget */
export const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

/** Mål i ärendets ram (NyArende) i stället för i innehållet */
const RAM_MAL = (mal: string) => mal === 'nasta' || mal === 'tillbaka' || mal === 'verktyg' || mal === 'flikvy' || mal === 'stang' || mal.startsWith('steg:')

export const KUND = 'Familjen Exempel · Exempelvägen 4, Södertälje'
export const NR = 'BE-0001234'

// ─── Ramen: ärendet ovanpå Mina ärenden ────────────

export function BakgrundLista() {
  return (
    <NyGrupp titel="Den här veckan" antal={3} text="Dina besök från idag till och med söndag.">
      <NyRad titel="Familjen Exempel" tid="Idag 08:00" under="Privat, sanering råtta" status="Bokad" />
      <NyRad titel="Exempel AB" tid="Idag 10:30" under="Kontrollbesök" status="Bokad" />
      <NyRad titel="Brf Exempelgården" tid="Imorgon 09:00" under="Företag, återbesök" status="Bokad" />
    </NyGrupp>
  )
}

interface ArendeRamProps {
  aktivt: StegId
  /** id för det som markeras: ram-mål (nasta, steg:pris, verktyg ...) eller innehållets id */
  markera?: string
  nr: number
  tryck: (id: string) => void
  nastaText?: string
  status?: string
  statusFarg?: string
  kund?: string
  arendeNr?: string
  /** Lager ovanpå ärendet (verktyg, dialoger, notis) */
  over?: ReactNode
  children: ReactNode
}

/** Ärendet i stegflödet, ovanpå Mina ärenden. Telefon eller dator enligt läsarens val. */
export function ArendeRam({ aktivt, markera, nr, tryck, nastaText, status = 'Bokad', statusFarg, kund = KUND, arendeNr = NR, over, children }: ArendeRamProps) {
  const ramMarkor: NyMarkor | undefined = markera && RAM_MAL(markera) ? { pa: true, nr, mal: markera } : undefined
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="4 att ta hand om nu" onRam={m => tryck(m)}
      over={<>
        <NyArende typ="privat" aktivt={aktivt} nr={arendeNr} status={status} statusFarg={statusFarg} kund={kund} nastaText={nastaText}
          markor={ramMarkor} onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')}
          onSteg={id => tryck(`steg:${id}`)} onIkon={m => tryck(m)}>
          <div className="flex h-full flex-col gap-2 overflow-hidden">{children}</div>
        </NyArende>
        {over}
      </>}>
      <BakgrundLista />
    </NySkarm>
  )
}

/** Idag med Nästa uppdrag och Öppna, för första steget i besöket */
export function IdagSkarm({ markera, nr, tryck }: { markera?: string; nr: number; tryck: (id: string) => void }) {
  const enhet = useGuideEnhet()
  return (
    <NySkarm sida="idag" titel="Idag" under="Måndag 26 oktober, 3 besök" onRam={m => tryck(m)}>
      <div className="mb-2 rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#20c58f]">Nästa uppdrag</p>
        <p className="text-[13px] font-semibold text-white">Familjen Exempel, 08:00</p>
        <p className="text-[11px] text-slate-400">Exempelvägen 4, Södertälje · 12 min bort</p>
        <div className={`mt-1.5 grid grid-cols-3 gap-1 ${enhet === 'dator' ? 'max-w-xs' : ''}`}>
          {['Navigera', 'Ring', 'Öppna'].map(t => (
            <Markor key={t} markor={mk(markera, t === 'Öppna' ? 'oppna' : t.toLowerCase(), nr)} block>
              <button type="button" onClick={() => tryck(t === 'Öppna' ? 'oppna' : t.toLowerCase())}
                className="w-full rounded-md border border-slate-600 bg-slate-800 py-1 text-center text-[11px] text-slate-200">{t}</button>
            </Markor>
          ))}
        </div>
      </div>
      <NyGrupp titel="Dagens rutt" antal={3}>
        <NyRad titel="Familjen Exempel" tid="08:00" status="Bokad" onClick={() => tryck('rad')} />
        <NyRad titel="Exempel AB" tid="10:30" status="Bokad" onClick={() => tryck('rad2')} />
        <NyRad titel="Brf Exempelgården" tid="13:00" status="Bokad" onClick={() => tryck('rad3')} />
      </NyGrupp>
    </NySkarm>
  )
}

// ─── Byggstenar i stegen ───────────────────────────

/** Sektion i ärendet, som CaseModalSection */
export function Sektion({ titel, ikon, ikonFarg = 'text-[#20c58f]', hoger, children }: { titel?: string; ikon?: IconName; ikonFarg?: string; hoger?: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
      {titel && (
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white">
          {ikon && <Icon name={ikon} size={16} className={`h-3.5 w-3.5 ${ikonFarg}`} />}
          <span className="min-w-0 flex-1 truncate">{titel}</span>
          {hoger}
        </p>
      )}
      {children}
    </div>
  )
}

/** Stegets grå knapp, som stegKnappKlass i EditCaseModal */
export function StegKnapp({ ikon, children, onClick, markor, inaktiv }: { ikon: IconName; children: ReactNode; onClick?: () => void; markor?: MarkorProps; inaktiv?: boolean }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick} aria-disabled={inaktiv}
        className={`flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 px-2 text-[11.5px] font-semibold text-white ${inaktiv ? 'opacity-50' : ''}`}>
        <Icon name={ikon} size={16} className="h-3.5 w-3.5 flex-none" />
        <span className="truncate">{children}</span>
      </button>
    </Markor>
  )
}

/** Inmatningsfält med etikett ovanför. tom = platshållare i grått. fel = röd ram. */
export function Inmatning({ etikett, varde, tom, fel, hjalp, onClick, markor, hog }: {
  etikett?: string; varde: string; tom?: boolean; fel?: boolean; hjalp?: string; onClick?: () => void; markor?: MarkorProps; hog?: boolean
}) {
  return (
    <div className="grid gap-0.5">
      {etikett && <span className="text-[10.5px] font-medium text-slate-400">{etikett}</span>}
      <Markor markor={markor} block>
        <button type="button" onClick={onClick}
          className={`block w-full rounded-lg border bg-slate-900/60 px-2 py-1 text-left text-[11.5px] leading-snug ${hog ? 'min-h-[38px]' : ''} ${fel ? 'border-red-500' : 'border-slate-600'} ${tom ? 'text-slate-500' : 'text-slate-200'}`}>
          {varde}
        </button>
      </Markor>
      {hjalp && <span className="text-[10px] leading-snug text-slate-500">{hjalp}</span>}
    </div>
  )
}

/** Textlänk i portalens stil, som Lägg till tilläggstjänst */
export function TextLank({ ikon, children, onClick, markor, gron }: { ikon?: IconName; children: ReactNode; onClick?: () => void; markor?: MarkorProps; gron?: boolean }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} className={`flex items-center gap-1 text-[11px] ${gron ? 'text-[#20c58f]' : 'text-slate-400 hover:text-[#20c58f]'}`}>
        {ikon && <Icon name={ikon} size={16} className="h-3 w-3" />}
        {children}
      </button>
    </Markor>
  )
}

/** Radioknapp med text */
export function Radio({ pa, text, onClick, markor }: { pa: boolean; text: string; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor}>
      <button type="button" role="radio" aria-checked={pa} onClick={onClick} className="flex items-center gap-1 text-[10.5px] text-slate-300">
        <span className={`flex h-3 w-3 items-center justify-center rounded-full border ${pa ? 'border-[#20c58f]' : 'border-slate-500'}`}>
          {pa && <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />}
        </span>
        {text}
      </button>
    </Markor>
  )
}

/** Belopp som "2 750 kr" */
export function kr(belopp: number): string {
  return `${Math.round(belopp).toLocaleString('sv-SE')} kr`
}

// ─── Stegens innehåll, privat- och företagsärende ──

export function FrammeInnehall({ markera, nr, tryck, kollega }: { markera?: string; nr: number; tryck: (id: string) => void; kollega?: boolean }) {
  const enhet = useGuideEnhet()
  return (
    <>
      <NyHjalp rubrik="Är du framme hos kunden?">
        {kollega
          ? 'Du är inte tilldelad ärendet. Du kan läsa det och svara i kommunikationen, men ärendet sköts av den som har det.'
          : 'Tryck på den gröna knappen när du står på plats. Kontrollera kontakten och adressen.'}
      </NyHjalp>
      <div className={`grid gap-1.5 ${enhet === 'dator' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <StegKnapp ikon="falt.navigera" onClick={() => tryck('kartor')} markor={mk(markera, 'kartor', nr)}>Öppna i kartor</StegKnapp>
        <StegKnapp ikon="kontakt.telefon" onClick={() => tryck('ring')} markor={mk(markera, 'ring', nr)}>Ring Familjen Exempel</StegKnapp>
      </div>
      <Sektion titel="Kontaktinformation" ikon="rapport.person" ikonFarg="text-emerald-400">
        <div className="grid grid-cols-2 gap-1">
          <Inmatning varde="Familjen Exempel" onClick={() => tryck('kontakt')} />
          <Inmatning varde="Personnummer" tom onClick={() => tryck('kontakt')} />
          <Inmatning varde="070-123 45 67" onClick={() => tryck('kontakt')} />
          <Inmatning varde="familjen@exempel.se" onClick={() => tryck('kontakt')} />
        </div>
        <Inmatning varde="Exempelvägen 4, Södertälje" onClick={() => tryck('adress')} />
      </Sektion>
    </>
  )
}

export function ArbeteInnehall({ markera, nr, tryck }: { markera?: string; nr: number; tryck: (id: string) => void }) {
  return (
    <>
      <NyHjalp rubrik="Vad ska göras?">Uppdraget står i beskrivningen. Välj tjänsten som utförs, den styr preparaten och prisguiden.</NyHjalp>
      <Sektion titel="Ärendeinformation" ikon="arende.arende" ikonFarg="text-teal-400">
        <Inmatning etikett="Beskrivning" varde="Råttor i källaren, spår vid tvättstugan. Kunden vill ha förslag på tätning." hog onClick={() => tryck('beskrivning')} markor={mk(markera, 'beskrivning', nr)} />
        <Inmatning etikett="Tjänst" varde="Råttor, sanering" onClick={() => tryck('tjanst')} markor={mk(markera, 'tjanst', nr)} />
      </Sektion>
    </>
  )
}

export function FotonInnehall({ markera, nr, tryck, bilder = 0 }: { markera?: string; nr: number; tryck: (id: string) => void; bilder?: number }) {
  return (
    <>
      <NyHjalp rubrik="Foton och preparat">Fotografera det kunden behöver åtgärda och lägg in preparat du har använt. Bilderna sparas när du går vidare eller sparar ärendet.</NyHjalp>
      <Sektion>
        <button type="button" onClick={() => tryck('preparat')} className="flex items-center gap-2 text-left">
          <span className="rounded-md bg-purple-500/20 p-1 text-purple-400"><Icon name="rapport.betning" size={16} className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold text-white">Använda preparat</span><span className="block text-[10px] text-slate-400">0 registrerade</span></span>
          <Icon name="allman.chevron" size={16} className="h-3.5 w-3.5 rotate-90 text-slate-400" />
        </button>
      </Sektion>
      <Sektion titel="Bilder" ikon="allman.foto" ikonFarg="text-cyan-400">
        {bilder > 0 && (
          <div className="flex gap-1">
            {Array.from({ length: bilder }, (_, i) => (
              <span key={i} className="flex h-10 w-12 items-center justify-center rounded-md bg-slate-700 text-slate-400"><Icon name="allman.foto" size={16} /></span>
            ))}
          </div>
        )}
        <TextLank ikon="allman.plus" onClick={() => tryck('bilder')} markor={mk(markera, 'bilder', nr)}>Lägg till bilder</TextLank>
      </Sektion>
    </>
  )
}

export function RapportInnehall({ markera, nr, tryck, skrivet, skickad }: { markera?: string; nr: number; tryck: (id: string) => void; skrivet?: boolean; skickad?: boolean }) {
  const enhet = useGuideEnhet()
  return (
    <>
      <NyHjalp rubrik="Rapport">Skriv vad du gjorde i saneringsrapporten. Rapporten skickas inte av sig själv, ladda ned den eller skicka den med knapparna längst ner i steget.</NyHjalp>
      <Sektion titel="Saneringsrapport" ikon="rapport.rapport" ikonFarg="text-purple-400">
        <Inmatning varde={skrivet ? 'Fällor och betesstationer utplacerade i källaren. Ventil vid tvättstugan behöver tätas.' : 'Metoder, resultat, rekommendationer...'} tom={!skrivet} hog
          onClick={() => tryck('rapporttext')} markor={mk(markera, 'rapporttext', nr)} />
      </Sektion>
      <Sektion>
        <div className="flex items-center gap-1.5">
          <span className="flex flex-none items-center gap-1 text-[11.5px] font-semibold text-white"><Icon name="rapport.rapport" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Specialrapporter</span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">Ingen än. En fri rapport med delar, händelser och bilder.</span>
          <Markor markor={mk(markera, 'specialrapport', nr)}>
            <button type="button" aria-label="Skapa specialrapport" onClick={() => tryck('specialrapport')} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800"><Icon name="allman.plus" size={16} /></button>
          </Markor>
        </div>
      </Sektion>
      <div className={`grid gap-1.5 ${enhet === 'dator' ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <StegKnapp ikon="rapport.ladda" onClick={() => tryck('ladda')} markor={mk(markera, 'ladda', nr)}>Ladda ned</StegKnapp>
        <StegKnapp ikon="kontakt.mejl" onClick={() => tryck('skicka-kund')} markor={mk(markera, 'skicka-kund', nr)}>Skicka till Familjen Exempel</StegKnapp>
        <StegKnapp ikon="rapport.skicka" onClick={() => tryck('skicka-tekniker')} markor={mk(markera, 'skicka-tekniker', nr)}>Skicka till ansvarig tekniker</StegKnapp>
      </div>
      {skickad && <p className="text-[10.5px] text-slate-400">Rapport framtagen Nyss, version 1 av 1, skickad till kund.</p>}
    </>
  )
}

// ─── Pris och fakturering ──────────────────────────

export interface PrisLage {
  /** Raderna under Tjänster & fakturarader */
  rader: { namn: string; pris: number; antal?: number }[]
  /** ROT-uppdelning på första raden: arbetskostnad inkl. moms och timmar */
  delning?: { arbete: number; timmar: number; typ: 'ROT' | 'RUT' } | null
  /** Formuläret Dela upp för ROT/RUT är öppet, med det som är ifyllt */
  delform?: { arbete: number | null; timmar: number | null; typ: 'ROT' | 'RUT' | null } | null
  fastighet?: string | null
  /** Fältet Fastighetsbeteckning * är rött (från Gå till steget) */
  fastighetFel?: boolean
  /** Interna kostnader utfällt, med artiklarna */
  interna?: string[] | null
  marginal?: string
  /** Tailwind-färg för marginalen, standard grön */
  marginalFarg?: string
  /** Artiklar att välja under Interna kostnader */
  valbara?: string[]
  /** Visa provisionsdelen i stället för raderna */
  provision?: boolean
  /** Företagsärende: priser exkl. moms */
  foretag?: boolean
}

const ROT_PCT = 30
const RUT_PCT = 50

export function PrisInnehall({ l, markera, nr, tryck }: { l: PrisLage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const total = l.rader.reduce((s, r) => s + r.pris * (r.antal ?? 1), 0)
  const avdrag = l.delning ? l.delning.arbete * (l.delning.typ === 'ROT' ? ROT_PCT : RUT_PCT) / 100 : 0
  if (l.provision) return <ProvisionDel underlagExkl={l.foretag ? total : total / 1.25} />
  return (
    <>
      {!l.delform && !l.interna && (
        <NyHjalp rubrik="Pris och fakturering">Lägg in tjänster och artiklar som gick åt. Prisguiden visar inköpspris och marginal. Raderna faktureras när ärendet stängs. Provisionen fördelar du längst ner.</NyHjalp>
      )}
      <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
        <div className="flex items-center gap-1.5">
          <Icon name="sok.faktura" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-white">Tjänster & fakturarader</span>
          {l.marginal && <span className={`text-[10px] font-medium ${l.marginalFarg ?? 'text-emerald-400'}`}>{l.marginal} marginal</span>}
          <Markor markor={mk(markera, 'prisguide', nr)}>
            <button type="button" onClick={() => tryck('prisguide')} className="flex items-center gap-1 rounded-md bg-slate-700 px-1.5 py-0.5 text-[10.5px] text-slate-200">
              <Icon name="allman.kalkyl" size={16} className="h-3 w-3" />Prisguide
            </button>
          </Markor>
        </div>
        {l.rader.length === 0 && <p className="py-1 text-center text-[10.5px] text-slate-500">Inga tjänster tillagda än</p>}
        {l.rader.map((r, i) => {
          const delad = i === 0 && l.delning
          return (
            <div key={r.namn} className="grid gap-1 rounded-lg border border-slate-700/50 bg-slate-800/40 p-1.5">
              <p className="text-[11.5px] font-medium text-white">{r.namn}</p>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5 text-[11px] text-white">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-700 text-slate-300"><Icon name="allman.minus" size={16} className="h-2.5 w-2.5" /></span>
                  <span className="w-4 text-center">{r.antal ?? 1}</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-700 text-slate-300"><Icon name="allman.plus" size={16} className="h-2.5 w-2.5" /></span>
                </span>
                <span className="ml-auto rounded border border-slate-600 bg-slate-700 px-1.5 text-right text-[11px] text-white">{(delad ? r.pris * (r.antal ?? 1) : r.pris).toLocaleString('sv-SE')}</span>
                <span className="text-[10px] text-slate-400">{delad ? 'kr totalt' : 'kr/st'}</span>
              </div>
              {delad && l.delning && (
                <div className="ml-1 grid gap-0.5 border-l-2 border-[#20c58f]/40 pl-2">
                  <p className="text-[10.5px] text-slate-300"><span className="mr-1 text-[#20c58f]">●</span>Varav arbetskostnad <b className="text-white">{kr(l.delning.arbete)}</b>, {l.delning.timmar} h, {l.delning.typ}</p>
                  <p className="text-[10px] text-slate-500">Material och övrigt {kr(r.pris - l.delning.arbete)}</p>
                  <Inmatning varde={l.fastighet || 'Fastighetsbeteckning *'} tom={!l.fastighet} fel={l.fastighetFel && !l.fastighet}
                    onClick={() => tryck('fastighet')} markor={mk(markera, 'fastighet', nr)} />
                  {l.fastighetFel && !l.fastighet && <p className="text-[9.5px] text-red-400">Fastighetsbeteckning krävs för ROT/RUT</p>}
                </div>
              )}
              {i === 0 && l.delform && <DelaUppForm f={l.delform} totalInkl={r.pris * (r.antal ?? 1)} markera={markera} nr={nr} tryck={tryck} />}
              {i === 0 && !l.delning && !l.delform && !l.foretag && (
                <TextLank ikon="allman.kalkyl" onClick={() => tryck('delaupp')} markor={mk(markera, 'delaupp', nr)}>Dela upp för ROT/RUT</TextLank>
              )}
            </div>
          )
        })}
        {!l.delform && <TextLank ikon="allman.plus" onClick={() => tryck('tillagg')} markor={mk(markera, 'tillagg', nr)}>Lägg till tilläggstjänst</TextLank>}
        {l.rader.length > 0 && !l.delform && !l.interna && (
          <div className="grid gap-0.5 border-t border-slate-700/50 pt-1 text-[10.5px]">
            <p className="flex justify-between"><span className="text-slate-400">{l.foretag ? 'Exkl. moms' : 'Inkl. moms'}</span><span className="font-semibold text-white">{kr(total)}</span></p>
            {avdrag > 0 && l.delning && <>
              <p className="flex justify-between text-[#20c58f]"><span>{l.delning.typ}-avdrag</span><span>-{kr(avdrag)}</span></p>
              <p className="flex justify-between"><span className="font-medium text-slate-300">Att betala (kund)</span><span className="font-bold text-[#20c58f]">{kr(total - avdrag)}</span></p>
            </>}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-2">
        <Markor markor={mk(markera, 'interna', nr)} block>
          <button type="button" onClick={() => tryck('interna')} className="flex w-full items-center gap-1.5 text-left">
            <Icon name="bokning.artikel" size={16} className="h-3.5 w-3.5 text-slate-400" />
            <span className="flex-1 text-[11.5px] font-semibold text-slate-300">Interna kostnader</span>
            {l.interna && l.interna.length > 0 && <span className="text-[10px] text-slate-400">{l.interna.length} st</span>}
            <Icon name="allman.chevron" size={16} className={`h-3.5 w-3.5 text-slate-400 ${l.interna ? 'rotate-90' : ''}`} />
          </button>
        </Markor>
        {l.interna && (
          <div className="mt-1.5 grid gap-1">
            {l.interna.map(a => <p key={a} className="flex justify-between rounded-md bg-slate-800/60 px-1.5 py-0.5 text-[10.5px] text-slate-200"><span>{a}</span><span className="text-slate-400">inköp</span></p>)}
            <Inmatning varde="Sök artikel..." tom onClick={() => tryck('sokartikel')} />
            {(l.valbara ?? ['Snapfälla råtta', 'Betesstation råtta']).filter(a => !l.interna?.includes(a)).map(a => (
              <Markor key={a} markor={mk(markera, `artikel:${a}`, nr)} block>
                <button type="button" onClick={() => tryck(`artikel:${a}`)} className="flex w-full justify-between rounded-md border border-slate-700 px-1.5 py-1 text-[10.5px] text-slate-100">
                  <span>{a}</span><span className="text-[#20c58f]">Lägg till</span>
                </button>
              </Markor>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function DelaUppForm({ f, totalInkl, markera, nr, tryck }: { f: NonNullable<PrisLage['delform']>; totalInkl: number; markera?: string; nr: number; tryck: (id: string) => void }) {
  const arbete = f.arbete ?? 0
  const pct = f.typ === 'ROT' ? ROT_PCT : f.typ === 'RUT' ? RUT_PCT : null
  const avdrag = pct ? arbete * pct / 100 : 0
  return (
    <div className="grid gap-1 rounded-md border border-slate-700/50 bg-slate-800/30 p-1.5">
      <p className="text-[9.5px] leading-snug text-slate-400">ROT/RUT gäller bara arbetskostnaden. Arbetet blir en egen rad "Skadedjurstekniker timpris" som bär avdraget. Totalen mot kund ändras inte.</p>
      <div className="grid grid-cols-2 gap-1">
        <Inmatning etikett="Varav arbetskostnad" varde={f.arbete != null ? kr(f.arbete) : '0'} tom={f.arbete == null} hjalp="inkl. moms" onClick={() => tryck('arbetskostnad')} markor={mk(markera, 'arbetskostnad', nr)} />
        <Inmatning etikett="Timmar" varde={f.timmar != null ? `${f.timmar} h` : '1'} tom={f.timmar == null} onClick={() => tryck('timmar')} markor={mk(markera, 'timmar', nr)} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400">Avdrag</span>
        <Radio pa={f.typ === 'ROT'} text={`ROT (${ROT_PCT} %)`} onClick={() => tryck('rot')} markor={mk(markera, 'rot', nr)} />
        <Radio pa={f.typ === 'RUT'} text={`RUT (${RUT_PCT} %)`} onClick={() => tryck('rut')} />
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-[10px]">
        <dt className="text-slate-400">Material och övrigt</dt><dd className="text-right text-slate-200">{kr(totalInkl - arbete)}</dd>
        <dt className="text-slate-400">Arbetskostnad</dt><dd className="text-right text-slate-200">{kr(arbete)}</dd>
        <dt className="text-slate-400">{f.typ ? `${f.typ}-avdrag (${pct} %)` : 'ROT- eller RUT-avdrag'}</dt><dd className={`text-right ${f.typ ? 'text-[#20c58f]' : 'text-slate-500'}`}>{f.typ ? `-${kr(avdrag)}` : 'Välj ROT eller RUT'}</dd>
        <dt className="font-medium text-slate-300">Kunden betalar</dt><dd className="text-right font-semibold text-white">{kr(totalInkl - avdrag)}</dd>
      </dl>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => tryck('avbryt-delning')} className="text-[10.5px] text-slate-400">Avbryt</button>
        <Markor markor={mk(markera, 'delaupp-ok', nr)}>
          <button type="button" onClick={() => tryck('delaupp-ok')} className="rounded-md bg-[#20c58f] px-2 py-0.5 text-[10.5px] font-medium text-[#fff]">Dela upp</button>
        </Markor>
      </div>
    </div>
  )
}

/** Provisionsdelen längst ner i steget, som CommissionSection */
export function ProvisionDel({ underlagExkl, nej }: { underlagExkl: number; nej?: boolean }) {
  const under = underlagExkl < 4000
  return (
    <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-200"><Icon name="falt.pris" size={16} className="h-3.5 w-3.5 text-emerald-400" />Provision</p>
      <div className="flex gap-3">
        <Radio pa={!nej} text="Ja, provisionsgrundande" />
        <Radio pa={!!nej} text="Nej" />
      </div>
      {!nej && under && (
        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-1.5 text-[10px] leading-snug text-yellow-400">
          Beloppet {Math.round(underlagExkl).toLocaleString('sv-SE')} kr understiger minsta provisionsgrundande belopp (4 000 kr exkl moms). Provision skapas inte.
        </p>
      )}
      {!nej && (
        <>
          <p className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-1.5 text-[10px] text-slate-400">Provisionsprocent: <b className="text-slate-200">6%</b> · Grundbelopp: <b className="text-slate-200">{Math.round(underlagExkl).toLocaleString('sv-SE')} kr</b></p>
          <p className="text-[10px] font-medium text-slate-400">Fördelning mellan tekniker</p>
          <p className="flex items-center justify-between text-[11px] text-slate-300"><span>Du</span><span>100 %</span><span className="font-medium text-emerald-400">{under ? '0 kr' : kr(underlagExkl * 0.06)}</span></p>
        </>
      )}
    </div>
  )
}

// ─── Klart ─────────────────────────────────────────

/** Punkterna i Det här händer när du stänger. Provisionsraden gäller exemplet 3 750 kr inkl. moms (3 000 kr exkl.). */
export const VAD_HANDER_STANG = [
  'Ärendet får status Avslutat och dagens datum som avslutsdatum.',
  'Besöket sparas i besökshistoriken med teknikerna, rapporten och tiden.',
  'Raderna under Pris och fakturering blir en faktura på kunden, som går vidare till godkännande och Fortnox som i dag. Är underlaget 0 kr skapas ingen faktura.',
  'Underlaget 3 000 kr exkl. moms är under gränsen för provision (4 000 kr), ingen provision registreras.',
  'Rapporten skickas inte av sig själv. Skicka den i steget Rapport.',
]

export const VAD_HANDER_BESOK = [
  'Du väljer ny tid i återbesöksdialogen. Ärendet får status Återbesök och stängs inte.',
  'Besöket sparas i besökshistoriken med teknikerna och rapporten.',
  'Delfakturering är en kryssruta i samma dialog. Den visas när ärendet har tjänster som inte är fakturerade.',
]

export interface KlartLage {
  /** Hinder som visas, tom lista = Inget saknas */
  hinder: { text: string; steg: string }[]
  val: 'hela' | 'besok'
  /** Stängt: Ärendet är avslutat */
  avslutat?: boolean
  /** Bara besöket finns inte (följeärende) */
  utanBesok?: boolean
  /** Egen provisionsrad i Det här händer när du stänger (standard: exemplet under gränsen) */
  provisionText?: string
}

export function KlartInnehall({ k, markera, nr, tryck }: { k: KlartLage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const enhet = useGuideEnhet()
  if (k.avslutat) {
    return (
      <>
        <div className="flex items-start gap-2 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/10 p-2">
          <Icon name="falt.klart" size={20} className="flex-none text-[#20c58f]" />
          <div>
            <p className="text-[12px] font-semibold text-white">Ärendet är avslutat</p>
            <p className="text-[10.5px] text-slate-300">Status Avslutat, avslutsdatum 2026-10-26. Ändringar du gör nu sparar du med knappen nedan.</p>
          </div>
        </div>
        <StegKnapp ikon="allman.bock" onClick={() => tryck('spara')}>Spara ändringar</StegKnapp>
      </>
    )
  }
  const lista = k.val === 'hela' ? VAD_HANDER_STANG.map((t, i) => (i === 3 && k.provisionText ? k.provisionText : t)) : VAD_HANDER_BESOK
  const kort = enhet === 'mobil' ? lista.slice(0, 3) : lista
  return (
    <>
      <div className="grid gap-1">
        <p className="text-[12px] font-semibold text-white">Kontrollera innan du stänger</p>
        {k.hinder.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[10.5px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Inget saknas enligt det som är sparat.</p>
        ) : (
          <div className="grid gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2">
            <p className="text-[11.5px] font-semibold text-amber-200">{k.hinder.length === 1 ? '1 sak saknas' : `${k.hinder.length} saker saknas`} innan ärendet kan stängas.</p>
            {k.hinder.map(h => (
              <div key={h.text} className="grid gap-1">
                <p className="text-[10.5px] leading-snug text-slate-200">{h.text}</p>
                <Markor markor={mk(markera, `gatill:${h.steg}`, nr)}>
                  <button type="button" onClick={() => tryck(`gatill:${h.steg}`)} className="flex items-center gap-1 rounded-lg border border-amber-500 px-2 py-1 text-[10.5px] font-semibold text-amber-200">
                    Gå till steget {h.steg}<Icon name="allman.chevron" size={16} className="h-3 w-3" />
                  </button>
                </Markor>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-1">
        <p className="text-[12px] font-semibold text-white">Vad är klart?</p>
        <div className={`grid gap-1.5 ${enhet === 'dator' && !k.utanBesok ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Valkort rubrik="Hela ärendet" text="Ärendet avslutas, får avslutsdatum och stängs för fakturering." vald={k.val === 'hela'} onClick={() => tryck('hela')} markor={mk(markera, 'hela', nr)} />
          {!k.utanBesok && <Valkort rubrik="Bara besöket" text="Ärendet fortsätter med ett återbesök. Det stängs inte." vald={k.val === 'besok'} onClick={() => tryck('besok')} markor={mk(markera, 'besok', nr)} />}
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-1.5">
        <p className="mb-0.5 text-[10.5px] font-semibold text-white">{k.val === 'hela' ? 'Det här händer när du stänger' : 'Det här händer när du bokar återbesöket'}</p>
        <ul className="m-0 grid list-disc gap-0.5 pl-4 text-[9.5px] leading-snug text-slate-300">{kort.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
      <Markor markor={mk(markera, k.val === 'hela' ? 'stang-hela' : 'boka', nr)} block>
        <button type="button" onClick={() => tryck(k.val === 'hela' ? 'stang-hela' : 'boka')}
          className="flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#20c58f] text-[12px] font-bold text-[#04281c]">
          {k.val === 'besok' && <Icon name="arende.aterbesok" size={16} />}
          {k.val === 'hela' ? 'Stäng hela ärendet' : 'Boka återbesök'}
        </button>
      </Markor>
      <StegKnapp ikon="allman.bock" onClick={() => tryck('spara-utan')} markor={mk(markera, 'spara-utan', nr)}>Spara utan att stänga</StegKnapp>
      <div><TextLank ikon="lead.tips" onClick={() => tryck('lead')} markor={mk(markera, 'lead', nr)}>Skapa lead</TextLank></div>
    </>
  )
}

function Valkort({ rubrik, text, vald, onClick, markor }: { rubrik: string; text: string; vald: boolean; onClick: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" role="radio" aria-checked={vald} onClick={onClick}
        className={`w-full rounded-xl p-1.5 text-left ${vald ? 'border-2 border-[#20c58f] bg-[#20c58f]/10' : 'border border-slate-600 bg-slate-800/40'}`}>
        <span className="block text-[11.5px] font-semibold text-white">{rubrik}</span>
        <span className="block text-[10px] leading-snug text-slate-400">{text}</span>
      </button>
    </Markor>
  )
}

// ─── Lager ovanpå ärendet ──────────────────────────

/** Lager i ramen: bottenark i telefonen, ruta i mitten (eller uppe till höger) på datorn */
export function Lager({ children, hoger }: { children: ReactNode; hoger?: boolean }) {
  const enhet = useGuideEnhet()
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : hoger ? 'items-start justify-end p-2' : 'items-center justify-center p-3'}`}>
      <div className={`flex max-h-full w-full flex-col overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl ${enhet === 'mobil' ? 'max-h-[88%] rounded-t-2xl' : 'max-w-[340px] rounded-2xl'}`}>
        {children}
      </div>
    </div>
  )
}

export interface VerktygVal { id: string; ikon: IconName; text: string; beskrivning: string; fara?: boolean }

/** Ärendets verktyg för ett privatärende, samma grupper och texter som verktygGrupper i EditCaseModal */
export const VERKTYG: { rubrik: string; val: VerktygVal[] }[] = [
  { rubrik: 'Rapporter', val: [
    { id: 'ladda-ned', ikon: 'rapport.ladda', text: 'Ladda ned rapporten', beskrivning: 'Saneringsrapporten som PDF. Finns en rapport redan frågar appen om en ny version.' },
    { id: 'skicka-tekniker', ikon: 'rapport.skicka', text: 'Skicka till ansvarig tekniker', beskrivning: 'Skicka till ansvarig tekniker' },
    { id: 'skicka-kontakt', ikon: 'kontakt.mejl', text: 'Skicka till kontaktperson', beskrivning: 'Skicka till Familjen Exempel' },
    { id: 'specialrapport', ikon: 'falt.specialrapport', text: 'Specialrapporter', beskrivning: 'Skapa, öppna och ladda ned specialrapporter. De finns i steget Rapport.' },
  ] },
  { rubrik: 'Avtal och offert', val: [
    { id: 'avtal', ikon: 'dok.avtal', text: 'Skapa avtal', beskrivning: 'Öppnar avtalskaparen i Oneflow med kunduppgifterna ifyllda.' },
    { id: 'offert', ikon: 'dok.offert', text: 'Skapa offert', beskrivning: 'Öppnar offertskaparen i Oneflow med ärendets tjänster och artiklar ifyllda.' },
  ] },
  { rubrik: 'Återbesök och nytt ärende', val: [
    { id: 'boka-aterbesok', ikon: 'arende.aterbesok', text: 'Boka återbesök', beskrivning: 'Flytta ärendet till ett framtida datum. Delfakturering är en kryssruta i dialogen.' },
    { id: 'nytt-arende', ikon: 'allman.plus', text: 'Skapa nytt ärende', beskrivning: 'Nytt problem hos samma kund (annat skadedjur).' },
    { id: 'duplicera', ikon: 'rapport.kopia', text: 'Duplicera ärende', beskrivning: 'Skapa en kopia och välj vad som följer med.' },
  ] },
  { rubrik: 'Kontakt och plats', val: [
    { id: 'kommunikation', ikon: 'kontakt.mote', text: 'Kommunikation', beskrivning: 'Intern chatt om ärendet med kontoret och andra tekniker.' },
    { id: 'kartor', ikon: 'falt.navigera', text: 'Öppna adressen i kartor', beskrivning: 'Exempelvägen 4, Södertälje' },
    { id: 'ring', ikon: 'kontakt.telefon', text: 'Ring Familjen Exempel', beskrivning: '070-123 45 67' },
  ] },
  { rubrik: 'Ärendet', val: [
    { id: 'byt-namn', ikon: 'rapport.penna', text: 'Byt ärendenamn', beskrivning: 'Nu Råttor i källaren. Namnet ändras överst i ärendet och sparas med ärendet.' },
    { id: 'historik', ikon: 'allman.historik', text: 'Historik', beskrivning: 'Ändringar och händelser i ärendet.' },
    { id: 'lead', ikon: 'lead.tips', text: 'Skapa lead', beskrivning: 'Tipsa om ett löpande avtal eller merförsäljning. Knappen finns i steget Klart.' },
    { id: 'alla-uppgifter', ikon: 'falt.uppgifter', text: 'Alla uppgifter', beskrivning: 'Den vanliga flikvyn med Ärende, Utförande och Ekonomi. Allt som sparas där syns i stegen.' },
    { id: 'status', ikon: 'arende.status', text: 'Ändra status', beskrivning: 'Nu Bokad. Statusstegen visas överst i Alla uppgifter. Spara efter bytet.' },
  ] },
  { rubrik: 'Ta bort', val: [
    { id: 'radera', ikon: 'allman.radera', text: 'Radera ärende', beskrivning: 'Frågar en gång till innan ärendet tas bort.', fara: true },
  ] },
]

/** Ärendets verktyg som ark (telefon) eller panel uppe till höger (dator) */
export function VerktygArk({ markera, nr, tryck, grupper }: { markera?: string; nr: number; tryck: (id: string) => void; grupper?: string[] }) {
  const visa = grupper ? VERKTYG.filter(g => grupper.includes(g.rubrik)) : VERKTYG
  return (
    <Lager hoger>
      <div className="flex flex-none items-start gap-2 border-b border-slate-700/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">Ärendets verktyg</p>
          <p className="truncate text-[10.5px] text-slate-400">{NR}, Familjen Exempel</p>
        </div>
        <button type="button" aria-label="Stäng ärendets verktyg" onClick={() => tryck('stang-verktyg')} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.stang" size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {visa.map(g => (
          <div key={g.rubrik} className="pt-1.5">
            <p className="px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">{g.rubrik}</p>
            {g.val.map(v => (
              <Markor key={v.id} markor={mk(markera, `verktyg:${v.id}`, nr)} block>
                <button type="button" onClick={() => tryck(`verktyg:${v.id}`)}
                  className={`flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-800 ${v.fara ? 'text-red-400' : 'text-white'}`}>
                  <Icon name={v.ikon} size={16} className={`mt-0.5 flex-none ${v.fara ? 'text-red-400' : 'text-slate-300'}`} />
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-medium leading-snug">{v.text}</span>
                    <span className="block text-[10px] leading-snug text-slate-400">{v.beskrivning}</span>
                  </span>
                </button>
              </Markor>
            ))}
          </div>
        ))}
      </div>
    </Lager>
  )
}

/** Alla uppgifter: den vanliga flikvyn med statusstegen och flikarna Ärende, Utförande och Ekonomi */
export function FlikVy({ markera, nr, tryck }: { markera?: string; nr: number; tryck: (id: string) => void }) {
  const enhet = useGuideEnhet()
  const innehall = (
    <div className="flex h-full min-h-0 flex-col bg-slate-900">
      <div className="flex flex-none items-start justify-between gap-2 border-b border-slate-700/60 px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] font-semibold text-white">{NR}</p>
          <p className="truncate text-[10.5px] text-slate-400">{KUND}</p>
        </div>
        <div className="flex flex-none">
          <Markor markor={mk(markera, 'tillbaka-steg', nr)}>
            <button type="button" aria-label="Tillbaka till stegen" title="Tillbaka till stegen" onClick={() => tryck('tillbaka-steg')} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"><Icon name="guide.steg" size={20} /></button>
          </Markor>
          <button type="button" aria-label="Ärendets verktyg" onClick={() => tryck('verktyg')} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"><Icon name="falt.verktyg" size={20} /></button>
        </div>
      </div>
      <div className="flex flex-none items-center gap-1 px-3 py-1.5 text-[10px] text-slate-400">
        {['Öppen', 'Bokad', 'Avslutat'].map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-4 bg-slate-600" />}
            <span className={`h-2 w-2 rounded-full ${s === 'Bokad' ? 'bg-[#20c58f]' : i === 0 ? 'bg-[#20c58f]/50' : 'bg-slate-600'}`} />
            <span className={s === 'Bokad' ? 'font-semibold text-white' : ''}>{s}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-none gap-1 border-b border-slate-700/50 px-3 pb-1.5">
        {['Ärende', 'Utförande', 'Ekonomi'].map((f, i) => (
          <button key={f} type="button" onClick={() => tryck(`flik:${f}`)} className={`rounded-md px-2 py-0.5 text-[11px] ${i === 0 ? 'border border-[#20c58f]/30 bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400'}`}>{f}</button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-hidden p-2.5">
        <ArbeteInnehallUtanHjalp tryck={tryck} />
        <Sektion titel="Schemaläggning" ikon="allman.kalender" ikonFarg="text-purple-400">
          <div className="grid grid-cols-2 gap-1">
            <Inmatning etikett="Starttid" varde="2026-10-26 08:00" onClick={() => tryck('starttid')} markor={mk(markera, 'starttid', nr)} />
            <Inmatning etikett="Sluttid" varde="2026-10-26 09:00" onClick={() => tryck('sluttid')} markor={mk(markera, 'sluttid', nr)} />
          </div>
        </Sektion>
      </div>
    </div>
  )
  if (enhet === 'dator') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3">
        <div className="flex h-full max-h-[420px] w-full max-w-[460px] flex-col overflow-hidden rounded-xl border border-slate-700 shadow-2xl">{innehall}</div>
      </div>
    )
  }
  return <div className="absolute inset-0 z-30">{innehall}</div>
}

function ArbeteInnehallUtanHjalp({ tryck }: { tryck: (id: string) => void }) {
  return (
    <Sektion titel="Ärendeinformation" ikon="arende.arende" ikonFarg="text-teal-400">
      <Inmatning etikett="Beskrivning" varde="Råttor i källaren, spår vid tvättstugan." onClick={() => tryck('beskrivning')} />
    </Sektion>
  )
}

// ─── Boka återbesök (RevisitModal) ─────────────────

export interface AterbesokLage {
  steg: 1 | 2
  datum: boolean
  langd: 30 | 60 | 90 | 120
  manuellt: boolean
  tid: string | null
  anteckning: boolean
  delfaktura: boolean
  /** Ärendet har ett anpassat pris för hela jobbet: kryssrutan är grå */
  anpassatPris?: boolean
  /** Rader på delfakturan, exkl. moms */
  rader?: [string, number][]
}

export const TIDER = ['08:00', '10:30', '13:30']
const LANGD_TEXT: Record<number, string> = { 30: '30 min', 60: '1 tim', 90: '1.5 tim', 120: '2 tim' }

export function AterbesokRuta({ a, markera, nr, tryck }: { a: AterbesokLage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const enhet = useGuideEnhet()
  const rader = a.rader ?? []
  const summa = rader.reduce((s, r) => s + r[1], 0)
  const slut = (start: string) => {
    const [h, m] = start.split(':').map(Number)
    const t = h * 60 + m + a.langd
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  const teal = 'bg-teal-500 text-[#fff]'
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? 'items-stretch p-1.5' : 'items-center justify-center p-3'}`}>
      <div className={`flex w-full flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ${enhet === 'dator' ? 'max-h-full max-w-[400px]' : ''}`}>
        <div className="flex flex-none items-center gap-2 border-b border-slate-700 px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400"><Icon name="allman.kalender" size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">Boka återbesök</p>
            <p className="truncate text-[10.5px] text-slate-400">{a.steg === 1 ? 'Välj datum och längd' : 'Förslag · tisdag 27 oktober'}</p>
          </div>
          <button type="button" aria-label="Stäng" onClick={() => tryck('stang-aterbesok')} className="text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-2.5">
          <div className="flex items-center gap-2 text-[10.5px] font-medium">
            <span className={`flex items-center gap-1 ${a.steg === 1 ? 'text-teal-400' : 'text-slate-500'}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${a.steg === 1 ? teal : 'bg-slate-700'}`}>1</span>Välj datum</span>
            <span className="h-px flex-1 bg-slate-700" />
            <span className={`flex items-center gap-1 ${a.steg === 2 ? 'text-teal-400' : 'text-slate-500'}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${a.steg === 2 ? teal : 'bg-slate-700'}`}>2</span>Välj tid</span>
          </div>
          {a.steg === 1 ? (
            <>
              <Inmatning etikett="Datum för återbesök *" varde={a.datum ? 'tisdag 27 okt 2026' : 'Välj datum'} tom={!a.datum} onClick={() => tryck('datum')} markor={mk(markera, 'datum', nr)} />
              <div className="grid gap-0.5">
                <span className="text-[10.5px] font-medium text-slate-400">Besökslängd</span>
                <div className="flex flex-wrap gap-1">
                  {([30, 60, 90, 120] as const).map(m => (
                    <Markor key={m} markor={mk(markera, `langd:${m}`, nr)}>
                      <button type="button" onClick={() => tryck(`langd:${m}`)} className={`rounded-md px-2 py-0.5 text-[10.5px] font-medium ${a.langd === m ? teal : 'bg-slate-700 text-slate-300'}`}>{LANGD_TEXT[m]}</button>
                    </Markor>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                <button type="button" onClick={() => tryck('smarta')} className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium ${!a.manuellt ? teal : 'bg-slate-700 text-slate-300'}`}><Icon name="allman.kalender" size={16} className="h-3 w-3" />Smarta förslag</button>
                <Markor markor={mk(markera, 'manuellt', nr)}>
                  <button type="button" onClick={() => tryck('manuellt')} className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium ${a.manuellt ? teal : 'bg-slate-700 text-slate-300'}`}><Icon name="rapport.penna" size={16} className="h-3 w-3" />Ange tid manuellt</button>
                </Markor>
              </div>
              {a.manuellt ? (
                <Inmatning etikett="Välj starttid *" varde={a.tid ? `tisdag 27 okt 2026 ${a.tid}` : 'Välj datum och tid'} tom={!a.tid} onClick={() => tryck('manuell-tid')} markor={mk(markera, 'manuell-tid', nr)} />
              ) : (
                <div className="grid gap-1">
                  {TIDER.map(t => (
                    <Markor key={t} markor={mk(markera, `tid:${t}`, nr)} block>
                      <button type="button" onClick={() => tryck(`tid:${t}`)}
                        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left ${a.tid === t ? 'border-teal-400 bg-teal-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                        <span className="text-[11.5px] font-semibold text-white">{t} till {slut(t)}</span>
                        <span className="text-[10px] text-slate-400">Du</span>
                      </button>
                    </Markor>
                  ))}
                </div>
              )}
              {a.tid && <p className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10.5px] text-teal-300">Vald tid: tisdag 27 okt {a.tid} till {slut(a.tid)}</p>}
              <Inmatning etikett="Anteckning (valfritt)" varde={a.anteckning ? 'Kontrollera fällorna i källaren' : 'T.ex. kontrollera betesintag'} tom={!a.anteckning} onClick={() => tryck('anteckning')} markor={mk(markera, 'anteckning', nr)} />
              <div className={`grid gap-1 rounded-lg border border-slate-700/50 bg-slate-800/50 p-1.5 ${a.anpassatPris ? 'opacity-60' : ''}`}>
                {rader.length === 0 ? (
                  <p className="flex items-center gap-1 text-[10px] text-slate-500"><Icon name="sok.faktura" size={16} className="h-3 w-3" />Inga ofakturerade tjänster på ärendet</p>
                ) : (
                  <>
                    <Markor markor={mk(markera, 'delfaktura', nr)}>
                      <button type="button" role="checkbox" aria-checked={a.delfaktura} onClick={() => tryck('delfaktura')} className="flex items-center gap-1.5 text-left text-[11px] font-medium text-slate-200">
                        <span className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${a.delfaktura ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-slate-500'}`}>{a.delfaktura && <Icon name="allman.bock" size={16} className="h-2.5 w-2.5" />}</span>
                        <Icon name="sok.faktura" size={16} className={`h-3.5 w-3.5 ${a.anpassatPris ? 'text-slate-500' : 'text-[#20c58f]'}`} />
                        Skapa delfaktura för nuvarande tjänster
                      </button>
                    </Markor>
                    {a.anpassatPris && <p className="ml-5 text-[10px] text-slate-400">Ärendet har ett anpassat pris för hela jobbet. Det faktureras när ärendet avslutas.</p>}
                    {a.delfaktura && !a.anpassatPris && (
                      <div className="ml-5 grid gap-0.5 text-[10px]">
                        {rader.map(r => <p key={r[0]} className="flex justify-between text-slate-400"><span>{r[0]}</span><span className="font-medium text-white">{kr(r[1])}</span></p>)}
                        <p className="flex justify-between border-t border-slate-700/50 pt-0.5"><span className="text-slate-400">Totalt (exkl. moms)</span><span className="font-semibold text-[#20c58f]">{kr(summa)}</span></p>
                        <p className="text-amber-400/80">Tjänsterna markeras som fakturerade och tas bort från ärendet.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-none items-center justify-between gap-2 border-t border-slate-700 px-3 py-2">
          <span>{a.steg === 2 && <button type="button" onClick={() => tryck('byt-datum')} className="text-[10.5px] text-slate-400">← Byt datum</button>}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => tryck('avbryt')} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200">Avbryt</button>
            <Markor markor={mk(markera, a.steg === 1 ? 'visa' : 'boka-ok', nr)}>
              <button type="button" onClick={() => tryck(a.steg === 1 ? 'visa' : 'boka-ok')} aria-disabled={a.steg === 1 ? !a.datum : !a.tid}
                className={`flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-[#fff] ${(a.steg === 1 ? !a.datum : !a.tid) ? 'opacity-50' : ''}`}>
                {a.steg === 2 && <Icon name="allman.kalender" size={16} className="h-3.5 w-3.5" />}
                {a.steg === 1 ? 'Visa förslag →' : 'Boka återbesök'}
              </button>
            </Markor>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Bekräftelsen längst ner, som portalens toast */
export { Notis }
