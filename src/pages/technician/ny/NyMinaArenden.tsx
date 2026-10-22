// src/pages/technician/ny/NyMinaArenden.tsx
// Mina ärenden i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
//
// Grupper:
//  1. Idag och denna vecka: besök från idag till och med söndag
//  2. Väntar på dig: bokning saknas, eller datumet har passerat utan avslut
//  3. Planerade besök framåt: allt efter denna vecka, hopfällt och grupperat per kund.
//     Räknas aldrig som försenat.
//  4. Avslutade: hopfällt, de senaste först
// Alla rader öppnas i rätt modal via OppnaArende.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { HjalpText } from '../../../components/technician/ny/hjalp/HjalpText'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { StatusPunkt } from '../../../components/technician/ny/besokUi'
import { TYP_IKON, statusTon } from '../../../components/technician/ny/besokTyp'
import { useAllaArenden } from '../../../hooks/useTeknikerBesok'
import {
  svenskDag, veckansSlut, kortDag, klockslag, besokBeskrivning, vantarPaDig, type DagBesok, type VantarRad,
} from '../../../services/teknikerDagService'

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Idag och denna vecka', text: 'Överst står det du ska göra den här veckan, i tidsordning.', mal: 'mina-vecka' },
  { rubrik: 'Väntar på dig', text: 'Ärenden som behöver en tid, och besök som är passerade men inte avslutade.', mal: 'mina-vantar' },
  { rubrik: 'Planerade besök framåt', text: 'Avtalskundernas besök längre fram. De flyttar upp av sig själva när det är dags, inget här är försenat.', mal: 'mina-plan' },
  { rubrik: 'Sök', text: 'Sök på kund, adress eller ärendenummer i alla grupper på en gång.', mal: 'mina-sok' },
]

const AVSLUTADE_MAX = 30

function matchar(b: DagBesok, q: string): boolean {
  if (!q) return true
  return [b.kund, b.adress, b.titel, b.arendenummer, b.kontaktperson, b.skadedjur]
    .some(f => f && f.toLowerCase().includes(q))
}

function ArendeRad({ b, idag, onOppna }: { b: DagBesok; idag: string; onOppna: () => void }) {
  const st = statusTon(b)
  return (
    <li>
      <button
        type="button"
        onClick={onOppna}
        className="w-full flex items-center gap-3 px-3 py-3 min-h-[64px] text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
      >
        <span className="w-14 flex-shrink-0 flex flex-col">
          <span className="font-mono text-sm font-semibold text-white">{klockslag(b.start) || '--:--'}</span>
          <span className="text-xs text-slate-400">{kortDag(b.dag, idag)}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-white truncate">{b.kund}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-slate-400 truncate">
            <Icon name={TYP_IKON[b.typ]} size={16} className="flex-shrink-0" />
            <span className="truncate">{besokBeskrivning(b)}</span>
          </span>
        </span>
        <StatusPunkt ton={st.ton} className="hidden sm:inline-flex">{st.text}</StatusPunkt>
        <Icon name="allman.chevron" size={16} className="text-slate-500 flex-shrink-0" />
      </button>
    </li>
  )
}

function VantarRadVy({ v, onOppna }: { v: VantarRad; onOppna: () => void }) {
  const b = v.besok
  const text = v.orsak === 'boka'
    ? 'Inte bokad. Kontakta kunden och boka en tid.'
    : `Besöket ${b.dag ?? ''} är passerat men inte avslutat.`
  return (
    <li className="px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-white truncate">{b.kund}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-slate-400">
            <Icon name={TYP_IKON[b.typ]} size={16} className="flex-shrink-0" />
            {besokBeskrivning(b)}{b.arendenummer ? `, ${b.arendenummer}` : ''}
          </span>
        </span>
      </div>
      <StatusPunkt ton={v.orsak === 'avsluta' ? 'rod' : 'gul'}>{text}</StatusPunkt>
      <button
        type="button"
        onClick={onOppna}
        className="h-11 px-4 rounded-xl border border-slate-600 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      >
        {v.orsak === 'boka' ? 'Öppna och boka tid' : 'Öppna och avsluta'}
      </button>
    </li>
  )
}

function GruppRubrik({ id, rubrik, antal, ton, children, hoger }: { id: string; rubrik: string; antal: number; ton: string; children: ReactNode; hoger?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${ton}`} />
        <div className="flex-1">
          <HjalpText id={id} rubrik={rubrik} hoger={<span className="flex items-center gap-2"><span className="font-mono text-sm text-slate-400">{antal}</span>{hoger}</span>}>
            {children}
          </HjalpText>
        </div>
      </div>
    </div>
  )
}

function Hopfallbar({ id, rubrik, antal, oppen, onToggle }: { id: string; rubrik: string; antal: number; oppen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={oppen}
      aria-controls={id}
      onClick={onToggle}
      className="w-full flex items-center gap-2 min-h-[48px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-xl"
    >
      <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-slate-500" />
      <span className="flex-1 text-[15px] font-semibold text-white">{rubrik}</span>
      <span className="font-mono text-sm text-slate-400">{antal}</span>
      <Icon name="allman.chevron" size={20} className={`text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} />
    </button>
  )
}

interface KundGrupp {
  nyckel: string
  kund: string
  besok: DagBesok[]
}

export default function NyMinaArenden() {
  const { besok: alla, laddar, fel, ladda } = useAllaArenden()
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [visaMig, setVisaMig] = useState(false)
  const [sok, setSok] = useState('')
  const [planOppen, setPlanOppen] = useState(false)
  const [avslutadeOppen, setAvslutadeOppen] = useState(false)
  const [utanTidOppen, setUtanTidOppen] = useState(false)
  const [oppnaKunder, setOppnaKunder] = useState<Set<string>>(new Set())

  const idag = svenskDag()
  const veckoslut = veckansSlut(idag)
  const q = sok.trim().toLowerCase()

  const { vecka, vantar, plan, avslutade, utanTid } = useMemo(() => {
    const filtrerade = alla.filter(b => matchar(b, q))
    const vantarRader = vantarPaDig(filtrerade, idag)
    const vantarNycklar = new Set(vantarRader.map(v => v.besok.nyckel))

    const veckaLista = filtrerade.filter(b => b.dag && b.dag >= idag && b.dag <= veckoslut && !vantarNycklar.has(b.nyckel))

    const planKarta = new Map<string, KundGrupp>()
    for (const b of filtrerade) {
      if (b.avslutad || !b.dag || b.dag <= veckoslut || vantarNycklar.has(b.nyckel)) continue
      const nyckel = b.customerId || `namn:${b.kund}`
      const g = planKarta.get(nyckel) ?? { nyckel, kund: b.kund, besok: [] }
      g.besok.push(b)
      planKarta.set(nyckel, g)
    }
    const planLista = [...planKarta.values()].sort((a, b) => (a.besok[0].dag ?? '').localeCompare(b.besok[0].dag ?? ''))

    const avslutadeLista = filtrerade
      .filter(b => b.avslutad)
      .sort((a, b) => ((b.avslutsdatum ?? b.start)?.getTime() ?? 0) - ((a.avslutsdatum ?? a.start)?.getTime() ?? 0))

    // Övriga öppna: utan tid eller med passerat datum men en status som inte väntar på
    // teknikern, till exempel offert skickad eller ombokning
    const utanTidLista = filtrerade.filter(b => !b.avslutad && (!b.dag || b.dag < idag) && !vantarNycklar.has(b.nyckel))

    return { vecka: veckaLista, vantar: vantarRader, plan: planLista, avslutade: avslutadeLista, utanTid: utanTidLista }
  }, [alla, q, idag, veckoslut])

  const planAntal = plan.reduce((s, g) => s + g.besok.length, 0)
  const attTaHand = vecka.filter(b => !b.avslutad).length + vantar.length

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: laddar ? undefined : `${attTaHand} att ta hand om nu`, onVisaMig: oppnaVisaMig })

  const oppna = (b: DagBesok) => setOppet({ kalla: b.kalla, id: b.id })
  const vaxlaKund = (nyckel: string) => setOppnaKunder(prev => {
    const n = new Set(prev)
    if (n.has(nyckel)) n.delete(nyckel); else n.add(nyckel)
    return n
  })

  // Vid sökning fälls grupperna ut så träffarna syns
  const visaPlan = planOppen || !!q
  const visaAvslutade = avslutadeOppen || !!q
  const visaUtanTid = utanTidOppen || !!q

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
      <div data-genomgang="mina-sok" className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <Icon name="allman.sok" size={20} />
        </span>
        <input
          type="search"
          value={sok}
          onChange={e => setSok(e.target.value)}
          placeholder="Sök kund, adress eller ärendenummer"
          aria-label="Sök bland mina ärenden"
          className="w-full h-12 pl-11 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
        />
      </div>

      {laddar && alla.length === 0 ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Hämtar dina ärenden..." /></div>
      ) : fel ? (
        <div className="rounded-2xl bg-slate-900 border border-red-500/40 p-4">
          <p className="text-white font-medium">{fel}</p>
          <button type="button" onClick={ladda} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800">Försök igen</button>
        </div>
      ) : (
        <>
          <section data-genomgang="mina-vecka" className="space-y-2">
            <GruppRubrik id="mina-vecka" rubrik="Idag och denna vecka" antal={vecka.length} ton="bg-[#20c58f]">
              Dina besök från idag till och med söndag, i tidsordning.
            </GruppRubrik>
            {vecka.length === 0 ? (
              <p className="text-sm text-slate-500">{q ? 'Inga träffar den här veckan.' : 'Inget inbokat resten av veckan.'}</p>
            ) : (
              <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                {vecka.map(b => <ArendeRad key={b.nyckel} b={b} idag={idag} onOppna={() => oppna(b)} />)}
              </ul>
            )}
          </section>

          <section data-genomgang="mina-vantar" className="space-y-2">
            <GruppRubrik id="mina-vantar" rubrik="Väntar på dig" antal={vantar.length} ton="bg-amber-500">
              Ärenden som behöver en tid och besök som har passerat utan att avslutas.
            </GruppRubrik>
            {vantar.length === 0 ? (
              <p className="text-sm text-slate-500">{q ? 'Inga träffar.' : 'Inget väntar på dig.'}</p>
            ) : (
              <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                {vantar.map(v => <VantarRadVy key={v.besok.nyckel} v={v} onOppna={() => oppna(v.besok)} />)}
              </ul>
            )}
          </section>

          <section data-genomgang="mina-plan" className="space-y-2">
            <Hopfallbar id="mina-plan-lista" rubrik="Planerade besök framåt" antal={planAntal} oppen={visaPlan} onToggle={() => setPlanOppen(v => !v)} />
            <div className="flex items-start gap-2 rounded-xl bg-slate-800/60 px-3 py-2.5 text-sm text-slate-300">
              <Icon name="kund.info" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <p>Det här är planerade besök längre fram, främst hos dina avtalskunder. De dyker upp i din dag när det är dags. Inget här räknas som försenat och du behöver inte göra något med dem nu.</p>
            </div>
            {visaPlan && (
              <div id="mina-plan-lista">
                {plan.length === 0 ? (
                  <p className="text-sm text-slate-500">Inga planerade besök efter den här veckan.</p>
                ) : (
                  <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                    {plan.map(g => {
                      const oppen = oppnaKunder.has(g.nyckel) || !!q
                      const forsta = g.besok[0]
                      return (
                        <li key={g.nyckel}>
                          <button
                            type="button"
                            aria-expanded={oppen}
                            onClick={() => vaxlaKund(g.nyckel)}
                            className="w-full flex items-center gap-3 px-3 py-3 min-h-[60px] text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block text-[15px] font-medium text-white truncate">{g.kund}</span>
                              <span className="block text-[13px] text-slate-400">
                                {g.besok.length} {g.besok.length === 1 ? 'planerat besök' : 'planerade besök'}, nästa {forsta.dag}
                              </span>
                            </span>
                            <Icon name="allman.chevron" size={16} className={`text-slate-500 transition-transform ${oppen ? 'rotate-90' : ''}`} />
                          </button>
                          {oppen && (
                            <ul className="bg-slate-950/40 divide-y divide-slate-700/40">
                              {g.besok.map(b => <ArendeRad key={b.nyckel} b={b} idag={idag} onOppna={() => oppna(b)} />)}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          {utanTid.length > 0 && (
            <section className="space-y-2">
              <Hopfallbar id="mina-utantid-lista" rubrik="Övriga öppna ärenden" antal={utanTid.length} oppen={visaUtanTid} onToggle={() => setUtanTidOppen(v => !v)} />
              {visaUtanTid && (
                <ul id="mina-utantid-lista" className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                  {utanTid.map(b => <ArendeRad key={b.nyckel} b={b} idag={idag} onOppna={() => oppna(b)} />)}
                </ul>
              )}
            </section>
          )}

          <section className="space-y-2">
            <Hopfallbar id="mina-avslutade-lista" rubrik="Avslutade" antal={avslutade.length} oppen={visaAvslutade} onToggle={() => setAvslutadeOppen(v => !v)} />
            {visaAvslutade && (
              <div id="mina-avslutade-lista" className="space-y-2">
                {avslutade.length === 0 ? (
                  <p className="text-sm text-slate-500">Inga avslutade ärenden.</p>
                ) : (
                  <>
                    <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                      {avslutade.slice(0, AVSLUTADE_MAX).map(b => <ArendeRad key={b.nyckel} b={b} idag={idag} onOppna={() => oppna(b)} />)}
                    </ul>
                    {avslutade.length > AVSLUTADE_MAX && (
                      <p className="text-[13px] text-slate-500">Visar de {AVSLUTADE_MAX} senaste. Sök för att hitta äldre ärenden.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <OppnaArende arende={oppet} onClose={() => setOppet(null)} onSaved={ladda} />
      {!laddar && <Genomgang id="ny-mina-arenden" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />}
    </div>
  )
}
