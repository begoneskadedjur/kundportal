// src/pages/shared/intranet/guider/guide-leads-tekniker.tsx
// Guidemodul: Tipsa om en lead (tekniker, telefon).
// Knappen Skapa lead (SkapaLeadKnapp) sitter under statusraden i privata engångsärenden och
// företagsärenden. Rutan SkapaLeadModal (helskärm i mobilen): Vad gäller det? * med valen ur
// GALLER_PRIVAT, fältet Förening * när Bostadsrättsföreningen är valt, Vad såg du? *, Avbryt och
// Skicka lead. Felet "Välj vad det gäller." visas under valen. Efteråt: notisen "Leaden är skapad"
// och ärendet visar "Lead skapad · <namn>". Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { GALLER_PRIVAT, type LeadGaller } from '../../../../types/leads'
import { ArendeHuvud, Flikar, IkonKnapp, Kort, Markor, Notis, OvningRam, Rad, Status, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { LeadFalt, mkFor, type Mk } from './_leads'

const FORENING = 'Brf Exempelgården'
const SAG = 'Möss i soprummet, kunden sitter i styrelsen.'

type Vy = 'arende' | 'ruta' | 'klart'

interface Lage {
  vy: Vy
  galler: LeadGaller | null
  namn: boolean
  text: boolean
  forsokt: boolean
}

function Skarm({ l, tryck, mk }: { l: Lage; tryck: (id: string) => void; mk: Mk }) {
  const klar = l.vy === 'klart'
  const kraverNamn = l.galler === 'forening' || l.galler === 'foretag'
  return (
    <Telefon>
      <ArendeHuvud
        nr="BE-0001234"
        status={<Status text="Bokad" farg="bg-sky-400" />}
        kund="Familjen Exempel · Exempelvägen 4, Södertälje"
        ikoner={<>
          <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} />
          <IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />
        </>}
      />
      <div className="px-3.5 pt-2">
        {klar ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-200">
            <Icon name="lead.lead" size={16} className="text-[#20c58f]" />
            Lead skapad · {FORENING} <span aria-hidden>→</span>
          </span>
        ) : (
          <Markor markor={mk('skapa')}>
            <button type="button" onClick={() => tryck('skapa')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 text-xs font-medium text-slate-300">
              <Icon name="lead.tips" size={16} className="text-[#20c58f]" />
              Skapa lead
            </button>
          </Markor>
        )}
      </div>
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Möss i köket, spår under diskbänken." /></Kort>
      <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Fredag 2026-10-16, 10:00 till 11:00" /></Kort>

      {l.vy === 'ruta' && (
        <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
          <div className="flex items-start justify-between gap-2 border-b border-slate-700 px-3.5 py-2.5">
            <div>
              <p className="text-sm font-bold text-white">Skapa lead</p>
              <p className="text-[11.5px] text-slate-400">Familjen Exempel</p>
            </div>
            <button type="button" onClick={() => tryck('avbryt')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
          </div>
          <div className="grid flex-1 content-start gap-2 overflow-hidden px-3 py-2.5">
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-white">
                <Icon name="arende.privat" size={16} className="text-[#20c58f]" /> Familjen Exempel
              </p>
              <p className="text-[11px] text-slate-400">Exempelvägen 4, Södertälje · privat engångsärende BE-0001234</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" /> Ingen öppen lead med samma telefon eller e-post
              </p>
            </div>
            <div className={`rounded-xl border bg-slate-800/30 p-2.5 ${l.forsokt && !l.galler ? 'border-red-500/50' : 'border-slate-700'}`}>
              <p className="mb-0.5 text-[11px] font-medium text-slate-400">Vad gäller det? *</p>
              <div className="divide-y divide-slate-700/50">
                {GALLER_PRIVAT.map(v => (
                  <Markor key={v.varde} markor={mk(`galler:${v.varde}`)} block>
                    <button type="button" onClick={() => tryck(`galler:${v.varde}`)} className="flex w-full items-start gap-2.5 py-1.5 text-left">
                      <span className={`mt-0.5 flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border ${l.galler === v.varde ? 'border-[#20c58f]' : 'border-slate-500'}`}>
                        {l.galler === v.varde && <span className="h-2 w-2 rounded-full bg-[#20c58f]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] text-white">{v.etikett}</span>
                        <span className="block text-[11px] leading-snug text-slate-400">{v.hjalp}</span>
                      </span>
                    </button>
                  </Markor>
                ))}
              </div>
              {l.forsokt && !l.galler && <p className="mt-1 text-[11px] text-red-400">Välj vad det gäller.</p>}
            </div>
            <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
              {kraverNamn && (
                <LeadFalt id="namn" etikett={l.galler === 'forening' ? 'Förening *' : 'Företag *'} varde={l.namn ? FORENING : ' '} tom={!l.namn} tryck={tryck} mk={mk} />
              )}
              <LeadFalt id="text" etikett="Vad såg du? *" varde={l.text ? SAG : 'Till exempel fler lägenheter i huset har möss'} tom={!l.text} tryck={tryck} mk={mk} hog />
            </div>
            <p className="flex items-center gap-1.5 px-1 text-[10.5px] text-slate-400">
              <Icon name="lead.tipsare" size={16} className="h-3.5 w-3.5 text-slate-500" /> Du står som tipsare.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-700 px-3 py-2">
            <button type="button" onClick={() => tryck('avbryt')} className="px-2.5 py-1 text-[12px] text-slate-300">Avbryt</button>
            <Markor markor={mk('skicka')}>
              <button type="button" onClick={() => tryck('skicka')} className="rounded-lg bg-[#20c58f] px-3 py-1.5 text-[12px] font-semibold text-[#fff]">Skicka lead</button>
            </Markor>
          </div>
        </div>
      )}

      {klar && <Notis text={`Leaden är skapad · Öppna ${FORENING}`} />}
    </Telefon>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'arende', galler: null, namn: false, text: false, forsokt: false }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'skapa' },
  { lage: { ...BAS, vy: 'ruta' }, markera: 'galler:forening' },
  { lage: { ...BAS, vy: 'ruta', galler: 'forening' }, markera: 'namn' },
  { lage: { ...BAS, vy: 'ruta', galler: 'forening', namn: true }, markera: 'text' },
  { lage: { ...BAS, vy: 'ruta', galler: 'forening', namn: true, text: true }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet hos Familjen Exempel. Leta upp knappen för att tipsa.' }
const ingen: Mk = () => undefined

const TIPS: Record<string, string> = {
  fotspar: 'Fotspåren är för återbesök och nya ärenden. Tipset skapar du med Skapa lead under statusraden.',
  historik: 'Klockan är ärendehistoriken. Leta efter Skapa lead under statusraden.',
  flik: 'Flikarna byter vy i ärendet. Skapa lead sitter ovanför dem.',
  'galler:hemmet': 'Löpande avtal för hemmet gäller familjens egen bostad. Tipset gäller föreningen.',
  'galler:foretag': 'Kundens företag är för ett företag som kunden driver eller arbetar på. Här gäller det föreningen.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'arende') {
      if (id === 'skapa') { setL({ ...l, vy: 'ruta' }); tips('Rutan Skapa lead', 'Kunden, adressen och ärendet följer med av sig självt. Vad gäller tipset?') }
      else miss(TIPS[id] ?? 'Leta efter Skapa lead under statusraden.')
      return
    }
    if (id === 'avbryt') { setL(BAS); miss('Avbryt stänger rutan och inget sparas. Tryck Skapa lead igen.'); return }
    if (id.startsWith('galler:')) {
      const g = id.slice(7) as LeadGaller
      setL({ ...l, galler: g, namn: g === 'forening' ? l.namn : false })
      if (g === 'forening') tips('Rätt val', 'Nu kom fältet Förening. Skriv föreningens namn.')
      else miss(TIPS[id] ?? 'Välj det som passar föreningen.')
    } else if (id === 'namn') { setL({ ...l, namn: true }); tips('Namnet är ifyllt', `${FORENING} blir leadens namn. Skriv nu vad du såg.`) }
    else if (id === 'text') { setL({ ...l, text: true }); tips('Bra rad', 'Säljaren ser exakt vad du skrev. Skicka tipset.') }
    else if (id === 'skicka') {
      if (l.galler !== 'forening') { setL({ ...l, forsokt: true }); miss(l.galler ? 'Tipset gäller föreningen. Välj Bostadsrättsföreningen.' : 'Det står Välj vad det gäller. Välj ett av alternativen först.') }
      else if (!l.namn) { setL({ ...l, forsokt: true }); miss('Fältet Förening blev rött. Skriv föreningens namn först.') }
      else if (!l.text) { setL({ ...l, forsokt: true }); miss('Fältet Vad såg du? blev rött. Skriv en rad om vad du såg.') }
      else {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Leaden ${FORENING} är skapad och du står som tipsare. Koordinatorn ger den till en säljare, och du följer den under Mina leads och tips. Ärendet visar nu Lead skapad · ${FORENING}.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'klart' ? 5 : 1 + Number(l.galler === 'forening') + Number(l.namn) + Number(l.text)
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} mk={ingen} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
