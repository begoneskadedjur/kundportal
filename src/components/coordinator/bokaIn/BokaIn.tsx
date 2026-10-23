// src/components/coordinator/bokaIn/BokaIn.tsx
// Boka in ett signerat dokument. Samma flöde från schemats låda "Att boka in"
// och från Dokumentsignering (kontorsläget).
//
// API:
//   <BokaIn
//     kalla={{ typ: 'dokument', offerId } | { typ: 'arende', caseId, tabell }}
//     oppen={boolean}
//     onStang={() => void}                    // Avbryt eller stäng utan att boka
//     onKlar={(nyttArendeId) => void}         // Bokat (id) eller "Inget ärende" (null)
//     tekniker?={Technician[]}                // Valfritt, annars hämtas aktiva tekniker
//   />
//   tabell = 'private_cases' | 'business_cases' | 'cases'
//
// Steg 1, förstegsdialogen: ärendetyp (förval efter dokumentet, se
// bokaInService.forvaldArendetyp), ROT/RUT, underlaget från signeringen,
// offertens rader med "Följer med till nya ärendet" och dokumentets ansvariga
// tekniker. Avtal utan kund visar KorOmSignering. "Inget ärende" kräver anledning
// och stänger direkt.
// Steg 2: CreateCaseModal förifylld (typ, kund/enhet, kontakt, adress,
// beskrivning, tjänst, ansvarig tekniker som enda ibockade för
// bokningsassistenten). När ärendet sparats kör bokaInService.slutforBokaIn:
// raderna flyttas, ursprungsärendet stängs och dokumentet markeras bokat.
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { Technician } from '../../../types/database'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import { Icon, type IconName } from '../../icons/Icon'
import CreateCaseModal from '../../admin/coordinator/CreateCaseModal'
import KorOmSignering from './KorOmSignering'
import {
  forberedBokaIn,
  formularFalt,
  slutforBokaIn,
  slutforIngetArende,
  type BokaInArendetyp,
  type BokaInKalla,
  type BokaInResultat,
  type BokaInUnderlag,
  type OffertRad,
  type RotRut,
} from '../../../services/bokaInService'

export type { BokaInKalla } from '../../../services/bokaInService'

interface BokaInProps {
  kalla: BokaInKalla
  oppen: boolean
  onStang: () => void
  onKlar: (nyttArendeId: string | null) => void
  tekniker?: Technician[]
}

const TYPER: Array<{ typ: BokaInArendetyp; namn: string; text: string; ikon: IconName }> = [
  { typ: 'private', namn: 'Engångsjobb privat', text: 'Privatperson, ROT eller RUT', ikon: 'arende.privat' },
  { typ: 'business', namn: 'Engångsjobb företag', text: 'Faktureras separat', ikon: 'allman.foretag' },
  { typ: 'contract', namn: 'Extrabesök', text: 'Avtalskund, utöver avtalet', ikon: 'bokning.extrabesok' },
  { typ: 'inspection', namn: 'Stationskontroll', text: 'Avtalskund, enstaka kontroll', ikon: 'arende.station' },
  { typ: 'establishment', namn: 'Etablering', text: 'Utplacering vid avtalsstart', ikon: 'bokning.etablering' },
  { typ: 'rondering', namn: 'Rondering', text: 'Regional kund', ikon: 'arende.rondering' },
  { typ: 'egenkontroll', namn: 'Egenkontroll', text: 'Regional kund, egenkontrollprogram', ikon: 'rapport.bedomning' },
  { typ: 'inget', namn: 'Inget ärende', text: 'Stänger utan nytt ärende, med anledning', ikon: 'allman.stang' },
]

const ANLEDNINGAR = ['Avropsavtal, bokas vid avrop', 'Kunden valde någon annan', 'Dubblett', 'Annat']

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

function valdaRaderStart(rader: OffertRad[]): Set<string> {
  // Förvalda: alla tjänster och fristående rader som inte är fakturerade
  return new Set(rader.filter(r => !r.last && !(r.foljerId && rader.some(x => x.id === r.foljerId))).map(r => r.id))
}

export default function BokaIn({ kalla, oppen, onStang, onKlar, tekniker }: BokaInProps) {
  const { user } = useAuth()
  const [underlag, setUnderlag] = useState<BokaInUnderlag | null>(null)
  const [laddar, setLaddar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [typ, setTyp] = useState<BokaInArendetyp>('private')
  const [rotRut, setRotRut] = useState<RotRut | null>(null)
  const [valda, setValda] = useState<Set<string>>(new Set())
  const [anledning, setAnledning] = useState(ANLEDNINGAR[0])
  const [anledningText, setAnledningText] = useState('')
  const [steg, setSteg] = useState<'forsteg' | 'modal'>('forsteg')
  const [sparar, setSparar] = useState(false)
  const [tekniklista, setTekniklista] = useState<Technician[]>(tekniker ?? [])
  const [modalFalt, setModalFalt] = useState<Record<string, unknown> | null>(null)
  // CreateCaseModal anropar onSuccess/onClose ur sin submit-closure: läs resultatet ur en ref
  const resultatRef = useRef<BokaInResultat | null>(null)
  const satt = (r: BokaInResultat | null) => { resultatRef.current = r }
  const [laddaOm, setLaddaOm] = useState(0)

  const kallaNyckel = kalla.typ === 'dokument' ? `d:${kalla.offerId}` : `a:${kalla.tabell}:${kalla.caseId}`

  useEffect(() => {
    if (!oppen) return
    let avbruten = false
    setLaddar(true)
    setFel(null)
    forberedBokaIn(kalla)
      .then(u => {
        if (avbruten) return
        setUnderlag(u)
        setTyp(u.forvaldTyp)
        setRotRut(u.rotRut)
        setValda(valdaRaderStart(u.rader))
        setAnledning(u.forvaldTyp === 'inget' ? ANLEDNINGAR[0] : ANLEDNINGAR[3])
      })
      .catch(err => { if (!avbruten) setFel(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!avbruten) setLaddar(false) })
    return () => { avbruten = true }
    // kalla jämförs via nyckeln: ett nytt objekt med samma innehåll laddar inte om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppen, kallaNyckel, laddaOm])

  useEffect(() => {
    if (!oppen) { setSteg('forsteg'); satt(null); setModalFalt(null) }
  }, [oppen])

  useEffect(() => {
    if (tekniker && tekniker.length > 0) { setTekniklista(tekniker); return }
    if (!oppen || tekniklista.length > 0) return
    supabase.from('technicians').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setTekniklista((data ?? []) as Technician[]))
  }, [oppen, tekniker, tekniklista.length])

  const dok = underlag?.dokument ?? null
  const ursprung = underlag?.ursprung ?? null
  const kundnamn = dok?.kundnamn ?? dok?.kontaktperson ?? ursprung?.titel ?? 'Kund'

  // Rader grupperade: tjänst med sina följande kostnader och arbetsrader
  const grupper = useMemo(() => {
    const rader = underlag?.rader ?? []
    const harForalder = (r: OffertRad) => !!r.foljerId && rader.some(x => x.id === r.foljerId)
    return rader.filter(r => !harForalder(r)).map(r => ({ rad: r, foljer: rader.filter(x => x.foljerId === r.id) }))
  }, [underlag])

  const sammanfattning = useMemo(() => {
    const foljer: string[] = []
    const stannar: string[] = []
    const last: string[] = []
    for (const g of grupper) {
      const summa = g.rad.belopp + g.foljer.filter(f => f.itemType === 'service' && !f.arbetsrad).reduce((s, f) => s + f.belopp, 0)
      const text = `${g.rad.namn} ${kr(summa)}`
      if (g.rad.last) last.push(g.rad.namn)
      else if (valda.has(g.rad.id)) foljer.push(text)
      else stannar.push(text)
    }
    return { foljer, stannar, last }
  }, [grupper, valda])

  const etableringUtanKund = typ === 'establishment' && !!underlag?.kundSaknas
  const anledningKlar = anledning !== 'Annat' || anledningText.trim().length > 0
  const anledningFull = anledning === 'Annat' ? anledningText.trim() : (anledningText.trim() ? `${anledning}. ${anledningText.trim()}` : anledning)

  const vadHander = (() => {
    if (!underlag) return ''
    const ur = ursprung?.caseNumber ? `Ursprungsärendet ${ursprung.caseNumber}` : 'Ursprungsärendet'
    if (typ === 'inget') return `${ursprung ? `${ur} stängs utan nytt ärende. ` : ''}Dokumentet lämnar Att boka in.`
    if (dok?.typ === 'contract') return `${ursprung ? `${ur} stängs. ` : ''}Premien faktureras via avtalets fakturaplan.`
    if (dok?.typ === 'offer') {
      const delar = [ursprung ? `${ur} stängs.` : 'Inget ursprungsärende att stänga.']
      if (sammanfattning.foljer.length > 0) delar.push('Offertens valda rader flyttas till det nya ärendet.')
      if (sammanfattning.stannar.length > 0 && ursprung) delar.push(`${sammanfattning.stannar.length === 1 ? 'En rad stannar' : `${sammanfattning.stannar.length} rader stannar`} och faktureras på ${ursprung.caseNumber ?? 'ursprungsärendet'}.`)
      return delar.join(' ')
    }
    return ursprung ? `${ur} stängs.` : ''
  })()

  const vaxlaRad = (id: string) => {
    setValda(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const fortsatt = async () => {
    if (!underlag) return
    if (typ === 'inget') {
      if (!anledningKlar) return toast.error('Skriv en anledning')
      setSparar(true)
      try {
        const r = await slutforIngetArende({ underlag, anledning: anledningFull, userId: user?.id ?? null })
        r.varningar.forEach(v => toast(v, { duration: 8000 }))
        toast.success(r.ursprungStangt ? 'Ursprungsärendet stängt, dokumentet hanterat' : 'Dokumentet hanterat')
        onKlar(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Kunde inte stänga')
      } finally {
        setSparar(false)
      }
      return
    }
    const falt = formularFalt({ ...underlag, rotRut: typ === 'private' ? rotRut : null }, typ)
    setModalFalt(falt)
    satt(null)
    setSteg('modal')
  }

  const efterSkapat = async (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    if (!underlag) return
    try {
      const r = await slutforBokaIn({ underlag, nyttArendeId: caseId, caseType, valdaRadIds: valda, userId: user?.id ?? null })
      satt(r)
      const delar = [`${r.nyttArendeNummer ?? 'Ärendet'} bokat`]
      if (r.flyttadeRader > 0) delar.push(`${r.flyttadeRader} rad${r.flyttadeRader > 1 ? 'er' : ''} flyttade`)
      if (r.ursprungStangt) delar.push(`${ursprung?.caseNumber ?? 'ursprungsärendet'} stängt`)
      toast.success(delar.join(', '))
      r.varningar.forEach(v => toast(v, { duration: 10000 }))
    } catch (err) {
      toast.error(`Ärendet är bokat men efterstegen kunde inte köras: ${err instanceof Error ? err.message : String(err)}`, { duration: 10000 })
      satt({ nyttArendeId: caseId, nyttArendeNummer: null, nyTabell: null, flyttadeRader: 0, makuleradeRader: 0, ursprungStangt: false, faktura: 'fel', varningar: [] })
    }
  }

  if (!oppen) return null

  // ─── Steg 2: CreateCaseModal ───
  if (steg === 'modal' && underlag && modalFalt && typ !== 'inget') {
    return (
      <CreateCaseModal
        isOpen
        onClose={() => {
          if (resultatRef.current) return
          setSteg('forsteg')
        }}
        onSuccess={() => onKlar(resultatRef.current?.nyttArendeId ?? null)}
        technicians={tekniklista}
        initialCaseType={typ}
        initialFormData={modalFalt}
        initialContractCustomerId={typ === 'private' || typ === 'business' ? null : underlag.kundId}
        initialSiteId={typ === 'private' || typ === 'business' ? null : underlag.enhetId}
        initialTechnicianIds={underlag.ansvarigTeknikerId ? [underlag.ansvarigTeknikerId] : null}
        initialServiceId={typ === 'private' || typ === 'business' ? underlag.tjanstId : null}
        onCaseCreated={efterSkapat}
        titleOverride={`Boka in ${kundnamn}`}
        bookingNotice={
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-xs text-slate-300 space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-white">
              <Icon name="arendelista.boka" className="w-3.5 h-3.5 text-[#20c58f]" /> Boka in från {dok ? `${dok.typ === 'contract' ? 'avtal' : 'offert'} ${dok.nummer}` : ursprung?.caseNumber}
            </p>
            <p>{vadHander}</p>
            {sammanfattning.foljer.length > 0 && (
              <p className="text-slate-400">Raderna läggs på ärendet när det sparas. Lägg inte in dem igen under Tjänster och fakturarader.</p>
            )}
            {underlag.ansvarigTeknikerNamn && (
              <p className="text-slate-400">{underlag.ansvarigTeknikerNamn} är förvald och den enda som är ibockad när tid söks.</p>
            )}
          </div>
        }
      />
    )
  }

  // ─── Steg 1: förstegsdialogen ───
  const footer = (
    <div className="px-4 py-2.5 border-t border-slate-700/50 space-y-1.5">
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onStang} disabled={sparar}>Avbryt</Button>
        <Button
          type="button"
          onClick={fortsatt}
          loading={sparar}
          disabled={!underlag || sparar || etableringUtanKund || (typ === 'inget' && !anledningKlar)}
        >
          {typ === 'inget' ? 'Stäng utan nytt ärende' : 'Fortsätt till tid och tekniker'}
        </Button>
      </div>
      {vadHander && <p className="text-[11px] text-slate-400 sm:text-right">{vadHander}</p>}
      {etableringUtanKund && <p className="text-[11px] text-amber-400 sm:text-right">Etableringen behöver kunden. Kör signeringen igen först.</p>}
    </div>
  )

  return (
    <Modal
      isOpen={oppen}
      onClose={onStang}
      title={`Boka in ${kundnamn}`}
      subtitle={dok
        ? `${dok.typ === 'contract' ? 'Avtal' : 'Offert'} ${dok.nummer}${dok.belopp != null ? `, ${kr(dok.belopp)}${dok.typ === 'contract' ? ' per år exkl. moms' : ''}` : ''}${dok.signerad ? `, signerat ${dok.signerad.slice(0, 10)}` : ''}${dok.saljare ? `, säljare ${dok.saljare}` : ''}`
        : ursprung?.caseNumber ?? undefined}
      size="xl"
      footer={footer}
      preventClose={sparar}
      usePortal
      mobilHelskarm
    >
      <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
        {laddar && <p className="text-sm text-slate-400 py-4 text-center">Hämtar underlaget...</p>}
        {fel && <p className="text-sm text-red-400">{fel}</p>}

        {underlag && !laddar && (
          <>
            {/* Ärendetyp */}
            <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                <Icon name="arende.arende" className="w-4 h-4 text-[#20c58f]" /> Ärendetyp
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TYPER.map(t => (
                  <button
                    key={t.typ}
                    type="button"
                    onClick={() => setTyp(t.typ)}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                      typ === t.typ ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <Icon name={t.ikon} className={`w-4 h-4 mt-0.5 shrink-0 ${typ === t.typ ? 'text-[#20c58f]' : 'text-slate-400'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">{t.namn}</span>
                      <span className="block text-xs text-slate-400">{t.text}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Förvald: {underlag.forvalOrsak}{typ !== underlag.forvaldTyp ? ' Du har bytt typ.' : ' Byt om det gäller något annat.'}
              </p>

              {typ === 'private' && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">Skattereduktion</p>
                  <div className="flex gap-3">
                    {([['ROT', 'ROT'], ['RUT', 'RUT'], [null, 'Inget avdrag']] as Array<[RotRut | null, string]>).map(([v, namn]) => (
                      <label key={namn} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                        <input type="radio" name="bokain-rotrut" checked={rotRut === v} onChange={() => setRotRut(v)} className="text-[#20c58f] focus:ring-[#20c58f]" />
                        {namn}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {typ === 'inget' && (
                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-400 mb-1">Anledning</span>
                    <select
                      value={anledning}
                      onChange={e => setAnledning(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                    >
                      {ANLEDNINGAR.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                  <textarea
                    value={anledningText}
                    onChange={e => setAnledningText(e.target.value)}
                    rows={2}
                    placeholder={anledning === 'Annat' ? 'Skriv anledningen' : 'Tillägg (valfritt)'}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                </div>
              )}
            </section>

            {/* Underlaget från signeringen */}
            <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                <Icon name="kund.avtal" className="w-4 h-4 text-[#20c58f]" /> Underlaget från signeringen
              </h3>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-slate-400">Kund</dt>
                <dd className="text-slate-200">
                  {underlag.kundSaknas ? (
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Kunden lades inte upp automatiskt
                    </span>
                  ) : underlag.kundId ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" /> Kopplad{dok?.kundnamn ? `, ${dok.kundnamn}` : ''}{underlag.enhetId ? ' (enhet, välj enhet i nästa steg)' : ''}
                    </span>
                  ) : ursprung ? (
                    <span>Från ursprungsärendet {ursprung.caseNumber ?? ''}</span>
                  ) : (
                    <span className="text-slate-400">Ingen kund kopplad, väljs i nästa steg</span>
                  )}
                </dd>
                {dok?.adress && (<><dt className="text-slate-400">Adress</dt><dd className="text-slate-200">{dok.adress}</dd></>)}
                {(dok?.kontaktperson || dok?.kontaktTelefon || dok?.kontaktEpost) && (
                  <><dt className="text-slate-400">Kontakt</dt><dd className="text-slate-200">{[dok?.kontaktperson, dok?.kontaktTelefon, dok?.kontaktEpost].filter(Boolean).join(', ')}</dd></>
                )}
                {underlag.stationer.length > 0 && (
                  <><dt className="text-slate-400">Omfattning</dt><dd className="text-slate-200">{underlag.stationer.map(s => `${s.antal} ${s.ord}`).join(', ')}</dd></>
                )}
                {dok?.startdatum && (<><dt className="text-slate-400">Startdatum</dt><dd className="text-slate-200">{dok.startdatum}</dd></>)}
                {dok?.belopp != null && (
                  <><dt className="text-slate-400">{dok.typ === 'contract' ? 'Premie' : 'Pris'}</dt><dd className="text-slate-200">{kr(dok.belopp)}{dok.typ === 'contract' ? ' per år exkl. moms' : ''}</dd></>
                )}
                {typ === 'private' && rotRut && (
                  <><dt className="text-slate-400">{rotRut}</dt><dd className="text-slate-200">{underlag.rader.find(r => r.fastighetsbeteckning)?.fastighetsbeteckning ?? 'Fastighetsbeteckning saknas på raderna'}</dd></>
                )}
                <dt className="text-slate-400">Ansvarig tekniker</dt>
                <dd className="text-slate-200">{underlag.ansvarigTeknikerNamn ?? 'Okänd, välj i nästa steg'}</dd>
              </dl>
              <p className="text-[11px] text-slate-500 mt-2">Det nya ärendet förifylls med det här. Det går att ändra i nästa steg.</p>

              {underlag.kundSaknas && dok && (
                <div className="mt-3 p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                  <p className="text-xs font-medium text-white mb-2 flex items-center gap-1.5">
                    <Icon name="rapport.avvikelse" className="w-3.5 h-3.5 text-amber-400" /> Kör signeringen igen
                  </p>
                  <KorOmSignering contractId={dok.id} onKlar={(kundId) => { if (kundId) setLaddaOm(n => n + 1) }} />
                </div>
              )}
            </section>

            {/* Offertens rader */}
            {dok?.typ === 'offer' && grupper.length > 0 && typ !== 'inget' && (
              <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-1">
                  <Icon name="falt.pris" className="w-4 h-4 text-[#20c58f]" /> Offertens rader
                </h3>
                <p className="text-xs text-slate-400 mb-2">
                  {underlag.rader.some(r => r.kalla === 'dokument')
                    ? 'Raderna kommer från dokumentet och läggs på det nya ärendet.'
                    : 'Raderna följer med till nya ärendet. Bocka ur en tjänst som redan är utförd, då stannar den på ursprungsärendet och faktureras där. Kopplade kostnader och arbetsrader följer sin tjänst.'}
                </p>
                <div className="space-y-1">
                  {grupper.map(g => {
                    const med = !g.rad.last && valda.has(g.rad.id)
                    return (
                      <div key={g.rad.id} className="px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-lg">
                        <label className={`flex items-start gap-2 ${g.rad.last ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          {g.rad.last
                            ? <Icon name="allman.las" className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                            : <input type="checkbox" checked={med} onChange={() => vaxlaRad(g.rad.id)} className="mt-0.5 rounded text-[#20c58f] focus:ring-[#20c58f]" />}
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-white">{g.rad.namn}</span>
                            <span className="block text-[11px] text-slate-400">
                              {g.rad.itemType === 'service' ? 'Tjänst' : 'Intern kostnad'}, {g.rad.antal} st
                              {g.rad.rotRut ? `, ${g.rad.rotRut}` : ''}
                              {g.rad.last ? ', fakturerad, stannar' : !med ? ', stannar på ursprungsärendet och faktureras där' : ''}
                            </span>
                          </span>
                          <span className="text-sm text-slate-200 tabular-nums whitespace-nowrap">{kr(g.rad.belopp)}</span>
                        </label>
                        {g.foljer.map(f => (
                          <div key={f.id} className="flex items-start gap-2 pl-6 mt-1">
                            <span className="flex-1 min-w-0 text-xs text-slate-400">
                              {f.namn}
                              <span className="text-slate-500">
                                {' '}({f.arbetsrad ? `arbetsrad${f.rotRut ? `, ${f.rotRut}` : ''}` : 'kopplad kostnad'}, {med ? 'följer tjänsten' : 'stannar med tjänsten'})
                              </span>
                            </span>
                            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">{f.arbetsrad ? 'ingår' : kr(f.belopp)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
                {(sammanfattning.stannar.length > 0 || sammanfattning.last.length > 0) && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                    {sammanfattning.foljer.length > 0 && <p>Följer med: {sammanfattning.foljer.join(', ')}</p>}
                    {sammanfattning.stannar.length > 0 && <p>Stannar och faktureras på {ursprung?.caseNumber ?? 'ursprungsärendet'}: {sammanfattning.stannar.join(', ')}</p>}
                    {sammanfattning.last.length > 0 && <p>Redan fakturerade, stannar: {sammanfattning.last.join(', ')}</p>}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
