// src/pages/shared/intranet/guider/guide-boka-in.tsx
// Guidemodul: Boka in en signerad offert eller ett signerat avtal (admin och koordinator, dator).
// Efterbildning av Boka in (components/coordinator/bokaIn/BokaIn.tsx) från kontorets
// Dokumentsignering: Nästa steg-rutan med Boka in, förstegsdialogen "Boka in <kund>" med
// Ärendetyp (förvald efter mallen), Underlaget från signeringen, Offertens rader med
// kryssrutor, "Fortsätt till tid och tekniker", och CreateCaseModal förifylld med rutan
// "Boka in från offert ...", "Sök bland valda tekniker" där bara den ansvariga teknikern
// är ibockad, Hitta bästa tid & tekniker, Skapa & Boka Ärende och toasten
// "BE-0001234 bokat, 1 rad flyttade, BE-0001200 stängt".
// Portalen skriver mallnamnet med tankstreck i src/constants/oneflowTemplates.ts; här
// står det utan. Påhittade kunder och kollegor, ingenting sparas.

import { useState, type ReactNode } from 'react'
import { Dator, Falt, Kryssruta, Notis, OvningRam, PKnapp, Val, type OvningSvar } from '../skarmkit'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { DatorModal, gorMk, type Mk, type Tryck } from './_arenden'
import { DetaljHuvud, Grupp, Hopfalld, KoRad, KontaktloggFlik, KontorSida, NastaRuta, type KoRadData } from './_dokument'

type Vy = 'lista' | 'forsteg' | 'form' | 'klart'
interface Lage { vy: Vy; inspektion: boolean; typ: string; forslag: boolean; vald: boolean }

const UR = 'BE-0001200'
const NYTT = 'BE-0001234'

const TYPER: { id: string; namn: string; text: string; ikon: IconName }[] = [
  { id: 'typ-private', namn: 'Engångsjobb privat', text: 'Privatperson, ROT eller RUT', ikon: 'arende.privat' },
  { id: 'typ-business', namn: 'Engångsjobb företag', text: 'Faktureras separat', ikon: 'allman.foretag' },
  { id: 'typ-contract', namn: 'Extrabesök', text: 'Avtalskund, utöver avtalet', ikon: 'bokning.extrabesok' },
  { id: 'typ-inspection', namn: 'Stationskontroll', text: 'Avtalskund, enstaka kontroll', ikon: 'arende.station' },
  { id: 'typ-establishment', namn: 'Etablering', text: 'Utplacering vid avtalsstart', ikon: 'bokning.etablering' },
  { id: 'typ-rondering', namn: 'Rondering', text: 'Regional kund', ikon: 'arende.rondering' },
  { id: 'typ-egenkontroll', namn: 'Egenkontroll', text: 'Regional kund, egenkontrollprogram', ikon: 'rapport.bedomning' },
  { id: 'typ-inget', namn: 'Inget ärende', text: 'Stänger utan nytt ärende, med anledning', ikon: 'allman.stang' },
]

const vadHander = (l: Lage) =>
  `Ursprungsärendet ${UR} stängs. Offertens valda rader flyttas till det nya ärendet.${l.inspektion ? '' : ` En rad stannar och faktureras på ${UR}.`}`

const BRF: KoRadData = { id: 'rad-brf', namn: 'Brf Exempelgården', ton: 'gron', status: 'Signerad igår 14:05', detalj: 'Ingen kontakt sedan signeringen', belopp: '4 900 kr', typ: 'Offert, Erik' }
const BRF_BOKAD: KoRadData = { ...BRF, status: 'Bokad 2026-10-27 kl 09:00, Erik', detalj: `Bokad in 2026-10-23, ärende ${NYTT}` }
const AB: KoRadData = { id: 'rad-ab', namn: 'Exempel AB', ton: 'rod', status: 'Förföll för 2 dagar sedan', detalj: 'Ingen kontakt loggad', belopp: '12 500 kr', typ: 'Avtal, Erik' }

function Sektion({ ikon, titel, children }: { ikon: IconName; titel: string; children: ReactNode }) {
  return (
    <section className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name={ikon} size={16} className="text-[#20c58f]" />{titel}</p>
      {children}
    </section>
  )
}

function Forsteg({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  return (
    <div className="flex min-h-[380px] items-start justify-center bg-slate-950/70 p-3">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 px-3.5 py-2">
          <p className="text-[13px] font-bold text-white">Boka in Brf Exempelgården</p>
          <p className="text-[10.5px] text-slate-400">Offert 1234568, 4 900 kr, signerat 2026-10-22, säljare Erik Exempel</p>
        </div>
        <div className="grid gap-2 p-2.5">
          <Sektion ikon="arende.arende" titel="Ärendetyp">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {TYPER.map(t => {
                const vald = l.typ === t.id
                return (
                  <button key={t.id} type="button" onClick={() => tryck(t.id)}
                    className={`flex items-start gap-1 rounded-lg border px-1.5 py-1 text-left ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/40'}`}>
                    <Icon name={t.ikon} size={16} className={`mt-0.5 h-3 w-3 flex-none ${vald ? 'text-[#20c58f]' : 'text-slate-400'}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[10.5px] font-medium text-white">{t.namn}</span>
                      <span className="block truncate text-[9.5px] text-slate-400">{t.text}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Förvald: Mallen Offertförslag Exkl Moms (Företag): engångsjobb företag.{l.typ !== 'typ-business' ? ' Du har bytt typ.' : ' Byt om det gäller något annat.'}
            </p>
          </Sektion>

          <Sektion ikon="kund.avtal" titel="Underlaget från signeringen">
            <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-0.5 text-[10.5px]">
              <dt className="text-slate-400">Kund</dt><dd className="text-slate-200">Från ursprungsärendet {UR}</dd>
              <dt className="text-slate-400">Adress</dt><dd className="text-slate-200">Exempelvägen 2, Solna</dd>
              <dt className="text-slate-400">Kontakt</dt><dd className="text-slate-200">Karin Exempel, 070-123 45 67, karin@exempel.se</dd>
              <dt className="text-slate-400">Pris</dt><dd className="text-slate-200">4 900 kr</dd>
              <dt className="text-slate-400">Ansvarig tekniker</dt><dd className="text-slate-200">Erik Exempel</dd>
            </dl>
          </Sektion>

          <Sektion ikon="falt.pris" titel="Offertens rader">
            <p className="text-[10px] leading-snug text-slate-400">Raderna följer med till nya ärendet. Bocka ur en tjänst som redan är utförd, då stannar den på ursprungsärendet och faktureras där. Kopplade kostnader och arbetsrader följer sin tjänst.</p>
            <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-700/50 px-2 py-1">
              <span className="grid">
                <Kryssruta pa text="Bekämpning råttor" onClick={() => tryck('rad-bekampning')} />
                <span className="pl-6 text-[10px] text-slate-400">Tjänst, 1 st</span>
              </span>
              <span className="text-[11px] text-slate-200">3 900 kr</span>
            </div>
            <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-700/50 px-2 py-1">
              <span className="grid">
                <Kryssruta pa={l.inspektion} text="Inspektion" onClick={() => tryck('rad-inspektion')} markor={mk('rad-inspektion')} />
                <span className="pl-6 text-[10px] text-slate-400">Tjänst, 1 st{l.inspektion ? '' : ', stannar på ursprungsärendet och faktureras där'}</span>
              </span>
              <span className="text-[11px] text-slate-200">1 000 kr</span>
            </div>
            {!l.inspektion && (
              <div className="text-[10px] text-slate-400">
                <p>Följer med: Bekämpning råttor 3 900 kr</p>
                <p>Stannar och faktureras på {UR}: Inspektion 1 000 kr</p>
              </div>
            )}
          </Sektion>
        </div>
        <div className="grid gap-1 border-t border-slate-700 px-3.5 py-2">
          <div className="flex justify-end gap-1.5">
            <PKnapp onClick={() => tryck('forsteg-avbryt')}>Avbryt</PKnapp>
            <PKnapp prim onClick={() => tryck('fortsatt')} markor={mk('fortsatt')}>{l.typ === 'typ-inget' ? 'Stäng utan nytt ärende' : 'Fortsätt till tid och tekniker'}</PKnapp>
          </div>
          <p className="text-right text-[10px] text-slate-400">{vadHander(l)}</p>
        </div>
      </div>
    </div>
  )
}

const FORSLAG = [
  { id: 'forslag-1', tid: 'tisdag 27 oktober, 09:00 till 10:00', vem: 'Erik Exempel · 14 min restid' },
  { id: 'forslag-2', tid: 'onsdag 28 oktober, 13:00 till 14:00', vem: 'Erik Exempel · 22 min restid' },
]

function Formular({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  return (
    <DatorModal titel="Boka in Brf Exempelgården" fot={
      <div className="flex justify-end gap-1.5">
        <PKnapp onClick={() => tryck('form-avbryt')}>Avbryt</PKnapp>
        <PKnapp prim ikon="station.klar" onClick={() => tryck('skapa')} markor={mk('skapa')}>Skapa & Boka Ärende</PKnapp>
      </div>
    }>
      <div className="grid gap-2 p-3">
        <div className="grid gap-0.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5 text-[10.5px] text-slate-300">
          <p className="flex items-center gap-1.5 font-medium text-white"><Icon name="arendelista.boka" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Boka in från offert 1234568</p>
          <p>{vadHander(l)}</p>
          <p className="text-slate-400">Raderna läggs på ärendet när det sparas. Lägg inte in dem igen under Tjänster och fakturarader.</p>
          <p className="text-slate-400">Erik Exempel är förvald och den enda som är ibockad när tid söks.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="allman.blixt" size={16} className="text-blue-400" />Intelligent Bokning</p>
            <Falt etikett="Adress *" varde="Exempelvägen 2, Solna" onClick={() => tryck('adress')} />
            <Falt etikett="Tjänst *" varde="Råttor" onClick={() => tryck('tjanst')} />
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><Icon name="bokning.team" size={16} className="h-3.5 w-3.5" />Sök bland valda tekniker</p>
            <div className="grid grid-cols-3 gap-1">
              <Kryssruta pa text="Erik Exempel" onClick={() => tryck('tek-erik')} />
              <Kryssruta pa={false} text="Sara Exempel" onClick={() => tryck('tek-sara')} />
              <Kryssruta pa={false} text="Johan Exempel" onClick={() => tryck('tek-johan')} />
            </div>
            <div><PKnapp prim ikon="allman.blixt" onClick={() => tryck('hitta')} markor={mk('hitta')}>Hitta bästa tid & tekniker</PKnapp></div>
            {l.forslag && (
              <div className="grid gap-1.5 border-t border-slate-700 pt-2">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="bokning.forslag" size={16} className="text-purple-400" />Bokningsförslag ({FORSLAG.length} st)</p>
                {FORSLAG.map(f => (
                  <Val key={f.id} titel={f.tid} text={f.vem} vald={l.vald && f.id === 'forslag-1'} onClick={() => tryck(f.id)} markor={mk(f.id)} />
                ))}
              </div>
            )}
          </div>
          <div className="grid content-start gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="allman.kalender" size={16} className="text-green-400" />Bokning & Detaljer</p>
            <Falt etikett="Kontaktperson *" varde="Karin Exempel" onClick={() => tryck('kontakt')} />
            <Falt etikett="Företagsnamn *" varde="Brf Exempelgården" onClick={() => tryck('foretag')} />
            <div className="grid grid-cols-2 gap-1.5">
              <Falt etikett="Starttid *" varde={l.vald ? '2026-10-27 09:00' : 'Välj starttid...'} tom={!l.vald} onClick={() => tryck('starttid')} />
              <Falt etikett="Sluttid *" varde={l.vald ? '2026-10-27 10:00' : 'Välj sluttid...'} tom={!l.vald} onClick={() => tryck('sluttid')} />
            </div>
            <p className="text-[11px] text-slate-400">Tekniker: <span className={l.vald ? 'font-semibold text-[#20c58f]' : 'text-slate-500'}>{l.vald ? 'Erik Exempel (Ansvarig)' : 'Ingen vald'}</span></p>
          </div>
        </div>
      </div>
    </DatorModal>
  )
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  // Dialogerna ritas i flödet i stället för sidan bakom, så att datorramen växer med innehållet
  if (l.vy === 'forsteg' || l.vy === 'form') {
    return (
      <Dator adress="koordinator › dokumentsignering">
        {l.vy === 'forsteg' ? <Forsteg l={l} mk={mk} tryck={tryck} /> : <Formular l={l} mk={mk} tryck={tryck} />}
      </Dator>
    )
  }
  const klar = l.vy === 'klart'
  const lista = (
    <>
      {!klar && (
        <Grupp ikon="arendelista.boka" farg="text-[#20c58f]" rubrik="Att boka in" antal={1} text="Signerade och inte inbokade, äldst först. Samma lista som Att boka in i schemat.">
          <KoRad r={BRF} vald mk={mk} tryck={tryck} />
        </Grupp>
      )}
      <Grupp ikon="allman.hand" farg="text-amber-500" rubrik="Fastnat hos tekniker" antal={1}>
        <KoRad r={AB} mk={mk} tryck={tryck} />
      </Grupp>
      {klar && (
        <Grupp ikon="allman.kalender" farg="text-[#20c58f]" rubrik="Bokade" antal={1} text="Inbokade och schemalagda via Boka in. Syns i 14 dagar.">
          <KoRad r={BRF_BOKAD} vald mk={mk} tryck={tryck} />
        </Grupp>
      )}
      <Hopfalld ikon="falt.vantar" rubrik="Väntar på kunden" antal={3} onClick={() => tryck('vantar')} />
    </>
  )
  const detalj = (
    <>
      <DetaljHuvud namn="Brf Exempelgården" rad1={`Offert, 4 900 kr, ${UR}, säljare Erik Exempel`} rad2="Skickad 2026-10-15 av Erik Exempel" kontakt="Karin Exempel" tryck={tryck} />
      {klar ? (
        <NastaRuta ton="gron" status="Bokad 2026-10-27 kl 09:00" text={`inget. Dokumentet är inbokat som ärende ${NYTT}.`}>
          <div><PKnapp prim ikon="arende.arende" onClick={() => tryck('oppna-arende')}>Öppna ärende {NYTT}</PKnapp></div>
        </NastaRuta>
      ) : (
        <NastaRuta ton="gron" status="Signerad igår 14:05" text="boka in och schemalägg. Ursprungsärendet stängs och offertens rader följer med till det nya ärendet.">
          <div className="flex flex-wrap gap-1.5">
            <PKnapp prim ikon="arendelista.boka" onClick={() => tryck('boka-in')} markor={mk('boka-in')}>Boka in</PKnapp>
            <PKnapp ikon="kontakt.telefon" onClick={() => tryck('ring')}>Ring Karin Exempel</PKnapp>
            <PKnapp ikon="allman.anteckning" onClick={() => tryck('logga')}>Logga kontakt</PKnapp>
          </div>
        </NastaRuta>
      )}
      <KontaktloggFlik tryck={tryck} poster={[
        { ikon: 'rapport.skicka', vem: 'Erik Exempel', etikett: 'skickade i Oneflow', nar: '2026-10-15 10:02' },
        { ikon: 'falt.signera', vem: 'Oneflow', etikett: 'signeringshändelse', nar: '2026-10-22 14:05' },
        ...(klar ? [{ ikon: 'arendelista.boka' as IconName, vem: 'Kontoret', etikett: 'Boka in', nar: '2026-10-23 10:30', text: `Bokad in som ${NYTT}, 2026-10-27 09:00, Erik Exempel, av Sara Exempel` }] : []),
      ]} />
    </>
  )
  return (
    <KontorSida
      raknare={klar ? '0 att boka in, 0 väntar på kontoret, 1 fastnat hos tekniker, 1 bokade' : '1 att boka in, 0 väntar på kontoret, 1 fastnat hos tekniker, 0 bokade'}
      lista={lista}
      detalj={detalj}
      notis={klar ? <Notis text={`${NYTT} bokat, 1 rad flyttade, ${UR} stängt`} /> : undefined}
    />
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'lista', inspektion: true, typ: 'typ-business', forslag: false, vald: false }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'boka-in' },
  { lage: { ...BAS, vy: 'forsteg' }, markera: 'rad-inspektion' },
  { lage: { ...BAS, vy: 'forsteg', inspektion: false }, markera: 'fortsatt' },
  { lage: { ...BAS, vy: 'form', inspektion: false }, markera: 'hitta' },
  { lage: { ...BAS, vy: 'form', inspektion: false, forslag: true }, markera: 'forslag-1' },
  { lage: { ...BAS, vy: 'form', inspektion: false, forslag: true, vald: true }, markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Brf Exempelgården har signerat offerten och är öppen till höger. Boka in den.' }

const TIPS: Record<string, string> = {
  'rad-ab': 'Exempel AB har inte signerat. Brf Exempelgården ligger under Att boka in.',
  oneflow: 'Du behöver inte öppna Oneflow. Boka in hämtar underlaget från signeringen.',
  ring: 'Du behöver inte ringa. Tryck Boka in.',
  logga: 'Ingen kontakt att logga. Tryck Boka in.',
  vantar: 'Väntar på kunden är skickade dokument som inte signerats. Brf Exempelgården är signerad.',
  innehall: 'Raderna ser du i Boka in. Tryck Boka in.',
  'rad-bekampning': 'Bekämpningen är inte gjord än. Den ska följa med till det nya ärendet.',
  'tek-sara': 'Erik är ansvarig tekniker på offerten och ska ta jobbet. Låt honom vara den enda som är ibockad.',
  'tek-johan': 'Erik är ansvarig tekniker på offerten och ska ta jobbet. Låt honom vara den enda som är ibockad.',
  'tek-erik': 'Erik ska vara ibockad. Han är ansvarig tekniker på offerten.',
  adress: 'Adressen är redan ifylld från offerten.',
  tjanst: 'Tjänsten är redan ifylld.',
  kontakt: 'Kontakten är redan ifylld från offerten.',
  foretag: 'Företagsnamnet är redan ifyllt.',
  starttid: 'Tiden fylls i när du väljer ett bokningsförslag.',
  sluttid: 'Tiden fylls i när du väljer ett bokningsförslag.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'forsteg') {
      if (id === 'rad-inspektion') {
        const inspektion = !l.inspektion
        setL({ ...l, inspektion })
        if (inspektion) miss('Inspektionen är redan gjord. Bocka ur den, så faktureras den på ursprungsärendet.')
        else tips('Inspektionen stannar', `Den faktureras på ${UR}. Bekämpningen följer med. Tryck Fortsätt till tid och tekniker.`)
        return
      }
      if (id.startsWith('typ-')) {
        setL({ ...l, typ: id })
        if (id !== 'typ-business') miss('Brf Exempelgården har inget avtal och offerten är för företag. Engångsjobb företag var rätt. Välj den igen.')
        else tips('Engångsjobb företag', 'Rätt typ. Läs Offertens rader.')
        return
      }
      if (id === 'forsteg-avbryt') { setL({ ...l, vy: 'lista' }); miss('Avbryt bokar ingenting. Tryck Boka in igen.'); return }
      if (id === 'fortsatt') {
        if (l.typ !== 'typ-business') { miss('Välj Engångsjobb företag först.'); return }
        if (l.inspektion) { miss('Inspektionen är redan gjord. Bocka ur den under Offertens rader först.'); return }
        setL({ ...l, vy: 'form' }); tips('Formuläret är förifyllt', 'Bara Erik är ibockad. Tryck Hitta bästa tid & tekniker.')
        return
      }
      miss(TIPS[id] ?? 'Bocka ur Inspektion och tryck Fortsätt till tid och tekniker.')
      return
    }
    if (l.vy === 'form') {
      if (id === 'hitta') { setL({ ...l, forslag: true }); tips('Förslagen för Erik', 'Välj den första lediga tiden.'); return }
      if (id === 'forslag-1') { setL({ ...l, vald: true }); tips('Tiden är vald', 'Tryck Skapa & Boka Ärende.'); return }
      if (id === 'forslag-2') { miss('Uppdraget säger första lediga tid. Välj tisdag 27 oktober.'); return }
      if (id === 'form-avbryt') { setL({ ...l, vy: 'forsteg' }); miss('Avbryt tar dig tillbaka utan att boka. Tryck Fortsätt till tid och tekniker igen.'); return }
      if (id === 'skapa') {
        if (!l.vald) { miss('Välj en tid först. Tryck Hitta bästa tid & tekniker och välj ett förslag.'); return }
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `${NYTT} är bokat hos Erik. Bekämpningen flyttade till det nya ärendet, inspektionen faktureras på ${UR} och ${UR} är stängt. Brf Exempelgården ligger under Bokade.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
        return
      }
      miss(TIPS[id] ?? 'Tryck Hitta bästa tid & tekniker och välj ett förslag.')
      return
    }
    if (id === 'boka-in') { setL({ ...l, vy: 'forsteg' }); tips('Boka in är öppen', 'Ärendetypen är förvald. Inspektionen är redan gjord: bocka ur den.'); return }
    if (id === 'rad-brf') { tips('Redan öppen', 'Brf Exempelgården är öppen till höger. Tryck Boka in.'); return }
    miss(TIPS[id] ?? 'Tryck Boka in i Nästa steg-rutan.')
  }

  const framsteg = l.vy === 'lista' ? 0 : l.vy === 'forsteg' ? (l.inspektion ? 1 : 2) : l.vy === 'klart' ? 6 : l.vald ? 5 : l.forslag ? 4 : 3
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
