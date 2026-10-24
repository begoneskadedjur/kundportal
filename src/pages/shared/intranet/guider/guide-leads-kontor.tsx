// src/pages/shared/intranet/guider/guide-leads-kontor.tsx
// Guidemodul: Leads för koordinator och admin. Uppgiften: fördela ett nytt tips (dator).
// Fliken Nya tips i Leads.tsx visar leads utan ägare och tips som fortfarande är Ny (arNyttTips),
// äldst överst. Ett tips från en tekniker får ingen ägare och nästa steg "Kontakta kunden om
// tipset" om två dygn (lead_fran_arende). Teknikerns text ligger i Beskrivning och behov under
// Mer uppgifter. Överlåt eller dela (LeadDelning): "Ägare nu: ingen", Ny ägare med "Välj kollega",
// knappen Överlåt (grå tills någon är vald) och notisen "Leaden är överlåten till <namn>".
// Fler åtgärder (⋯) har Ta leaden och nödutgångarna. Påhittade kunder och kollegor, inget sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Dator, DatorSida, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { Atgard, LeadFalt, LeadFonster, LeadHuvud, LeadsLista, Sektion, mkFor, type ListRad, type Mk } from './_leads'

const MENY = ['Översikt', 'Ärenden', 'Schema & Planering', 'Befintliga kunder', 'Leads (B2B)', 'Leads (Webb)', 'Fakturering']
const KOLLEGOR = ['Bo Exempel', 'Sara Exempel']
const BESKRIVNING = 'Från privat engångsärende BE-0001234. Gäller: Bostadsrättsföreningen. Skadedjur i ärendet: Möss. Möss i soprummet, kunden sitter i styrelsen.'

const TIPS_A: ListRad = { id: 'a', foretag: 'Brf Exempelgården', under: 'Tips från Anna · privat engångsärende', stage: 'ny', nasta: 'Kontakta kunden om tipset', nar: 'I dag 10:12' }
const TIPS_B: ListRad = { id: 'b', foretag: 'Exempel AB', under: 'Tips från Bo · företagsärende', stage: 'ny', nasta: 'Kontakta kunden om tipset', nar: 'I morgon 15:40' }
const EGEN: ListRad = { id: 'c', foretag: 'Exempel Bygg AB', under: 'Telefon', stage: 'kontaktad', nasta: 'Ring och följ upp offerten', nar: 'I dag 13:00', agare: 'Lena' }

type Vy = 'lista' | 'tips' | 'lead' | 'klart'

interface Lage {
  vy: Vy
  mer: boolean
  dela: boolean
  lista: boolean
  agare: string | null
}

function Skarm({ l, tryck, mk }: { l: Lage; tryck: (id: string) => void; mk: Mk }) {
  const klart = l.vy === 'klart'
  const nyaTips = l.vy !== 'lista'
  const tipsA = klart ? { ...TIPS_A, agare: 'Sara' } : TIPS_A
  return (
    <Dator adress={`koordinator › leads${nyaTips ? '?flik=nya-tips' : ''}`}>
      <div className="min-h-[560px]">
      <DatorSida meny={MENY} aktiv="Leads (B2B)" titel="Leads (B2B)">
        <LeadsLista
          flik={nyaTips ? 'nya-tips' : 'att-gora'}
          antal={{ 'att-gora': 1, 'nya-tips': 2 }}
          sektioner={nyaTips ? [{ grupp: null, rader: [tipsA, TIPS_B] }] : [{ grupp: 'idag', rader: [EGEN] }]}
          tryck={tryck}
          mk={mk}
        />
      </DatorSida>
      </div>

      {(l.vy === 'lead' || klart) && (
        <LeadFonster titel="Brf Exempelgården" under="Tips från Anna · privat engångsärende" onStang={() => tryck('stang')}>
          <LeadHuvud stage="ny" agare={l.agare ?? undefined} tipsare="Anna Exempel" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Atgard id="logga" ikon="kontakt.telefon" text="Logga samtal" tryck={tryck} mk={mk} />
            <Atgard id="besok" ikon="allman.kalender" text="Boka besök" tryck={tryck} mk={mk} />
            <Atgard id="offert" ikon="dok.offert" text="Skapa offert" tryck={tryck} mk={mk} />
            <Atgard id="dela" ikon="lead.dela" text="Överlåt eller dela" tryck={tryck} mk={mk} />
            <Atgard id="parkera" ikon="lead.parkerad" text="Parkera" tryck={tryck} mk={mk} />
            <Atgard id="forlorad" ikon="lead.forlorad" text="Förlorad" tryck={tryck} mk={mk} />
            <button type="button" onClick={() => tryck('fler')} aria-label="Fler åtgärder" title="Fler åtgärder" className="rounded-lg px-1.5 py-0.5 text-slate-400 hover:bg-slate-800">⋯</button>
          </div>

          {l.dela && (
            <Sektion titel="Överlåt eller dela" ikon="lead.dela" ram="border-[#20c58f]/50">
              <p className="text-[11px] text-slate-400">Ägare nu: <span className="text-white">{l.agare ?? 'ingen'}</span></p>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <LeadFalt id="ny-agare" etikett="Ny ägare" varde={l.agare && !klart ? l.agare : 'Välj kollega'} tom={!l.agare || klart} tryck={tryck} mk={mk} />
                <Markor markor={mk('overlat')}>
                  <button type="button" onClick={() => tryck('overlat')} aria-disabled={!l.agare}
                    className={`inline-flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#fff] ${!l.agare || klart ? 'opacity-50' : ''}`}>
                    <Icon name="lead.agare" size={16} className="h-3.5 w-3.5" /> Överlåt
                  </button>
                </Markor>
              </div>
              {l.lista && (
                <div className="grid gap-0.5 rounded-lg border border-slate-700 bg-slate-900 p-1">
                  {KOLLEGOR.map(k => (
                    <Markor key={k} markor={mk(`kollega:${k}`)} block>
                      <button type="button" onClick={() => tryck(`kollega:${k}`)} className="block w-full rounded px-2 py-1 text-left text-[12px] text-slate-200 hover:bg-slate-800">{k}</button>
                    </Markor>
                  ))}
                </div>
              )}
            </Sektion>
          )}

          <Sektion>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Icon name="lead.nasta-steg" size={16} className="h-3.5 w-3.5 text-[#20c58f]" /> Nästa steg
                </p>
                <p className="text-white">Kontakta kunden om tipset <span className="ml-2 font-mono text-[10.5px] text-slate-400">I dag 10:12</span></p>
              </div>
              <div className="flex gap-1.5">
                <Atgard id="klar" ikon="allman.bock" text="Klar, välj nästa" prim tryck={tryck} mk={mk} />
                <Atgard id="andra" text="Ändra" tryck={tryck} mk={mk} />
              </div>
            </div>
          </Sektion>

          <Sektion>
            <Markor markor={mk('mer')} block>
              <button type="button" onClick={() => tryck('mer')} className="flex w-full items-center gap-1.5 text-left text-[12px] font-semibold text-white">
                <Icon name="allman.chevron" size={16} className={`h-3.5 w-3.5 text-slate-400 ${l.mer ? 'rotate-90' : ''}`} />
                Mer uppgifter
                <span className="truncate text-[10.5px] font-normal text-slate-400">org.nr, hemsida, storlek, beskrivning, fler kontakter</span>
              </button>
            </Markor>
            {l.mer && (
              <div className="grid gap-0.5 pt-1">
                <span className="text-[11px] text-slate-400">Beskrivning och behov</span>
                <span className="text-[11.5px] leading-snug text-slate-200">{BESKRIVNING}</span>
              </div>
            )}
          </Sektion>
        </LeadFonster>
      )}
      {klart && <Notis text="Leaden är överlåten till Sara Exempel" />}
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'lista', mer: false, dela: false, lista: false, agare: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'flik:nya-tips' },
  { lage: { ...BAS, vy: 'tips' }, markera: 'rad:a' },
  { lage: { ...BAS, vy: 'lead' }, markera: 'mer' },
  { lage: { ...BAS, vy: 'lead', mer: true }, markera: 'dela' },
  { lage: { ...BAS, vy: 'lead', mer: true, dela: true, lista: true }, markera: 'kollega:Sara Exempel' },
  { lage: { ...BAS, vy: 'lead', mer: true, dela: true, agare: 'Sara Exempel' }, markera: 'overlat' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i Leads (B2B) på fliken Att göra. Leta upp tipsen som väntar på en ägare.' }
const ingen: Mk = () => undefined

const TIPS: Record<string, string> = {
  'flik:att-gora': 'Att göra visar dina egna steg för i dag. Tipsen som väntar ligger under Nya tips.',
  'flik:pagaende': 'Pågående visar alla öppna leads. Tipsen som väntar på ägare ligger under Nya tips.',
  'flik:alla': 'Alla visar även vunna och förlorade. Tipsen som väntar ligger under Nya tips.',
  'flik:statistik': 'Statistiken visar hur det går. Tipsen som väntar ligger under Nya tips.',
  'rad:c': 'Exempel Bygg AB har redan en ägare. Gå till Nya tips.',
  'rad:b': 'Exempel AB är Bos tips. Uppdraget gäller Annas tips om Brf Exempelgården.',
  ny: 'Ny lead skapar en ny lead. Tipset finns redan.',
  stang: 'Du stängde leaden. Öppna Brf Exempelgården igen.',
  logga: 'Det är säljaren som ska ringa kunden. Ge tipset till Sara.',
  besok: 'Säljaren tar kontakt först. Ge tipset till Sara.',
  offert: 'Det är för tidigt för en offert. Ge tipset till Sara.',
  parkera: 'Tipset ska till en säljare, inte vila. Tryck Överlåt eller dela.',
  forlorad: 'Tipset är färskt. Tryck Överlåt eller dela.',
  fler: 'Under ⋯ finns Ta leaden, men då blir du ägare. Uppdraget var att ge tipset till Sara.',
  klar: 'Klar, välj nästa är för den som har kontaktat kunden. Ge tipset till Sara.',
  andra: 'Ändra flyttar nästa steg. Ge tipset till Sara först.',
  'kollega:Bo Exempel': 'Bo Exempel är också säljare, men uppdraget var Sara Exempel.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'lista') {
      if (id === 'flik:nya-tips') { setL({ ...l, vy: 'tips' }); tips('Nya tips', 'Två tips väntar, äldst överst. Båda saknar ägare.') }
      else miss(TIPS[id] ?? 'Tryck på fliken Nya tips.')
    } else if (l.vy === 'tips') {
      if (id === 'rad:a') { setL({ ...l, vy: 'lead' }); tips('Annas tips', 'Läs först vad Anna skrev. Det står längst ned i leaden.') }
      else if (id === 'flik:nya-tips') tips('Du är redan här', 'Öppna Annas tips om Brf Exempelgården.')
      else miss(TIPS[id] ?? 'Öppna Brf Exempelgården.')
    } else if (id === 'stang') { setL({ ...BAS, vy: 'tips' }); miss(TIPS.stang) }
    else if (id === 'mer') {
      setL({ ...l, mer: !l.mer })
      if (!l.mer) tips('Annas text', 'Kunden sitter i styrelsen och föreningen har möss i soprummet. Ge nu tipset till Sara.')
    } else if (id === 'dela') {
      if (!l.mer) tips('Läs först', 'Öppna Mer uppgifter och läs vad Anna skrev, så vet du vem som passar.')
      else { setL({ ...l, dela: !l.dela, lista: false }); if (!l.dela) tips('Överlåt eller dela', 'Ägare nu: ingen. Välj Sara under Ny ägare.') }
    } else if (id === 'ny-agare') setL({ ...l, lista: !l.lista })
    else if (id.startsWith('kollega:')) {
      const k = id.slice(8)
      setL({ ...l, agare: k, lista: false })
      if (k === 'Sara Exempel') tips('Sara är vald', 'Knappen Överlåt är inte grå längre. Tryck på den.')
      else miss(TIPS[id] ?? 'Välj Sara Exempel.')
    } else if (id === 'overlat') {
      if (!l.agare) miss('Knappen är grå tills du har valt en kollega under Ny ägare.')
      else if (l.agare !== 'Sara Exempel') miss('Uppdraget var Sara Exempel. Välj om under Ny ägare.')
      else {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Sara Exempel äger nu Brf Exempelgården och Anna står kvar som tipsare. Tipset ligger kvar under Nya tips tills Sara har kontaktat föreningen.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Öppna Mer uppgifter, sedan Överlåt eller dela.')
  }

  const framsteg = l.vy === 'lista' ? 0 : l.vy === 'tips' ? 1 : l.vy === 'klart' ? 6 : 2 + Number(l.mer) + Number(l.dela) + Number(l.agare === 'Sara Exempel')
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} mk={ingen} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
