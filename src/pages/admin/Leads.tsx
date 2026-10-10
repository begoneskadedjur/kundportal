// src/pages/admin/Leads.tsx
// Leads (B2B) sedan etapp 4 (2026-10-10). Samma motor som Leads (Webb): flikar och filter i adressen,
// ?id= öppnar en lead (Bakåt stänger), tangentbord (pil upp/ned, Enter, N för ny lead).
// Flikar: Att göra (Försenade, I dag, Saknar nästa steg, Parkerade som vaknar i dag), Pågående, Nya tips
// (utan ägare eller nya med tipsare, koordinatorns fördelningskö) och Alla. Ingen KPI-rad: antal och
// pipelinevärde står i sidfoten. Status som punkt och text, aldrig piller.
// Används av /admin, /koordinator, /saljare och /technician (leads). RLS avgör vad var och en ser:
// admin och koordinator allt, övriga det de äger, har tipsat om eller fått delat med sig.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, RefreshCw, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import { Icon } from '../../components/icons/Icon'
import { SearchGlass } from '../../components/shared/search/SearchIcons'
import { useAuth } from '../../contexts/AuthContext'
import { LeadService } from '../../services/leadService'
import type { Lead } from '../../types/database'
import { KALLA_ETIKETT, LEAD_KALLOR, LEAD_STAGES, STAGE_ETIKETT, arOppen, type LeadPerson } from '../../types/leads'
import LeadsTabell, { type LeadsSektion } from '../../components/admin/leads/LeadsTabell'
import LeadModal from '../../components/admin/leads/LeadModal'
import NyLeadModal from '../../components/admin/leads/NyLeadModal'
import {
  FILTER_NYCKLAR,
  GRUPP_ORDNING,
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

const FALT_BAS = 'h-9 px-3 bg-slate-800 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'
const falt = (aktiv: boolean) => `${FALT_BAS} ${aktiv ? 'border-[#20c58f]/60 text-white' : 'border-slate-700 text-slate-300'}`

export default function Leads() {
  const location = useLocation()
  const { profile, isAdmin, isKoordinator, isTechnician } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [personal, setPersonal] = useState<LeadPerson[]>([])
  const [delade, setDelade] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [visaNy, setVisaNy] = useState(false)

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

  // ?ny=1 (till exempel säljarens knapp Ny Lead i sidomenyn) öppnar Ny lead
  useEffect(() => {
    if (searchParams.get('ny') !== '1') return
    setVisaNy(true)
    setSearchParams((p) => { p.delete('ny'); return p }, { replace: true })
  }, [searchParams, setSearchParams])

  // N öppnar Ny lead (inte i fält och inte när en lead är öppen)
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.ctrlKey || e.metaKey || e.altKey || valtId || visaNy) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      setVisaNy(true)
    }
    document.addEventListener('keydown', tangent)
    return () => document.removeEventListener('keydown', tangent)
  }, [valtId, visaNy])

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

  const harFilter = !!(filter.q || filter.kalla || filter.status || filter.agare !== 'mina')
  const tomText = harFilter
    ? 'Inga leads matchar filtret.'
    : flik === 'att-gora'
      ? 'Inget att göra just nu. Alla leads har ett nästa steg framåt i tiden.'
      : flik === 'nya-tips'
        ? 'Inga nya tips att fördela.'
        : 'Inga leads än. Tryck N eller Ny lead för att lägga till.'

  const flikar: { id: Flik; label: string; antal?: number; varna?: boolean }[] = [
    { id: 'att-gora', label: 'Att göra', antal: attGoraAntal, varna: true },
    { id: 'pagaende', label: 'Pågående' },
    { id: 'nya-tips', label: 'Nya tips', antal: nyaTipsAntal, varna: arLeadAdmin },
    { id: 'alla', label: 'Alla' },
  ]

  const agarVal = [
    { value: 'mina', label: 'Mina' },
    { value: 'alla', label: arLeadAdmin ? 'Alla ägare' : 'Alla jag ser' },
    ...personal.filter((p) => p.aktiv).map((p) => ({ value: p.id, label: p.namn })),
  ]

  const statusTom = flik === 'alla' ? 'Alla statusar' : 'Alla öppna'

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 pb-24 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{arTekniker ? 'Mina leads och tips' : 'Leads (B2B)'}</h1>
            <button
              type="button"
              onClick={() => { setLoading(true); void ladda() }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              aria-label="Uppdatera"
              title="Uppdatera"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {arTekniker ? 'Det du har tipsat om, äger eller fått delat med dig.' : 'Företag och föreningar som kan bli avtalskunder.'}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          {base !== '/technician' && (
            <Link
              to={`${base}/leadsstatistik`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="allman.statistik" size={16} /> Statistik
            </Link>
          )}
          <Button variant="primary" size="sm" onClick={() => setVisaNy(true)} title="Ny lead (N)">
            <Plus className="w-4 h-4 mr-1.5" /> {arTekniker ? 'Nytt tips' : 'Ny lead'}
          </Button>
        </div>
      </div>

      <div className="flex border-b border-slate-700/50 overflow-x-auto" role="tablist">
        {flikar.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={flik === f.id}
            onClick={() => bytFlik(f.id)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              flik === f.id ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
            {f.antal ? (
              <span className={`ml-1.5 font-mono text-xs ${flik === f.id ? 'text-[#20c58f]' : f.varna ? 'text-amber-400' : 'text-slate-500'}`}>{f.antal}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Filterrad */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <SearchGlass className="w-4 h-4" />
            </span>
            <input
              type="search"
              value={filter.q}
              onChange={(e) => andraParam('q', e.target.value)}
              placeholder="Sök företag, kontakt, org.nr eller telefon"
              aria-label="Sök leads"
              className={`${falt(!!filter.q)} w-full pl-9 placeholder:text-slate-500`}
            />
          </div>
          {flik !== 'nya-tips' && (
            <select aria-label="Ägare" className={falt(filter.agare !== 'mina')} value={filter.agare} onChange={(e) => andraParam('agare', e.target.value === 'mina' ? '' : e.target.value)}>
              {agarVal.map((o) => <option key={o.value} value={o.value}>{o.value === 'mina' || o.value === 'alla' ? `Ägare: ${o.label}` : o.label}</option>)}
            </select>
          )}
          <select aria-label="Källa" className={falt(!!filter.kalla)} value={filter.kalla} onChange={(e) => andraParam('kalla', e.target.value)}>
            <option value="">Alla källor</option>
            {LEAD_KALLOR.map((k) => <option key={k} value={k}>{KALLA_ETIKETT[k]}</option>)}
          </select>
          <select aria-label="Status" className={falt(!!filter.status)} value={filter.status} onChange={(e) => andraParam('status', e.target.value)}>
            <option value="">{statusTom}</option>
            {flik === 'alla' && <option value="oppna">Alla öppna</option>}
            {LEAD_STAGES.filter((s) => flik === 'alla' || arOppen(s)).map((s) => <option key={s} value={s}>{STAGE_ETIKETT[s]}</option>)}
          </select>
        </div>
        {harFilter && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-500">Filter:</span>
            {filter.q && <AktivtFilter text={`Sök: ${filter.q}`} onTa={() => andraParam('q', '')} />}
            {filter.agare !== 'mina' && flik !== 'nya-tips' && (
              <AktivtFilter text={`Ägare: ${filter.agare === 'alla' ? 'alla' : namnFor(filter.agare) || 'okänd'}`} onTa={() => andraParam('agare', '')} />
            )}
            {filter.kalla && <AktivtFilter text={`Källa: ${KALLA_ETIKETT[filter.kalla]}`} onTa={() => andraParam('kalla', '')} />}
            {filter.status && <AktivtFilter text={`Status: ${filter.status === 'oppna' ? 'alla öppna' : STAGE_ETIKETT[filter.status]}`} onTa={() => andraParam('status', '')} />}
            <button type="button" onClick={rensaFilter} className="text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded">
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
        tomText={tomText}
        harFilter={harFilter}
        onRensaFilter={rensaFilter}
      />

      {!(loading && leads.length === 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {visasAntal === 1 ? '1 lead visas' : `${visasAntal} leads visas`}
            {' · '}
            {oppnaIUrval.length} öppna
            {pipeline > 0 && <> · <span className="font-mono text-slate-400">{kr(pipeline)}</span> i pipeline</>}
          </span>
          <span className="hidden md:inline">Pil upp och ned flyttar, Enter öppnar, N ny lead</span>
        </div>
      )}

      {/* Fast knapp på mobil */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-30">
        <Button variant="primary" fullWidth onClick={() => setVisaNy(true)} className="min-h-[44px] shadow-lg">
          <Plus className="w-4 h-4 mr-1.5" /> {arTekniker ? 'Tipsa om en lead' : 'Ny lead'}
        </Button>
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
    <span className="flex items-center gap-1 text-slate-300">
      {text}
      <button
        type="button"
        onClick={onTa}
        className="p-0.5 text-slate-500 hover:text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
        aria-label={`Ta bort filtret ${text}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
