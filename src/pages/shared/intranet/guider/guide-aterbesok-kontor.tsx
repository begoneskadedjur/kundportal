// src/pages/shared/intranet/guider/guide-aterbesok-kontor.tsx
// Guidemodul: Boka ett återbesök (koordinator och admin, dator).
// Vägen: Planering › Ärenden (CasesPage, rubriken Ärenden, sökrutan "Sök på namn,
// adress, tjänst...") › raden öppnar EditCaseModal › fotspåren (title "Boka återbesök
// eller skapa nytt ärende") › Vad vill du göra? › RevisitModal i två steg.
// Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { ArendeHuvud, Dator, DatorSida, Flikar, IkonKnapp, Markor, Notis, OvningRam, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { RevisitSteg1, RevisitSteg2, TjansterKort, ValArk, mk, type FRad, type Tid } from './_fakturering'

type Vy = 'lista' | 'arende' | 'val' | 'steg1' | 'steg2' | 'klart'

interface Lage {
  vy: Vy
  datum: boolean
  tid: string | null
  delfaktura: boolean
}

// Delfakturan visar radernas belopp exkl. moms. Ekonomi-fliken visar privatärenden inkl. moms.
const RADER: FRad[] = [['Vägglusbekämpning, första behandlingen', '3 200 kr'], ['Värmebehandling, tillägg', '1 400 kr']]
const RADER_INKL: FRad[] = [['Vägglusbekämpning, första behandlingen', '4 000 kr'], ['Värmebehandling, tillägg', '1 750 kr']]
const TIDER: Tid[] = [
  { id: 't1', tid: '09:00 till 10:00', tekniker: 'Anna Exempel' },
  { id: 't2', tid: '10:30 till 11:30', tekniker: 'Anna Exempel' },
  { id: 't3', tid: '14:00 till 15:00', tekniker: 'Anna Exempel' },
]

const LISTA = [
  { id: 'rad', namn: 'Familjen Exempel', nr: '#BE-0002468', tjanst: 'Vägglöss', datum: '2026-10-14', status: 'Bokad' },
  { id: 'rad2', namn: 'Exempel AB', nr: '#BE-0002470', tjanst: 'Råttor', datum: '2026-10-15', status: 'Bokad' },
  { id: 'rad3', namn: 'Brf Exempelgården', nr: '#BE-0002475', tjanst: 'Getingar', datum: '2026-10-16', status: 'Bokad' },
]

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const klar = l.vy === 'klart'
  return (
    <Dator adress="koordinator › arenden">
      <div className="min-h-[460px]">
      <DatorSida meny={['Översikt', 'Ärenden', 'Rondering & Schema', 'Fakturering']} aktiv="Ärenden" titel="Ärenden">
        <div className="mb-2 flex items-center gap-2">
          <button type="button" onClick={() => tryck('sok')} className="w-56 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-left text-[12px] text-slate-500">
            Sök på namn, adress, tjänst...
          </button>
          <span className="ml-auto text-[11px] text-slate-400">Inkludera avslutade</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <p className="border-b border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
            <Status text="Bokad · 3" />
          </p>
          {LISTA.map(r => (
            <Markor key={r.id} block markor={mk(markera, r.id, nr)}>
              <button type="button" onClick={() => tryck(r.id)} className="grid w-full grid-cols-[1fr_90px_90px] items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-left hover:bg-slate-800/40">
                <span>
                  <span className="block text-[12.5px] font-medium text-slate-200">{r.namn}</span>
                  <span className="block text-[10px] text-slate-500">{r.nr}</span>
                </span>
                <span className="text-[12px] text-slate-400">{r.tjanst}</span>
                <span className="text-[12px] text-slate-400">{r.datum}</span>
              </button>
            </Markor>
          ))}
        </div>
      </DatorSida>
      </div>

      {l.vy !== 'lista' && (
        <div className="absolute inset-2 z-10 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <ArendeHuvud
            nr="BE-0002468"
            status={klar ? <Status text="Återbesök" farg="bg-[#20c58f]" /> : <Status text="Bokad" />}
            kund="Familjen Exempel · Exempelvägen 4, Södertälje"
            ikoner={<>
              <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} markor={mk(markera, 'fotspar', nr)} />
              <IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />
              <IkonKnapp ikon="allman.stang" etikett="Stäng" onClick={() => tryck('stang')} />
            </>}
          />
          <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={2} onClick={() => tryck('flik')} />
          <div className="grid sm:grid-cols-2">
            <TjansterKort rader={klar && l.delfaktura ? [] : RADER_INKL} summa="5 750 kr" privat />
            <div className="m-2.5 grid content-start gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5 text-xs text-slate-400">
              <p className="font-semibold text-white">Schemaläggning</p>
              <p>{klar ? 'Onsdag 2026-10-21, 09:00 till 10:00' : 'Onsdag 2026-10-14, 09:00 till 10:00'}</p>
            </div>
          </div>
        </div>
      )}

      {l.vy === 'val' && <ValArk tryck={tryck} markera={markera} nr={nr} />}
      {l.vy === 'steg1' && <RevisitSteg1 datum={l.datum} datumText="onsdag 21 okt 2026" tryck={tryck} markera={markera} nr={nr} />}
      {l.vy === 'steg2' && (
        <RevisitSteg2 under="Förslag · onsdag 21 oktober" tider={TIDER} tid={l.tid} delfaktura={l.delfaktura} rader={RADER} total="4 600 kr" tryck={tryck} markera={markera} nr={nr} />
      )}
      {klar && <Notis text={l.delfaktura ? 'Återbesök bokat och delfaktura INV-202610-0043 skapad!' : 'Återbesök bokat!'} />}
    </Dator>
  )
}

// ─── Visning ───

const V = (vy: Vy, datum = false, tid: string | null = null, delfaktura = false): Lage => ({ vy, datum, tid, delfaktura })

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: V('lista'), markera: 'rad' },
  { lage: V('arende'), markera: 'fotspar' },
  { lage: V('val'), markera: 'val-aterbesok' },
  { lage: V('steg1', true), markera: 'visa' },
  { lage: V('steg2', true), markera: 'tid-t1' },
  { lage: V('steg2', true, 't1'), markera: 'delfaktura' },
  { lage: V('steg2', true, 't1', true), markera: 'boka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = V('lista')
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Familjen Exempel ringer. Öppna deras ärende i listan.' }

const TIPS: Record<string, string> = {
  rad2: 'Det är Exempel AB. Uppdraget gäller Familjen Exempel.',
  rad3: 'Det är Brf Exempelgården. Uppdraget gäller Familjen Exempel.',
  sok: 'Sökrutan går bra när listan är lång. Här syns Familjen Exempel redan, tryck på raden.',
  historik: 'Klockan är ärendehistoriken. Återbesöket bokar du med fotspåren.',
  stang: 'Krysset stänger ärendet. Leta efter fotspåren bredvid klockan.',
  flik: 'Fotspåren finns uppe till höger i alla flikar.',
  'val-nytt': 'Skapa nytt ärende är för ett nytt skadedjur. Det här är samma vägglöss.',
  'val-duplicera': 'Duplicera gör ett nytt ärende. Uppdraget är nästa besök i samma ärende.',
  'val-avbryt': 'Avbryt stänger rutan. Välj Boka återbesök.',
  avbryt: 'Avbryt stänger rutan och du får börja om. Fortsätt i stället.',
  langd: 'En timme passar. Välj datum.',
  manuellt: 'Det går också, men det finns redan en förmiddagstid.',
  'byt-datum': 'Datumet är rätt. Välj en tid.',
  'tid-t3': 'Det är eftermiddag. Kunden vill ha förmiddag.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'lista') {
      if (id === 'rad') { setL({ ...l, vy: 'arende' }); tips('Ärendet är öppet', 'Första behandlingen är gjord. Boka nästa besök.') }
      else miss(TIPS[id] ?? 'Tryck på raden för Familjen Exempel.')
    } else if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Samma problem, nästa besök. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-aterbesok') { setL({ ...l, vy: 'steg1' }); tips('Rätt val', 'Välj onsdag 2026-10-21.') }
      else miss(TIPS[id] ?? 'Välj Boka återbesök.')
    } else if (l.vy === 'steg1') {
      if (id === 'datum') { setL({ ...l, datum: true }); tips('Datum valt', 'Tryck Visa förslag →.') }
      else if (id === 'visa') {
        if (!l.datum) miss('Knappen fungerar först när du har valt datum.')
        else { setL({ ...l, vy: 'steg2' }); tips('Här är förslagen', 'Kunden vill ha förmiddag. Välj en tid.') }
      } else miss(TIPS[id] ?? 'Välj datum först.')
    } else {
      if (id === 'tid-t1' || id === 'tid-t2') {
        setL({ ...l, tid: id.slice(4) })
        tips('Bra tid', l.delfaktura ? 'Tryck Boka återbesök.' : 'Kunden ska betala första behandlingen nu. Vad kryssar du i?')
      } else if (id === 'delfaktura') {
        const pa = !l.delfaktura
        setL({ ...l, delfaktura: pa })
        tips(pa ? 'Delfakturan är med' : 'Delfakturan är bortkryssad', pa ? (l.tid ? 'Du ser raderna och 4 600 kr exkl. moms. Tryck Boka återbesök.' : 'Välj också en tid.') : 'Uppdraget var att fakturera första behandlingen nu.')
      } else if (id === 'boka') {
        if (!l.tid) miss('Välj en tid först. Knappen fungerar först då.')
        else if (!l.delfaktura) miss('Kunden ska betala första behandlingen nu. Kryssa i Skapa delfaktura först.')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Återbesöket är bokat onsdag 2026-10-21 och ärendet har status Återbesök. Delfakturan på 4 600 kr exkl. moms ligger under Fakturering › Privat & Företag. Raderna är borta från ärendet, så nästa besök börjar från noll.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj en förmiddagstid, kryssa i delfakturan och boka.')
    }
  }

  const framsteg = l.vy === 'lista' ? 0 : l.vy === 'arende' ? 1 : l.vy === 'val' ? 2 : l.vy === 'steg1' ? (l.datum ? 4 : 3) : l.vy === 'klart' ? 7 : l.tid && l.delfaktura ? 6 : 5
  return (
    <OvningRam bred framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
