// src/pages/technician/ny/NyMinaArenden.tsx
// Mina ärenden i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
//
// Överst en mening om läget och tre lägen med antal:
//  Att göra   Den här veckan, Väntar på dig (Behöver en tid, Passerade besök att
//             avsluta) och hopfällt Övriga öppna ärenden
//  Kommande   närmaste fyra veckorna per vecka, längre fram per kund (hopfällt)
//  Avslutade  senaste först, per månad
// Grupperna och reglerna är desamma som förut, se components/technician/ny/arenden/arendeLogik.ts.
//
// Dator: listan i huvudytan och valt ärende i en högerpanel. Klick väljer,
// dubbelklick eller ikonknappen öppnar. Telefon: tryck öppnar ärendet direkt.
// Alla ärenden öppnas i rätt modal via OppnaArende och listan läses om efteråt.
//
// Djuplänk som gamla TechnicianCases: ?openCase=<id>&caseType=private|business|contract
// (global sök, uppföljningslistan). comm=1 öppnar kommunikationen direkt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { useAllaArenden } from '../../../hooks/useTeknikerBesok'
import { svenskDag, type DagBesok } from '../../../services/teknikerDagService'
import { Icon } from '../../../components/icons/Icon'
import { veckonummer, veckoSpann } from '../../../components/technician/ny/schema/schemaLogik'
import {
  GAMMALT_EFTER_DAGAR, KOMMANDE_VECKOR, STANDARD_SORTERING, gruppera, kortDatum, lageFor, manadText, sammanfattning, standardFilter,
  type ArendeFilter, type Lage, type Sortering,
} from '../../../components/technician/ny/arenden/arendeLogik'
import { FilterRad, LageVal } from '../../../components/technician/ny/arenden/ArendeVerktyg'
import {
  GruppEtikett, Hopfall, Laddar, Lista, SektionRubrik, TomRad, TomtLage, type ListaProps,
} from '../../../components/technician/ny/arenden/ArendeSektion'
import { ArendeForhandsvisning } from '../../../components/technician/ny/arenden/ArendeForhandsvisning'
import { hittaKalla, kallaForCaseType } from '../../../components/technician/ny/arenden/djuplank'
import { useArDator } from '../../../components/technician/ny/arenden/useArDator'

const GENOMGANG_MOBIL: GenomgangSteg[] = [
  { rubrik: 'Tre lägen', text: 'Att göra visar veckan och det som väntar på dig. Kommande och Avslutade ligger bredvid. Siffran är antalet ärenden.', mal: 'mina-lagen' },
  { rubrik: 'Väntar på dig', text: 'Överst det som behöver en tid, sedan passerade besök som ska avslutas. Tryck på en rad för att öppna ärendet.', mal: 'mina-vantar' },
  { rubrik: 'Filtrera och sortera', text: 'Skriv för att filtrera listan. Filter väljer typ och ålder, Sortera byter ordning.', mal: 'mina-filter' },
]

const GENOMGANG_DATOR: GenomgangSteg[] = [
  GENOMGANG_MOBIL[0],
  { rubrik: 'Väntar på dig', text: 'Överst det som behöver en tid, sedan passerade besök som ska avslutas. Ikonen längst till höger öppnar ärendet.', mal: 'mina-vantar' },
  { rubrik: 'Valt ärende', text: 'Klicka på en rad så visas ärendet här, med Öppna ärendet, Navigera och Ring. Dubbelklick öppnar direkt.', mal: 'mina-valt' },
  GENOMGANG_MOBIL[2],
]

export default function NyMinaArenden() {
  const { profile } = useAuth()
  const minId = profile?.technician_id ?? null
  const [params, setParams] = useSearchParams()
  const arDator = useArDator()
  const { besok: alla, laddar, fel, ladda } = useAllaArenden()

  const [lage, setLage] = useState<Lage>('attgora')
  const [sok, setSok] = useState('')
  const [filter, setFilter] = useState<ArendeFilter>(standardFilter)
  const [sortering, setSortering] = useState<Record<Lage, Sortering>>(STANDARD_SORTERING)
  const [valdNyckel, setValdNyckel] = useState<string | null>(null)
  const [oppet, setOppet] = useState<ArendeRef | null>(null)
  const [kommunikation, setKommunikation] = useState(false)
  const [visaMig, setVisaMig] = useState(false)
  const [ovrigaOppen, setOvrigaOppen] = useState(false)
  const [oppnaKunder, setOppnaKunder] = useState<Set<string>>(new Set())
  // null betyder standard: senaste månaden utfälld
  const [oppnaManader, setOppnaManader] = useState<Set<string> | null>(null)

  const idag = svenskDag()
  const q = sok.trim().toLowerCase()
  const soker = q.length > 0

  const g = useMemo(() => gruppera(alla, q, filter, sortering, idag), [alla, q, filter, sortering, idag])

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: laddar && alla.length === 0 ? undefined : `${g.antal.attgora} att ta hand om nu`, onVisaMig: oppnaVisaMig })

  const oppna = useCallback((b: DagBesok, komm = false) => {
    setKommunikation(komm)
    setOppet({ kalla: b.kalla, id: b.id })
  }, [])
  const klick = (b: DagBesok) => {
    if (arDator) setValdNyckel(b.nyckel)
    else oppna(b)
  }

  // ─── Djuplänk ?openCase=<id>&caseType=<typ>(&comm=1) ───
  const hanterad = useRef<string | null>(null)
  useEffect(() => {
    const id = params.get('openCase')
    if (!id) { hanterad.current = null; return }
    if (laddar || !minId) return
    // Samma länk hanteras en gång, även om effekten körs två gånger innan parametrarna tagits bort
    const nyckel = `${id}:${params.get('caseType') ?? ''}`
    if (hanterad.current === nyckel) return
    hanterad.current = nyckel
    const kalla = kallaForCaseType(params.get('caseType'))
    const komm = params.get('comm') === '1'
    setParams(p => {
      for (const k of ['openCase', 'caseType', 'comm', 'tab']) p.delete(k)
      return p
    }, { replace: true })

    const b = alla.find(x => x.id === id && (!kalla || x.kalla === kalla)) ?? alla.find(x => x.id === id)
    if (b) {
      setLage(lageFor(b, idag))
      setValdNyckel(b.nyckel)
      oppna(b, komm)
      return
    }
    // Inte i listan (till exempel arkiverat): öppna om teknikern är tilldelad.
    // Avbryts inte vid omkörning: parametrarna tas bort ovan, vilket kör om effekten.
    hittaKalla(id, minId, kalla)
      .then(k => {
        if (k) { setKommunikation(komm); setOppet({ kalla: k, id }) }
        else toast.error('Ärendet kunde inte hittas bland dina ärenden')
      })
      .catch(() => toast.error('Ärendet kunde inte öppnas'))
  }, [params, setParams, laddar, alla, minId, idag, oppna])

  // ─── Hopfällning ───
  const vaxlaKund = (nyckel: string) => setOppnaKunder(prev => {
    const n = new Set(prev)
    if (n.has(nyckel)) n.delete(nyckel); else n.add(nyckel)
    return n
  })
  const manadArOppen = (manad: string, i: number) => soker || (oppnaManader ? oppnaManader.has(manad) : i === 0)
  const vaxlaManad = (manad: string, i: number) => setOppnaManader(prev => {
    const n = new Set(prev ?? (g.avslutade[0] ? [g.avslutade[0].manad] : []))
    if (manadArOppen(manad, i)) n.delete(manad); else n.add(manad)
    return n
  })
  const visaOvriga = ovrigaOppen || soker

  // ─── Valt ärende på datorn: valt, annars första raden i läget ───
  const synligaILaget = useMemo((): DagBesok[] => {
    if (lage === 'attgora') return [...g.vecka, ...g.boka, ...g.avsluta, ...(visaOvriga ? g.ovriga : [])]
    if (lage === 'kommande') return g.veckor.flatMap(v => v.besok)
    return g.avslutade[0]?.besok ?? []
  }, [lage, g, visaOvriga])

  const valt = useMemo(() => {
    if (!arDator) return null
    if (valdNyckel) {
      const b = alla.find(x => x.nyckel === valdNyckel)
      if (b) return b
    }
    return synligaILaget[0] ?? null
  }, [arDator, valdNyckel, alla, synligaILaget])

  const bytLage = (l: Lage) => { setLage(l); setValdNyckel(null) }

  const radProps: ListaProps = { idag, arDator, valdNyckel: valt?.nyckel ?? null, onKlick: klick, onOppna: b => oppna(b) }

  // ─── Lägen ───
  const attGora = () => {
    const vantar = g.boka.length + g.avsluta.length
    if (g.vecka.length === 0 && vantar === 0 && g.ovriga.length === 0) {
      return soker || filter.doldaTyper.size || filter.alder !== 'alla'
        ? <TomtLage rubrik="Inga träffar" text="Inget i Att göra matchar sökningen eller filtret." />
        : <TomtLage rubrik="Inget att göra just nu" text="Allt är bokat och avslutat. Nya ärenden och bokade besök dyker upp här." />
    }
    return (
      <div className="space-y-6">
        <section data-genomgang="mina-vecka" className="space-y-2">
          <SektionRubrik id="mina-vecka" rubrik="Den här veckan" ikon="falt.vecka" antal={g.vecka.length} betonad>
            Dina besök från idag till och med söndag.
          </SektionRubrik>
          {g.vecka.length > 0
            ? <Lista besok={g.vecka} sort="vecka" {...radProps} />
            : <TomRad>{soker ? 'Inga träffar den här veckan.' : 'Inget mer inbokat den här veckan.'}</TomRad>}
        </section>

        <div data-genomgang="mina-vantar" className="space-y-5">
          <GruppEtikett text="Väntar på dig" antal={vantar} />
          {vantar === 0 && <TomRad>{soker ? 'Inga träffar.' : 'Inget väntar på dig.'}</TomRad>}
          {g.boka.length > 0 && (
            <section className="space-y-2">
              <SektionRubrik id="mina-boka" rubrik="Behöver en tid" ikon="arendelista.boka" antal={g.boka.length}>
                Ärendet har ingen bokad tid. Ring kunden och boka in besöket.
              </SektionRubrik>
              <Lista besok={g.boka} sort="boka" {...radProps} />
            </section>
          )}
          {g.avsluta.length > 0 && (
            <section className="space-y-2">
              <SektionRubrik id="mina-avsluta" rubrik="Passerade besök att avsluta" ikon="arendelista.passerad" antal={g.avsluta.length}>
                Datumet har passerat men besöket är inte avslutat. Orange när det gått mer än {GAMMALT_EFTER_DAGAR} dagar.
              </SektionRubrik>
              <Lista besok={g.avsluta} sort="avsluta" {...radProps} />
            </section>
          )}
        </div>

        {g.ovriga.length > 0 && (
          <section className="space-y-2">
            <Hopfall
              id="mina-ovriga-lista"
              rubrik="Övriga öppna ärenden"
              detalj="Väntar på kunden eller kontoret, till exempel offert skickad eller ombokning"
              antal={g.ovriga.length}
              oppen={visaOvriga}
              onToggle={() => setOvrigaOppen(v => !v)}
            />
            {visaOvriga && <div id="mina-ovriga-lista"><Lista besok={g.ovriga} sort="ovrig" {...radProps} /></div>}
          </section>
        )}
      </div>
    )
  }

  const kommande = () => {
    if (g.antal.kommande === 0) {
      return soker || filter.doldaTyper.size
        ? <TomtLage rubrik="Inga träffar" text="Inget kommande matchar sökningen eller filtret." />
        : <TomtLage rubrik="Inget planerat efter den här veckan" text="Bokade besök längre fram dyker upp här." />
    }
    const langreAntal = g.langreFram.reduce((s, k) => s + k.besok.length, 0)
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <SektionRubrik id="mina-kommande" rubrik={`De närmaste ${KOMMANDE_VECKOR} veckorna`} ikon="falt.vecka" antal={g.veckor.reduce((s, v) => s + v.besok.length, 0)} betonad>
            Besöken efter den här veckan, vecka för vecka. Inget här är försenat.
          </SektionRubrik>
          {g.veckor.length === 0 && <TomRad>Inget bokat de närmaste veckorna.</TomRad>}
          {g.veckor.map(v => (
            <div key={v.mandag} className="space-y-1.5">
              <h3 className="flex items-baseline gap-2 px-1 text-sm">
                <span className="font-semibold text-white">Vecka {veckonummer(v.mandag)}</span>
                <span className="text-slate-400">{veckoSpann(v.mandag)}</span>
                <span className="ml-auto font-mono text-[13px] text-slate-400">{v.besok.length}</span>
              </h3>
              <Lista besok={v.besok} sort="kommande" {...radProps} />
            </div>
          ))}
        </section>

        {g.langreFram.length > 0 && (
          <section data-genomgang="mina-plan" className="space-y-2">
            <SektionRubrik id="mina-langre" rubrik="Längre fram" ikon="falt.manad" antal={langreAntal}>
              Planerade besök längre fram, främst hos dina avtalskunder, samlade per kund. De flyttar upp av sig själva när det är dags och du behöver inte göra något med dem nu.
            </SektionRubrik>
            <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
              {g.langreFram.map(k => {
                const oppen = oppnaKunder.has(k.nyckel) || soker
                const forsta = k.besok[0]
                const id = `mina-kund-${k.nyckel.replace(/[^a-z0-9]/gi, '')}`
                return (
                  <li key={k.nyckel}>
                    <Hopfall
                      inbaddad
                      id={id}
                      rubrik={k.kund}
                      detalj={`${k.besok.length} ${k.besok.length === 1 ? 'planerat besök' : 'planerade besök'}, nästa ${forsta.dag ? kortDatum(forsta.dag, idag) : ''}`}
                      antal={k.besok.length}
                      oppen={oppen}
                      onToggle={() => vaxlaKund(k.nyckel)}
                    />
                    {oppen && (
                      <div id={id} className="bg-slate-950/30 border-t border-slate-700/60">
                        <Lista utanRam besok={k.besok} sort="kommande" {...radProps} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    )
  }

  const avslutade = () => {
    if (g.antal.avslutade === 0) {
      return soker || filter.doldaTyper.size || filter.alder !== 'alla'
        ? <TomtLage rubrik="Inga träffar" text="Inga avslutade ärenden matchar sökningen eller filtret." />
        : <TomtLage rubrik="Inga avslutade ärenden" text="Ärenden du avslutar hamnar här, senaste först." />
    }
    return (
      <div className="space-y-3">
        <SektionRubrik id="mina-avslutade" rubrik="Avslutade" ikon="arendelista.avslutade" antal={g.antal.avslutade} betonad>
          Per månad, räknat från dagen ärendet avslutades.
        </SektionRubrik>
        {g.avslutade.map((m, i) => {
          const oppen = manadArOppen(m.manad, i)
          const id = `mina-manad-${m.manad}`
          return (
            <section key={m.manad} className="space-y-2">
              <Hopfall id={id} rubrik={manadText(m.manad)} antal={m.besok.length} oppen={oppen} onToggle={() => vaxlaManad(m.manad, i)} />
              {oppen && <div id={id}><Lista besok={m.besok} sort="avslutad" datumRubrik="Avslutat" {...radProps} /></div>}
            </section>
          )
        })}
      </div>
    )
  }

  const laddarForsta = laddar && alla.length === 0

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 space-y-4">
      {laddarForsta ? (
        <Laddar />
      ) : fel ? (
        <div className="max-w-xl rounded-2xl bg-slate-900 border border-red-500/40 p-4">
          <p className="text-white font-medium">{fel}</p>
          <button type="button" onClick={ladda} className="mt-3 h-11 px-4 rounded-xl border border-slate-600 text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">Försök igen</button>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-300">
            <Icon name="falt.attgora" size={20} className="mt-0.5 flex-shrink-0 text-[#20c58f]" />
            <span>{sammanfattning(g, idag)}</span>
          </p>

          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
            <LageVal lage={lage} antal={g.antal} onLage={bytLage} />
            <div className="flex-1 min-w-0">
              <FilterRad
                lage={lage}
                sok={sok}
                onSok={setSok}
                filter={filter}
                onFilter={setFilter}
                typer={g.typer}
                sortering={sortering[lage]}
                onSortering={s => setSortering(prev => ({ ...prev, [lage]: s }))}
              />
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
            <div role="tabpanel" aria-label={lage === 'attgora' ? 'Att göra' : lage === 'kommande' ? 'Kommande' : 'Avslutade'} className="min-w-0 pt-1">
              {lage === 'attgora' ? attGora() : lage === 'kommande' ? kommande() : avslutade()}
            </div>
            {arDator && (
              <aside aria-label="Valt ärende" className="sticky top-4">
                <ArendeForhandsvisning besok={valt} idag={idag} minId={minId} onOppna={b => oppna(b)} />
              </aside>
            )}
          </div>
        </>
      )}

      <OppnaArende
        arende={oppet}
        onClose={() => { setOppet(null); setKommunikation(false) }}
        onSaved={ladda}
        oppnaKommunikation={kommunikation}
      />
      {!laddarForsta && (
        <Genomgang id={arDator ? 'ny-mina-arenden-v2-dator' : 'ny-mina-arenden-v2'} steg={arDator ? GENOMGANG_DATOR : GENOMGANG_MOBIL} tvinga={visaMig} onStang={() => setVisaMig(false)} />
      )}
    </div>
  )
}
