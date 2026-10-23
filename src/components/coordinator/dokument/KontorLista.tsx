// src/components/coordinator/dokument/KontorLista.tsx
// Kön i kontorets Dokumentsignering, i kontorets arbetsordning:
// Att boka in, Väntar på kontoret, Fastnat hos tekniker (per tekniker med Påminn),
// Bokade, och hopfällda Väntar på kunden och Klara. Raden har namn, status som
// punkt och text, en grå rad med senaste kontakt, och belopp, typ och säljare.
// Telefon: Fastnat hos tekniker är en rad per tekniker som fälls ut.

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../icons/Icon'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'
import { kr, type Bokning } from '../../technician/ny/dokument/dokumentData'
import { Punkt, RADKNAPP } from '../../technician/ny/dokument/dokumentUi'
import {
  KONTORET_UNDER, dokTekniker, fastnatSammanfattning, fornamn, kontaktText, kontorRadStatus,
  type FastnatTekniker, type KontorGrupperat, type KontorRadStatus, type Kontaktlage,
} from './kontorData'

interface RadProps {
  offer: FollowUpOffer
  vald: boolean
  onValj: (o: FollowUpOffer) => void
  status: KontorRadStatus
  arDator: boolean
}

function Rad({ offer: o, vald, onValj, status, arDator }: RadProps) {
  const namn = o.company_name || o.contact_person || 'Namnlös'
  const belopp = kr(o.total_value)
  const typ = o.type === 'offer' ? 'Offert' : 'Avtal'
  const saljare = fornamn(dokTekniker(o).namn)
  const ikon: IconName = o.type === 'offer' ? 'dok.offert' : 'dok.avtal'
  return (
    <li className="relative">
      {vald && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#20c58f] z-[1]" />}
      <button
        type="button"
        data-queue-row={o.id}
        aria-current={vald ? 'true' : undefined}
        onClick={() => onValj(o)}
        className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[36px_minmax(0,1fr)_auto] gap-3 items-start px-4 py-3 min-h-[76px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
          vald ? 'bg-slate-800' : 'hover:bg-slate-800/60'
        }`}
      >
        <span aria-hidden="true" className="hidden lg:flex w-9 h-9 rounded-xl bg-slate-800 text-slate-300 items-center justify-center">
          <Icon name={ikon} size={20} />
        </span>
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold text-white truncate">{namn}</span>
            {belopp && <span className="lg:hidden flex-shrink-0 font-mono text-sm text-white">{belopp}</span>}
          </span>
          <Punkt ton={status.ton}>{status.text}</Punkt>
          {status.ingenKund ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500">
              <Icon name="dok.ny-kund" size={16} />
              {status.detalj}
            </span>
          ) : status.detalj ? (
            <span className="text-sm text-slate-400 truncate">{status.detalj}</span>
          ) : null}
        </span>
        {arDator ? (
          <span className="flex flex-col items-end gap-0.5">
            {belopp && <span className="font-mono text-sm font-medium text-white whitespace-nowrap">{belopp}</span>}
            <span className="text-sm text-slate-400 whitespace-nowrap">{typ}{saljare ? `, ${saljare}` : ''}</span>
          </span>
        ) : (
          <Icon name="allman.chevron" size={20} className="self-center text-slate-500" />
        )}
      </button>
    </li>
  )
}

const LISTRUTA = 'rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden divide-y divide-slate-700/60'

interface Props {
  g: KontorGrupperat
  valdId: string | null
  onValj: (o: FollowUpOffer) => void
  kontakt: Map<string, Kontaktlage>
  bokningar: Map<string, Bokning>
  arDator: boolean
  vantarOppen: boolean
  onVantar: () => void
  klaraOppen: boolean
  onKlara: () => void
  doldaAntal: number
  visaDolda: boolean
  onVisaDolda: () => void
  /** Sökning eller filter är aktivt (styr texten när listan är tom) */
  filtrerat: boolean
  /** Påminn alla teknikerns fastnade dokument (null = får inte påminna) */
  onPaminnAlla: ((t: FastnatTekniker) => void) | null
  paminner: string | null
}

export function KontorLista({
  g, valdId, onValj, kontakt, bokningar, arDator, vantarOppen, onVantar, klaraOppen, onKlara,
  doldaAntal, visaDolda, onVisaDolda, filtrerat, onPaminnAlla, paminner,
}: Props) {
  const [oppnaTekniker, setOppnaTekniker] = useState<Set<string>>(new Set())
  const rad = (o: FollowUpOffer) => {
    const p = g.plats.get(o.id) ?? { grupp: 'klara' as const }
    return (
      <Rad
        key={o.id}
        offer={o}
        vald={o.id === valdId}
        onValj={onValj}
        arDator={arDator}
        status={kontorRadStatus(o, p, kontakt.get(o.id), o.booked_case_id ? bokningar.get(o.booked_case_id) : undefined)}
      />
    )
  }
  const tomt = Object.values(g.antal).every(n => n === 0)

  const paminnKnapp = (t: FastnatTekniker) => onPaminnAlla && t.tekniker.nyckel ? (
    <button type="button" onClick={() => onPaminnAlla(t)} disabled={paminner === t.tekniker.nyckel} className={`${RADKNAPP} ${arDator ? '' : 'w-full'}`}>
      {paminner === t.tekniker.nyckel ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="upphandling.notis" size={20} />}
      Påminn {fornamn(t.tekniker.namn)}
    </button>
  ) : null

  const teknikerRubrik = (t: FastnatTekniker) => (
    <li key={`t-${t.tekniker.nyckel || t.tekniker.namn}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 bg-slate-800/40">
      <span className="text-sm font-semibold text-white">{t.tekniker.namn}</span>
      <span className="text-sm text-slate-400"><span className="font-mono">{t.dokument.length}</span> {t.dokument.length === 1 ? 'dokument' : 'dokument'}</span>
      <span className="ml-auto">{paminnKnapp(t)}</span>
    </li>
  )

  // Telefon: en rad per tekniker, tryck fäller ut dokumenten och Påminn
  const teknikerMobil = (t: FastnatTekniker) => {
    const nyckel = t.tekniker.nyckel || t.tekniker.namn
    const oppen = oppnaTekniker.has(nyckel)
    const senast = t.dokument
      .map(o => kontakt.get(o.id)?.senast)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => b.at.localeCompare(a.at))[0]
    return [
      <li key={`tm-${nyckel}`}>
        <button
          type="button"
          aria-expanded={oppen}
          onClick={() => setOppnaTekniker(s => { const n = new Set(s); if (n.has(nyckel)) n.delete(nyckel); else n.add(nyckel); return n })}
          className="w-full text-left flex items-start gap-3 px-4 py-3 min-h-[76px] hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
        >
          <span className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold text-white truncate">{t.tekniker.namn}</span>
              <span className="font-mono text-sm text-slate-400">{t.dokument.length}</span>
            </span>
            <Punkt ton={t.dokument.some(o => g.plats.get(o.id)?.orsak === 'forfallen' || g.plats.get(o.id)?.orsak === 'mejl') ? 'rod' : 'gul'}>
              {fastnatSammanfattning(t, g.plats)}
            </Punkt>
            {senast && <span className="text-sm text-slate-400 truncate">Senast: {(kontaktText(senast) || '').replace(/^./, c => c.toLowerCase())}</span>}
          </span>
          <Icon name="allman.chevron" size={20} className={`self-center text-slate-500 transition-transform ${oppen ? 'rotate-90' : ''}`} />
        </button>
      </li>,
      ...(oppen ? [
        ...t.dokument.map(rad),
        <li key={`tp-${nyckel}`} className="px-4 py-3 bg-slate-800/40">{paminnKnapp(t)}</li>,
      ] : []),
    ]
  }

  return (
    <div className="space-y-6">
      {tomt && (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 flex flex-col items-center text-center gap-2">
          <Icon name="falt.signera" size={32} className="text-[#20c58f]" />
          <p className="text-[15px] font-semibold text-white">{filtrerat ? 'Inga träffar' : 'Inga dokument'}</p>
          <p className="max-w-sm text-sm text-slate-400">
            {filtrerat ? 'Inget dokument matchar sökningen eller filtret.' : 'Offerter och avtal som skickas från portalen hamnar här.'}
          </p>
        </div>
      )}

      {g.antal.boka > 0 && (
        <section aria-labelledby="kontor-boka" className="space-y-2">
          <Sektion id="kontor-boka" ikon="arendelista.boka" farg="text-[#20c58f]" rubrik="Att boka in" antal={g.antal.boka}>
            Signerade och inte inbokade, äldst först. Samma lista som Att boka in i schemat.
          </Sektion>
          <ul className={LISTRUTA}>{g.boka.map(rad)}</ul>
        </section>
      )}

      {g.antal.kontoret > 0 && (
        <section aria-labelledby="kontor-kontoret" className="space-y-2">
          <Sektion id="kontor-kontoret" ikon="falt.attgora" farg="text-sky-400" rubrik="Väntar på kontoret" antal={g.antal.kontoret}>
            Kunden har skrivit och ingen har svarat, ett samtal är planerat till idag, eller ditt utkast väntar.
          </Sektion>
          <ul className={LISTRUTA}>
            {KONTORET_UNDER.map(u => {
              const lista = g.kontoret[u.key]
              if (lista.length === 0) return null
              return [
                <li key={`rubrik-${u.key}`} className="px-4 pt-2.5 pb-1.5 bg-slate-800/40 text-sm font-semibold text-slate-300">
                  {u.rubrik}<span className="ml-1.5 font-mono font-medium text-slate-400">{lista.length}</span>
                </li>,
                ...lista.map(rad),
              ]
            })}
          </ul>
        </section>
      )}

      {g.antal.fastnat > 0 && (
        <section aria-labelledby="kontor-fastnat" className="space-y-2">
          <Sektion id="kontor-fastnat" ikon="allman.hand" farg="text-amber-500" rubrik="Fastnat hos tekniker" antal={g.antal.fastnat}>
            Förfallna, nära fristen, aldrig öppnade, obesvarade sedan mer än 10 dagar och utkast som inte skickats. Per tekniker.
          </Sektion>
          <ul className={LISTRUTA}>
            {arDator
              ? g.fastnat.flatMap(t => [teknikerRubrik(t), ...t.dokument.map(rad)])
              : g.fastnat.flatMap(teknikerMobil)}
          </ul>
          {!arDator && <p className="text-sm text-slate-400">Tryck på en tekniker för dokumenten och Påminn.</p>}
        </section>
      )}

      {g.antal.bokade > 0 && (
        <section aria-labelledby="kontor-bokade" className="space-y-2">
          <Sektion id="kontor-bokade" ikon="allman.kalender" farg="text-[#20c58f]" rubrik="Bokade" antal={g.antal.bokade}>
            Inbokade och schemalagda via Boka in. Syns i 14 dagar.
          </Sektion>
          <ul className={LISTRUTA}>{g.bokade.map(rad)}</ul>
        </section>
      )}

      {(g.antal.vantar > 0 || g.antal.klara > 0 || doldaAntal > 0) && (
        <section className="space-y-2">
          {g.antal.vantar > 0 && (
            <>
              <Hopfall ikon="falt.vantar" rubrik="Väntar på kunden" text="Skickade och inom fristen" antal={g.antal.vantar} oppen={vantarOppen} onToggle={onVantar} id="kontor-vantar-lista" />
              {vantarOppen && <ul id="kontor-vantar-lista" className={LISTRUTA}>{g.vantar.map(rad)}</ul>}
            </>
          )}
          {g.antal.klara > 0 && (
            <>
              <Hopfall ikon="falt.klart" rubrik="Klara" text="Avböjda, avskrivna och bokade sedan länge" antal={g.antal.klara} oppen={klaraOppen} onToggle={onKlara} id="kontor-klara-lista" />
              {klaraOppen && <ul id="kontor-klara-lista" className={LISTRUTA}>{g.klara.map(rad)}</ul>}
            </>
          )}
          {doldaAntal > 0 && (
            <button
              type="button"
              onClick={onVisaDolda}
              className="h-11 inline-flex items-center gap-2 px-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="dok.dolj" size={20} />
              {visaDolda ? 'Dölj dokumenten du har dolt igen' : `Visa ${doldaAntal} dokument du har dolt`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}

function Sektion({ id, ikon, farg, rubrik, antal, children }: { id: string; ikon: IconName; farg: string; rubrik: string; antal: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={ikon} size={24} className={`mt-0.5 flex-shrink-0 ${farg}`} />
      <div className="flex-1 min-w-0">
        <h2 id={id} className="flex items-baseline gap-2 text-[17px] font-semibold text-white">
          {rubrik}<span className="font-mono text-sm font-medium text-slate-400">{antal}</span>
        </h2>
        <p className="text-sm text-slate-400">{children}</p>
      </div>
    </div>
  )
}

function Hopfall({ ikon, rubrik, text, antal, oppen, onToggle, id }: { ikon: IconName; rubrik: string; text: string; antal: number; oppen: boolean; onToggle: () => void; id: string }) {
  return (
    <button
      type="button"
      aria-expanded={oppen}
      aria-controls={id}
      onClick={onToggle}
      className="w-full min-h-[56px] flex items-center gap-3 px-4 rounded-2xl bg-slate-900 border border-slate-700/60 text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
    >
      <Icon name={ikon} size={20} className="flex-shrink-0 text-slate-400" />
      <span className="text-base font-semibold text-white">{rubrik}<span className="ml-1.5 font-mono font-medium text-slate-400">{antal}</span></span>
      <span className="hidden sm:inline text-sm text-slate-400 truncate">{text}</span>
      <Icon name="allman.chevron" size={20} className={`ml-auto flex-shrink-0 text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} />
    </button>
  )
}

export default KontorLista
