// src/pages/shared/intranet/interactive/leads/LeadsListaDemo.tsx
// Leadsguiderna: miniatyr av Leads-sidan med flikarna Att göra, Pågående, Nya tips och Alla.
// Klick på en rad öppnar en liten detaljvy med rutan Nästa steg, åtgärdsraden och tidslinjen.
// Grupperna och sorteringen följer leadLogik.ts (gruppFor, arNyttTips, arMin).
// Teknikerns variant visar listan som tipsaren Tove ser den, övriga som säljaren Oskar.

import { useMemo, useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { arOppen } from '../../../../../types/leads'
import { EXEMPEL_LEADS, datumOm, nastaText, type ExempelLead } from './leadsExempel'
import { Ram, Steg } from './leadsShared'
import { lasVariant, segment, type LeadsVariant } from './leadsVariant'

type Flik = 'att-gora' | 'pagaende' | 'nya-tips' | 'alla'
type Grupp = 'forsenade' | 'idag' | 'saknar' | 'vaknar'

const FLIKAR: { id: Flik; label: string }[] = [
  { id: 'att-gora', label: 'Att göra' },
  { id: 'pagaende', label: 'Pågående' },
  { id: 'nya-tips', label: 'Nya tips' },
  { id: 'alla', label: 'Alla' },
]

const GRUPPER: { id: Grupp; label: string }[] = [
  { id: 'forsenade', label: 'Försenade' },
  { id: 'idag', label: 'I dag' },
  { id: 'saknar', label: 'Saknar nästa steg' },
  { id: 'vaknar', label: 'Parkerade som vaknar i dag' },
]

const KR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
const kr = (v: number) => `${KR.format(v)} kr`

function gruppFor(l: ExempelLead): Grupp | null {
  if (!arOppen(l.stage)) return null
  if (l.stage === 'parkerad') return l.parkeradTill != null && l.parkeradTill <= 0 ? 'vaknar' : null
  if (l.nastaDagar == null) return 'saknar'
  if (l.nastaDagar < 0) return 'forsenade'
  if (l.nastaDagar === 0) return 'idag'
  return null
}

// Kontoret ser alla tips, teknikern sina egna och säljaren det säljaren äger
const serNyttTips = (v: LeadsVariant) => (l: ExempelLead) =>
  v === 'kontor' ? true : v === 'tekniker' ? l.tipsare === 'Tove' : l.agare === 'Oskar Exempelsson'

const arNyttTips = (l: ExempelLead) => arOppen(l.stage) && (!l.agare || (l.stage === 'ny' && !!l.tipsare))

function NastaKolumn({ l }: { l: ExempelLead }) {
  if (l.stage === 'parkerad') return <span className="text-slate-400 text-xs">{l.nasta}</span>
  if (!arOppen(l.stage)) return <span className="text-slate-500 text-xs">Avslutad</span>
  if (l.nastaDagar == null) {
    return (
      <span className="flex items-center gap-1.5 text-amber-400 text-xs">
        <Icon name="lead.nasta-steg" size={16} /> Välj nästa steg
      </span>
    )
  }
  const d = nastaText(l.nastaDagar, l.nastaTid)
  return (
    <span className="block min-w-0">
      <span className="block text-slate-200 text-xs truncate">{l.nasta}</span>
      <span className={`block font-mono text-[11px] ${d.sen ? 'text-red-400' : 'text-slate-400'}`}>{d.text}</span>
    </span>
  )
}

function NastaRuta({ l, v }: { l: ExempelLead; v: LeadsVariant }) {
  if (l.stage === 'vunnen') {
    return (
      <div className="p-3 border rounded-xl bg-[#20c58f]/10 border-[#20c58f]/40 text-sm text-white flex items-center gap-1.5">
        <Icon name="lead.vunnen" size={16} className="text-[#20c58f]" /> Leaden är vunnen
      </div>
    )
  }
  if (l.stage === 'parkerad') {
    return (
      <div className="p-3 border rounded-xl bg-amber-500/10 border-amber-500/40 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-white flex items-center gap-1.5">
              <Icon name="lead.parkerad" size={16} className="text-slate-400" /> Parkerad till{' '}
              <span className="font-mono">{datumOm(l.parkeradTill ?? 0)}</span>
              <span className="text-amber-400">, vaknar nu</span>
            </p>
            <p className="text-slate-400 mt-0.5">{l.nasta}</p>
          </div>
          <FalskKnapp primar ikon="allman.aterstall">Återuppta</FalskKnapp>
        </div>
      </div>
    )
  }
  const saknas = l.nastaDagar == null
  const d = saknas ? null : nastaText(l.nastaDagar ?? 0, l.nastaTid)
  const sen = !!d?.sen
  const kanRedigera = v !== 'tekniker'
  return (
    <div className={`p-3 border rounded-xl ${sen ? 'bg-red-500/10 border-red-500/50' : saknas ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-800/30 border-slate-700'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-0.5">
            <Icon name="lead.nasta-steg" size={16} className={sen ? 'text-red-400' : 'text-[#20c58f]'} /> Nästa steg
          </p>
          {saknas ? (
            <p className="text-amber-300">Inget nästa steg. Bestäm vad som ska hända och när.</p>
          ) : (
            <p className="text-white">
              {l.nasta}
              <span className={`ml-2 font-mono text-xs ${sen ? 'text-red-400' : 'text-slate-400'}`}>
                {d?.text}
                {sen ? ' (försenat)' : ''}
              </span>
            </p>
          )}
        </div>
        {kanRedigera && (
          <div className="flex gap-2">
            {saknas ? (
              <FalskKnapp primar>Välj nästa steg</FalskKnapp>
            ) : (
              <>
                <FalskKnapp primar ikon="allman.bock">Klar, välj nästa</FalskKnapp>
                <FalskKnapp>Ändra</FalskKnapp>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Knapp i skärmbilden. Den gör ingenting, men ser ut som i portalen. */
function FalskKnapp({ children, primar, ikon }: { children: string; primar?: boolean; ikon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
        primar ? 'bg-[#20c58f] border-transparent text-[#fff]' : 'bg-slate-800 border-slate-600 text-slate-200'
      }`}
    >
      {ikon && <Icon name={ikon} size={16} />}
      {children}
    </span>
  )
}

function Detalj({ l, v, onTillbaka }: { l: ExempelLead; v: LeadsVariant; onTillbaka: () => void }) {
  const oppen = arOppen(l.stage)
  const visaAtgarder = v !== 'tekniker'
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onTillbaka}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
      >
        <Icon name="allman.chevron" size={16} className="rotate-180" /> Tillbaka till listan
      </button>
      <div>
        <p className="text-base font-semibold text-white">{l.foretag}</p>
        <p className="text-xs text-slate-400">{l.under}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <Steg stage={l.stage} />
        <span className="flex items-center gap-1.5 text-slate-300">
          <Icon name="lead.agare" size={16} className="text-slate-500" />
          {l.agare ?? <span className="text-amber-400">Ingen ägare</span>}
        </span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <Icon name="lead.varde" size={16} className="text-slate-500" />
          {l.premie ? <span className="font-mono">{kr(l.premie)}/år</span> : <span className="text-slate-500">Årspremie ej satt</span>}
        </span>
        {l.tipsare && (
          <span className="flex items-center gap-1.5 text-slate-300">
            <Icon name="lead.tipsare" size={16} className="text-slate-500" /> Tips från {l.tipsare}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FalskKnapp ikon="kontakt.telefon">Logga samtal</FalskKnapp>
        {visaAtgarder && oppen && <FalskKnapp ikon="allman.kalender">Boka besök</FalskKnapp>}
        {visaAtgarder && oppen && l.stage !== 'offert_skickad' && <FalskKnapp ikon="dok.offert">Skapa offert</FalskKnapp>}
        {visaAtgarder && <FalskKnapp ikon="lead.dela">Överlåt eller dela</FalskKnapp>}
        {visaAtgarder && oppen && l.stage !== 'parkerad' && <FalskKnapp ikon="lead.parkerad">Parkera</FalskKnapp>}
        {visaAtgarder && oppen && <FalskKnapp ikon="lead.forlorad">Förlorad</FalskKnapp>}
        {v === 'kontor' && <FalskKnapp ikon="allman.meny">⋯</FalskKnapp>}
      </div>

      <NastaRuta l={l} v={v} />

      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <p className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
          <Icon name="allman.historik" size={16} className="text-[#20c58f]" /> Aktivitet
        </p>
        <ul className="space-y-2">
          {l.historik.map((h, n) => (
            <li key={n} className="flex gap-2.5 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl text-sm">
              <Icon name={h.ikon} size={16} className={`flex-none mt-0.5 ${h.manuell ? 'text-[#20c58f]' : 'text-slate-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-white break-words">
                  {h.manuell && <span className="font-medium">{h.manuell}: </span>}
                  {h.text.replace('{park}', datumOm(l.parkeradTill ?? 0))}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-mono">{datumOm(Number(h.nar))}</span> · {h.vem}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function LeadsListaDemo({ variant }: { variant?: string }) {
  const v = lasVariant(variant)
  const [flik, setFlik] = useState<Flik>('att-gora')
  const [valt, setValt] = useState<string | null>(null)

  // Tekniker: det Tove har tipsat om. Säljare och kontor: Oskars leads, och kontoret ser även Nya tips.
  const mina = useMemo(
    () => EXEMPEL_LEADS.filter((l) => (v === 'tekniker' ? l.tipsare === 'Tove' : l.agare === 'Oskar Exempelsson')),
    [v],
  )

  const rader = useMemo(() => {
    if (flik === 'nya-tips') return EXEMPEL_LEADS.filter(arNyttTips).filter(serNyttTips(v))
    if (flik === 'alla') return [...mina].sort((a, b) => Number(arOppen(b.stage)) - Number(arOppen(a.stage)))
    const oppna = mina.filter((l) => arOppen(l.stage))
    if (flik === 'pagaende') return oppna
    return oppna.filter((l) => gruppFor(l) !== null)
  }, [flik, mina, v])

  const vald = EXEMPEL_LEADS.find((l) => l.id === valt) ?? null
  const attGora = mina.filter((l) => gruppFor(l) !== null).length
  const nyaTips = EXEMPEL_LEADS.filter(arNyttTips).filter(serNyttTips(v)).length

  const rad = (l: ExempelLead) => (
    <button
      key={l.id}
      type="button"
      onClick={() => setValt(l.id)}
      className="w-full grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)] gap-2 sm:gap-3 items-center px-3 py-2.5 text-left text-sm border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 focus:outline-none focus-visible:bg-slate-700/40 focus-visible:shadow-[inset_3px_0_0_#20c58f]"
    >
      <span className="min-w-0">
        <span className="block text-white font-medium truncate">{l.foretag}</span>
        <span className="block text-xs text-slate-400 truncate">{l.under}</span>
      </span>
      <span className="min-w-0 justify-self-end sm:justify-self-start">
        <Steg stage={l.stage} liten />
      </span>
      <span className="col-span-2 sm:col-span-1 min-w-0">
        <NastaKolumn l={l} />
      </span>
      <span className={`hidden sm:block text-xs truncate ${l.agare ? 'text-slate-300' : 'text-amber-400'}`}>
        {l.agare ? l.agare.split(' ')[0] : 'Ingen ägare'}
      </span>
    </button>
  )

  const titel = v === 'tekniker' ? 'Mina leads och tips' : 'Leads (B2B)'

  return (
    <Ram
      where={v === 'tekniker' ? 'Försäljning › Mina leads och tips' : 'Försäljning › Leads (B2B)'}
      caption={v === 'tekniker' ? 'Klicka på en rad. Listan visar det tipsaren Tove ser.' : 'Klicka på en rad. Listan visar det säljaren Oskar ser.'}
    >
      {vald ? (
        <Detalj l={vald} v={v} onTillbaka={() => setValt(null)} />
      ) : (
        <div className="space-y-3">
          <p className="text-base font-bold text-white">{titel}</p>
          <div className="flex border-b border-slate-700/50 overflow-x-auto" role="tablist">
            {FLIKAR.map((f) => {
              const antal = f.id === 'att-gora' ? attGora : f.id === 'nya-tips' ? nyaTips : 0
              return (
                <button key={f.id} type="button" role="tab" aria-selected={flik === f.id} onClick={() => setFlik(f.id)} className={`${segment(flik === f.id)} whitespace-nowrap`}>
                  {f.label}
                  {antal > 0 && <span className={`ml-1.5 font-mono text-xs ${flik === f.id ? 'text-[#20c58f]' : 'text-amber-400'}`}>{antal}</span>}
                </button>
              )
            })}
          </div>

          <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
            {rader.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {flik === 'att-gora' ? 'Inget att göra just nu. Alla leads har ett nästa steg framåt i tiden.' : 'Inga leads här.'}
              </p>
            ) : flik === 'att-gora' ? (
              GRUPPER.map((g) => {
                const iGrupp = rader.filter((l) => gruppFor(l) === g.id)
                if (iGrupp.length === 0) return null
                return (
                  <div key={g.id}>
                    <p className={`px-3 py-1.5 text-xs font-medium border-b border-slate-700/50 bg-slate-900/40 ${g.id === 'forsenade' ? 'text-red-400' : 'text-slate-400'}`}>
                      {g.label} <span className="font-mono">{iGrupp.length}</span>
                    </p>
                    {iGrupp.map(rad)}
                  </div>
                )
              })
            ) : (
              rader.map(rad)
            )}
          </div>
          {flik === 'nya-tips' && (
            <p className="text-xs text-slate-400">
              {v === 'kontor'
                ? 'Här hamnar tips utan ägare. Välj Ta leaden i radens meny, eller öppna tipset och använd Överlåt eller dela för att ge det till en säljare.'
                : v === 'tekniker'
                  ? 'Dina tips som ännu inte har fått en ägare eller inte har kontaktats än. Koordinatorn fördelar dem.'
                  : 'Här syns leads du ser som saknar ägare, eller tips som fortfarande är Ny. Koordinatorn fördelar tipsen.'}
            </p>
          )}
        </div>
      )}
    </Ram>
  )
}
