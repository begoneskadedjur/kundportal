// src/pages/admin/Leads.tsx
// Leads och tips (2026-10-24: samma formspråk som Tickets och Mina ärenden). Samma motor som sedan
// etapp 4: flikar och filter i adressen, ?id= öppnar en lead (Bakåt stänger), ?ny=1 öppnar Ny lead.
// Tangentbord på datorn: pil upp och ned flyttar, Enter öppnar, N ny lead, / söker.
// Flikar: Att göra (Försenade, I dag, Saknar nästa steg, Parkerade som vaknar i dag), Pågående,
// Nya tips (utan ägare eller nya med tipsare, koordinatorns fördelningskö), Alla och Statistik
// (inte för tekniker). Inga KPI-kort: läget står i en mening under rubriken, antal och
// pipelinevärde i sidfoten. Status som punkt och text, aldrig piller.
// Används av /admin, /koordinator, /saljare och /technician (leads). RLS avgör vad var och en ser:
// admin och koordinator allt, övriga det de äger, har tipsat om eller fått delat med sig.
// I nya teknikervyn står rubriken i sidhuvudet (NY_RUBRIKER: Leads och tips), så sidans h1 göms.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon, type IconName } from '../../components/icons/Icon'
import { useAuth } from '../../contexts/AuthContext'
import { useNyArbetsvy } from '../../hooks/useNyArbetsvy'
import { useNySidhuvud } from '../../components/technician/ny/layout/NySidhuvud'
import { LeadService } from '../../services/leadService'
import type { Lead } from '../../types/database'
import { KALLA_ETIKETT, LEAD_KALLOR, LEAD_STAGES, STAGE_ETIKETT, arOppen, type LeadPerson } from '../../types/leads'
import LeadsTabell, { type LeadsSektion } from '../../components/admin/leads/LeadsTabell'
import LeadModal from '../../components/admin/leads/LeadModal'
import NyLeadModal from '../../components/admin/leads/NyLeadModal'
import LeadsStatistik from '../../components/admin/leads/statistik/LeadsStatistik'
import {
  FILTER_NYCKLAR,
  GRUPP_ORDNING,
  IKONKNAPP,
  KNAPP_PRIMAR,
  KNAPP_SEKUNDAR,
  arNyttTips,
  filtrera,
  gruppFor,
  idagSv,
  kr,
  lasFilter,
  lasFlik,
  sorteraNasta,
  type FilterNyckel,
  type Flik,
  type Mig,
} from '../../components/admin/leads/leadLogik'

const SELECT =
  'h-11 w-full sm:w-auto px-3 rounded-xl border bg-slate-900 text-[15px] focus:outline-none focus:border-[#20c58f] focus-visible:ring-2 focus-visible:ring-[#20c58f]'
const select = (aktiv: boolean) => `${SELECT} ${aktiv ? 'border-[#20c58f]/60 text-white' : 'border-slate-600 text-slate-200'}`

export default function Leads() {
  const location = useLocation()
  const { profile, isAdmin, isKoordinator, isTechnician } = useAuth()
  const { aktiv: nyAktiv } = useNyArbetsvy()
  const [searchParams, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [personal, setPersonal] = useState<LeadPerson[]>([])
  const [delade, setDelade] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [visaNy, setVisaNy] = useState(false)
  const [visaFilter, setVisaFilter] = useState(false)
  const sokRef = useRef<HTMLInputElement>(null)

  const base = location.pathname.startsWith('/koordinator')
    ? '/koordinator'
    : location.pathname.startsWith('/saljare')
      ? '/saljare'
      : location.pathname.startsWith('/technician')
        ? '/technician'
        : '/admin'
  const minProfilId = profile?.id ?? null
  const extra = (profile?.extra_roles ?? []) as string[]
  const arLeadAdmin = isAdmin || isKoordinator || extra.includes('admin') || extra.includes('koordinator')
  const arTekniker = isTechnician && !arLeadAdmin
  const iTeknikervyn = base === '/technician'
  const valtId = searchParams.get('id')
  const flik = lasFlik(searchParams)
  const filter = useMemo(() => lasFilter(searchParams), [searchParams])
  const mig: Mig = useMemo(() => ({ profilId: minProfilId, delade }), [minProfilId, delade])

  const ladda = useCallback(async () => {
    try {
      const [rader, medl] = await Promise.all([LeadService.list(), LeadService.medlemmar()])
      setLeads(rader)
      setDelade(new Set(medl.filter((m) => m.profile_id === minProfilId).map((m) => m.lead_id)))
    } catch {
      toast.error('Leads kunde inte hämtas')
    } finally {
      setLoading(false)
    }
  }, [minProfilId])

  useEffect(() => {
    void ladda()
    LeadService.personal().then(setPersonal).catch(() => setPersonal([]))
    // Ingen realtid på leads: ladda om när fönstret får fokus igen
    const fokus = () => void ladda()
    window.addEventListener('focus', fokus)
    return () => window.removeEventListener('focus', fokus)
  }, [ladda])

  // En lead som öppnas via länk men inte finns i listan hämtas för sig
  useEffect(() => {
    if (!valtId || loading || leads.some((l) => l.id === valtId)) return
    LeadService.get(valtId)
      .then((rad) => {
        if (rad) setLeads((prev) => (prev.some((l) => l.id === rad.id) ? prev : [rad, ...prev]))
        else toast.error('Leaden finns inte eller är inte delad med dig')
      })
      .catch(() => undefined)
  }, [valtId, loading, leads])

  const namnFor = useCallback(
    (id: string | null) => {
      if (!id) return ''
      const p = personal.find((x) => x.id === id)
      return p ? p.namn : ''
    },
    [personal],
  )

  const andraParam = (nyckel: FilterNyckel | 'flik', varde: string) => {
    setSearchParams(
      (p) => {
        if (varde) p.set(nyckel, varde)
        else p.delete(nyckel)
        return p
      },
      { replace: nyckel === 'q' },
    )
  }
  const rensaFilter = () =>
    setSearchParams((p) => {
      for (const k of FILTER_NYCKLAR) p.delete(k)
      return p
    })
  const bytFlik = (f: Flik) => andraParam('flik', f === 'att-gora' ? '' : f)
  const oppna = (id: string) => setSearchParams((p) => { p.set('id', id); return p })
  const stang = () => setSearchParams((p) => { p.delete('id'); return p })

  // ?ny=1 (Skapa › Tips om ny kund, säljarens Ny Lead i sidomenyn) öppnar Ny lead
  useEffect(() => {
    if (searchParams.get('ny') !== '1') return
    setVisaNy(true)
    setSearchParams((p) => { p.delete('ny'); return p }, { replace: true })
  }, [searchParams, setSearchParams])

  // N öppnar Ny lead och / fokuserar sökningen (inte i fält och inte när en lead är öppen)
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || valtId || visaNy) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setVisaNy(true)
      } else if (e.key === '/' && flik !== 'statistik') {
        e.preventDefault()
        sokRef.current?.focus()
      }
    }
    document.addEventListener('keydown', tangent)
    return () => document.removeEventListener('keydown', tangent)
  }, [valtId, visaNy, flik])

  const idag = idagSv()
  const synliga = useMemo(() => filtrera(leads, filter, flik, mig), [leads, filter, flik, mig])

  const sektioner: LeadsSektion[] = useMemo(() => {
    if (flik === 'att-gora') {
      return GRUPP_ORDNING.map((g) => ({ grupp: g, rader: synliga.filter((l) => gruppFor(l, idag) === g).sort(sorteraNasta) }))
    }
    if (flik === 'alla') {
      return [{ grupp: null, rader: [...synliga].sort((a, b) => Number(arOppen(b.stage)) - Number(arOppen(a.stage)) || sorteraNasta(a, b)) }]
    }
    if (flik === 'nya-tips') return [{ grupp: null, rader: [...synliga].sort((a, b) => a.created_at.localeCompare(b.created_at)) }]
    return [{ grupp: null, rader: [...synliga].sort(sorteraNasta) }]
  }, [flik, synliga, idag])

  const visasAntal = sektioner.reduce((s, x) => s + x.rader.length, 0)

  // Antal i flikarna räknas med ägarfiltret men utan sök, källa och status
  const agarUrval = useMemo(
    () => filtrera(leads, { q: '', agare: filter.agare, kalla: '', status: '' }, 'alla', mig),
    [leads, filter.agare, mig],
  )
  const attGoraAntal = useMemo(() => agarUrval.filter((l) => gruppFor(l, idag) !== null).length, [agarUrval, idag])
  const forsenadeAntal = useMemo(() => agarUrval.filter((l) => gruppFor(l, idag) === 'forsenade').length, [agarUrval, idag])
  const nyaTipsAntal = useMemo(() => leads.filter(arNyttTips).length, [leads])
  const oppnaIUrval = agarUrval.filter((l) => arOppen(l.stage))
  const pipeline = oppnaIUrval.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)

  const vald = useMemo(() => leads.find((l) => l.id === valtId) ?? null, [leads, valtId])

  const ta = async (id: string) => {
    if (!minProfilId) return
    try {
      const ny = await LeadService.update(id, { owner_profile_id: minProfilId })
      setLeads((prev) => prev.map((l) => (l.id === ny.id ? ny : l)))
      toast.success('Du är ägare till leaden')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Det gick inte att ta leaden')
    }
  }

  // Läget i en mening (ingen KPI-rad). Samma mening i nya vyns sidhuvud.
  const sammanfattning = attGoraAntal === 0
    ? `Inget att göra just nu, ${oppnaIUrval.length} öppna`
    : `${attGoraAntal} att göra${forsenadeAntal ? `, varav ${forsenadeAntal} ${forsenadeAntal === 1 ? 'försenad' : 'försenade'}` : ''}, ${oppnaIUrval.length} öppna`
  useNySidhuvud({ underrubrik: loading && leads.length === 0 ? undefined : sammanfattning })

  const harFilter = !!(filter.q || filter.kalla || filter.status || filter.agare !== 'mina')
  const antalFilter = [filter.kalla, filter.status, filter.agare !== 'mina' && flik !== 'nya-tips'].filter(Boolean).length
  const [tomRubrik, tomText] = harFilter
    ? ['Inga träffar', 'Inga leads matchar sökningen eller filtret.']
    : flik === 'att-gora'
      ? ['Inget att göra just nu', 'Alla leads har ett nästa steg framåt i tiden.']
      : flik === 'nya-tips'
        ? ['Inga nya tips', 'Inga nya tips att fördela.']
        : ['Inga leads än', arTekniker ? 'Tryck Nytt tips när en kund eller granne behöver mer hjälp.' : 'Tryck Ny lead för att lägga till en. På datorn kan du också trycka N.']

  const flikar: { id: Flik; label: string; ikon: IconName; antal?: number; varna?: boolean }[] = [
    { id: 'att-gora', label: 'Att göra', ikon: 'lead.att-gora', antal: attGoraAntal, varna: true },
    { id: 'pagaende', label: 'Pågående', ikon: 'lead.pagaende' },
    { id: 'nya-tips', label: 'Nya tips', ikon: 'lead.tips', antal: nyaTipsAntal, varna: arLeadAdmin },
    { id: 'alla', label: 'Alla', ikon: 'allman.lista' },
    ...(arTekniker ? [] : [{ id: 'statistik' as Flik, label: 'Statistik', ikon: 'allman.statistik' as IconName }]),
  ]

  const agarVal = [
    { value: 'mina', label: 'Mina' },
    { value: 'alla', label: arLeadAdmin ? 'Alla ägare' : 'Alla jag ser' },
    ...personal.filter((p) => p.aktiv).map((p) => ({ value: p.id, label: p.namn })),
  ]

  const statusTom = flik === 'alla' ? 'Alla statusar' : 'Alla öppna'
  const nyText = arTekniker ? 'Nytt tips' : 'Ny lead'
  const rubrik = iTeknikervyn ? 'Leads och tips' : 'Leads (B2B)'
  const beskrivning = arTekniker
    ? 'Det du har tipsat om, äger eller fått delat med dig.'
    : 'Företag och föreningar som kan bli avtalskunder.'

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 flex flex-col gap-5 pb-28 lg:pb-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          {!nyAktiv && (
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold text-white leading-tight">{rubrik}</h1>
              <button
                type="button"
                onClick={() => { setLoading(true); void ladda() }}
                className={IKONKNAPP}
                aria-label="Uppdatera"
                title="Uppdatera"
              >
                <Icon name="provision.uppdatera" size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
          <p className="mt-1 text-[15px] text-slate-300">{beskrivning}</p>
          {!loading && flik !== 'statistik' && (
            <p className="mt-0.5 text-[15px] text-slate-400">
              <strong className={`font-semibold ${forsenadeAntal > 0 ? 'text-red-400' : attGoraAntal > 0 ? 'text-amber-500' : 'text-slate-200'}`}>
                {attGoraAntal === 0 ? 'Inget att göra just nu' : `${attGoraAntal} att göra${forsenadeAntal ? `, varav ${forsenadeAntal} ${forsenadeAntal === 1 ? 'försenad' : 'försenade'}` : ''}`}
              </strong>
              , {oppnaIUrval.length} öppna{pipeline > 0 && <> för <span className="font-mono">{kr(pipeline)}</span> i årspremie</>}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setVisaNy(true)} className={`${KNAPP_PRIMAR} hidden lg:inline-flex`} title={`${nyText} (N)`}>
          <Icon name={arTekniker ? 'lead.tips' : 'allman.plus'} size={20} />
          {nyText}
        </button>
      </header>

      <div role="tablist" aria-label="Visa" className="flex gap-4 sm:gap-6 border-b border-slate-700 overflow-x-auto">
        {flikar.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={flik === f.id}
            onClick={() => bytFlik(f.id)}
            className={`min-h-[44px] -mb-px border-b-2 inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              flik === f.id ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon name={f.ikon} size={20} className="hidden sm:block" />
            {f.label}
            {f.antal ? (
              <span className={`font-medium ${flik === f.id ? 'text-[#20c58f]' : f.varna ? 'text-amber-500' : 'text-slate-400'}`}>{f.antal}</span>
            ) : null}
          </button>
        ))}
      </div>

      {flik === 'statistik' ? (
        <LeadsStatistik personal={personal} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="flex-1 min-w-0 h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-900 text-slate-400 focus-within:border-[#20c58f]">
                <Icon name="allman.sok" size={20} />
                <span className="sr-only">Sök leads</span>
                <input
                  ref={sokRef}
                  type="search"
                  value={filter.q}
                  onChange={(e) => andraParam('q', e.target.value)}
                  placeholder="Sök företag, kontakt, org.nr eller telefon"
                  className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
                />
                <kbd aria-hidden="true" title="Tryck / för att söka" className="hidden lg:inline font-mono text-sm text-slate-500 border border-slate-600 rounded-md px-1.5">/</kbd>
              </label>
              <button
                type="button"
                onClick={() => setVisaFilter((v) => !v)}
                aria-expanded={visaFilter}
                aria-controls="leads-filter"
                className={`${KNAPP_SEKUNDAR} sm:hidden px-3 ${antalFilter ? 'border-[#20c58f]/60' : ''}`}
              >
                <Icon name="allman.filter" size={20} />
                Filter{antalFilter ? <span className="text-[#20c58f]">{antalFilter}</span> : null}
              </button>
            </div>

            <fieldset id="leads-filter" className={`${visaFilter ? 'grid' : 'hidden'} sm:flex grid-cols-1 sm:flex-wrap sm:items-end gap-3`}>
              <legend className="sr-only">Filter</legend>
              {flik !== 'nya-tips' && (
                <label className="flex flex-col gap-1 text-sm text-slate-400">
                  Ägare
                  <select className={select(filter.agare !== 'mina')} value={filter.agare} onChange={(e) => andraParam('agare', e.target.value === 'mina' ? '' : e.target.value)}>
                    {agarVal.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm text-slate-400">
                Källa
                <select className={select(!!filter.kalla)} value={filter.kalla} onChange={(e) => andraParam('kalla', e.target.value)}>
                  <option value="">Alla källor</option>
                  {LEAD_KALLOR.map((k) => <option key={k} value={k}>{KALLA_ETIKETT[k]}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-400">
                Status
                <select className={select(!!filter.status)} value={filter.status} onChange={(e) => andraParam('status', e.target.value)}>
                  <option value="">{statusTom}</option>
                  {flik === 'alla' && <option value="oppna">Alla öppna</option>}
                  {LEAD_STAGES.filter((s) => flik === 'alla' || arOppen(s)).map((s) => <option key={s} value={s}>{STAGE_ETIKETT[s]}</option>)}
                </select>
              </label>
            </fieldset>

            {harFilter && (
              <div className="flex flex-wrap items-center gap-x-1 gap-y-0 text-sm">
                <span className="text-slate-400 mr-1">Filter:</span>
                {filter.q && <AktivtFilter text={`Sök: ${filter.q}`} onTa={() => andraParam('q', '')} />}
                {filter.agare !== 'mina' && flik !== 'nya-tips' && (
                  <AktivtFilter text={`Ägare: ${filter.agare === 'alla' ? 'alla' : namnFor(filter.agare) || 'okänd'}`} onTa={() => andraParam('agare', '')} />
                )}
                {filter.kalla && <AktivtFilter text={`Källa: ${KALLA_ETIKETT[filter.kalla]}`} onTa={() => andraParam('kalla', '')} />}
                {filter.status && <AktivtFilter text={`Status: ${filter.status === 'oppna' ? 'alla öppna' : STAGE_ETIKETT[filter.status]}`} onTa={() => andraParam('status', '')} />}
                <button type="button" onClick={rensaFilter} className="min-h-[44px] px-2 font-medium text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-lg">
                  Rensa
                </button>
              </div>
            )}
          </div>

          <LeadsTabell
            sektioner={sektioner}
            laddar={loading}
            namnFor={namnFor}
            kanTa={arLeadAdmin}
            onOppna={oppna}
            onTa={(id) => void ta(id)}
            tomRubrik={tomRubrik}
            tomText={tomText}
            harFilter={harFilter}
            onRensaFilter={rensaFilter}
          />

          {!(loading && leads.length === 0) && visasAntal > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
              <span>{visasAntal === 1 ? '1 lead visas' : `${visasAntal} leads visas`}</span>
              <span className="hidden lg:inline">Pil upp och ned flyttar, Enter öppnar, N {arTekniker ? 'nytt tips' : 'ny lead'}, / söker</span>
            </div>
          )}
        </>
      )}

      {/* Fast knapp i telefonen, ovanför nya vyns bottenmeny */}
      <div className="lg:hidden fixed bottom-[calc(var(--bottenlist,0px)+1rem)] inset-x-4 z-30">
        <button type="button" onClick={() => setVisaNy(true)} className={`${KNAPP_PRIMAR} w-full shadow-lg`}>
          <Icon name={arTekniker ? 'lead.tips' : 'allman.plus'} size={20} />
          {arTekniker ? 'Tipsa om en ny kund' : 'Ny lead'}
        </button>
      </div>

      <LeadModal
        lead={vald}
        personal={personal}
        namnFor={namnFor}
        minProfilId={minProfilId}
        arLeadAdmin={arLeadAdmin}
        basePath={base}
        onClose={stang}
        onChanged={(ny) => setLeads((prev) => (prev.some((l) => l.id === ny.id) ? prev.map((l) => (l.id === ny.id ? ny : l)) : [ny, ...prev]))}
      />

      <NyLeadModal
        isOpen={visaNy}
        onClose={() => setVisaNy(false)}
        personal={personal}
        minProfilId={minProfilId}
        arLeadAdmin={arLeadAdmin}
        arTekniker={arTekniker}
        onSkapad={(lead) => {
          setVisaNy(false)
          setLeads((prev) => [lead, ...prev])
          oppna(lead.id)
        }}
        onOppnaBefintlig={(id) => {
          setVisaNy(false)
          oppna(id)
        }}
      />
    </div>
  )
}

function AktivtFilter({ text, onTa }: { text: string; onTa: () => void }) {
  return (
    <button
      type="button"
      onClick={onTa}
      className="min-h-[44px] inline-flex items-center gap-1.5 px-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      aria-label={`Ta bort filtret ${text}`}
    >
      {text}
      <Icon name="allman.stang" size={16} className="text-slate-400" />
    </button>
  )
}
