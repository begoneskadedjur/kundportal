// src/pages/coordinator/CasesPage.tsx
// Ärendeöversikt för koordinatorer — ClickUp-liknande vy grupperad per status

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Search, ChevronDown, ChevronRight, RefreshCw, Columns, X,
  AlertCircle, Loader2, Bug, Calendar, User, MapPin, DollarSign,
  Tag, Clock, Trash2
} from 'lucide-react'
import { STATUS_CONFIG, isCompletedStatus, ClickUpStatus } from '../../types/database'
import { formatAddress } from '../../utils/addressFormatter'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import EditContractCaseModal from '../../components/coordinator/EditContractCaseModal'
import toast from 'react-hot-toast'

// ─── Typer ───────────────────────────────────────────────────────────────────

type CaseType = 'private' | 'business' | 'contract'

interface ArendeRow {
  id: string
  case_type: CaseType
  title: string
  status: ClickUpStatus
  kontaktperson?: string | null   // privat/företag
  contact_person?: string | null  // kontrakt
  adress?: any | null             // JSONB (privat/företag)
  address_formatted?: string | null // kontrakt
  primary_assignee_name?: string | null
  primary_assignee_id?: string | null
  secondary_assignee_name?: string | null
  secondary_assignee_id?: string | null
  tertiary_assignee_name?: string | null
  tertiary_assignee_id?: string | null
  assigned_technician_name?: string | null // kontrakt
  skadedjur?: string | null
  pest_type?: string | null       // kontrakt
  service?: { name: string } | null
  due_date?: string | null
  scheduled_date?: string | null  // kontrakt
  pris?: number | null
  price?: number | null           // kontrakt
  created_at: string
  deleted_at?: string | null
  case_number?: string | null
  company_name?: string | null
  _raw: any
}

// ─── Kolumndefinitioner ───────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: 'namn',      label: 'Namn',          icon: User,      defaultOn: true },
  { key: 'adress',    label: 'Adress',         icon: MapPin,    defaultOn: true },
  { key: 'assignee',  label: 'Assignee',       icon: User,      defaultOn: true },
  { key: 'tjänst',    label: 'Tjänst/Skadedjur', icon: Bug,     defaultOn: true },
  { key: 'duedate',   label: 'Due date',       icon: Calendar,  defaultOn: true },
  { key: 'status',    label: 'Status',         icon: Tag,       defaultOn: true },
  { key: 'pris',      label: 'Pris',           icon: DollarSign,defaultOn: false },
  { key: 'typ',       label: 'Ärendetyp',      icon: Tag,       defaultOn: false },
  { key: 'skapad',    label: 'Skapad',         icon: Clock,     defaultOn: false },
] as const

type ColKey = typeof ALL_COLUMNS[number]['key']

const LS_KEY = 'koordinator_arenden_columns'

function loadColPrefs(): Set<ColKey> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return new Set(JSON.parse(raw) as ColKey[])
  } catch {}
  return new Set(ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key))
}

// ─── Status-ordning ───────────────────────────────────────────────────────────

const STATUS_ORDER: ClickUpStatus[] = [
  'Öppen', 'Bokad', 'Bokat',
  'Offert skickad', 'Offert signerad - boka in',
  'Återbesök', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Ombokning', 'Bomkörning', 'Reklamation',
  'Generera saneringsrapport',
  'Avslutat', 'Stängt - slasklogg',
]

// ─── Hjälpare ─────────────────────────────────────────────────────────────────

function getDisplayName(c: ArendeRow): string {
  return c.kontaktperson || c.contact_person || c.company_name || c.title || '—'
}

function getDisplayAddress(c: ArendeRow): string {
  if (c.address_formatted) return c.address_formatted
  if (c.adress) return formatAddress(c.adress) || '—'
  return '—'
}

function getDisplayService(c: ArendeRow): string {
  if (c.service?.name) return c.service.name
  return c.skadedjur || c.pest_type || '—'
}

function getDisplayDueDate(c: ArendeRow): string {
  const raw = c.due_date || c.scheduled_date
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString('sv-SE', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch { return raw }
}

function getDisplayPrice(c: ArendeRow): string {
  const p = c.pris ?? c.price
  if (p == null) return '—'
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(p)
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

// Mappa raw DB-rad till TechnicianCase-format för EditCaseModal
function mapToTechnicianCase(c: ArendeRow) {
  const raw = c._raw
  return {
    id: c.id,
    case_type: c.case_type as 'private' | 'business',
    title: c.title,
    case_number: c.case_number || undefined,
    status: c.status,
    description: raw.description,
    case_price: raw.pris ?? raw.price,
    kontaktperson: raw.kontaktperson,
    telefon_kontaktperson: raw.telefon_kontaktperson,
    e_post_kontaktperson: raw.e_post_kontaktperson,
    skadedjur: raw.skadedjur,
    org_nr: raw.org_nr,
    personnummer: raw.personnummer,
    start_date: raw.start_date,
    due_date: raw.due_date,
    completed_date: raw.completed_date,
    adress: raw.adress,
    primary_assignee_id: raw.primary_assignee_id,
    primary_assignee_name: raw.primary_assignee_name,
    secondary_assignee_id: raw.secondary_assignee_id,
    secondary_assignee_name: raw.secondary_assignee_name,
    tertiary_assignee_id: raw.tertiary_assignee_id,
    tertiary_assignee_name: raw.tertiary_assignee_name,
    billing_status: raw.billing_status,
    deleted_at: raw.deleted_at,
    service_id: raw.service_id,
    ...raw,
  }
}

// ─── Assignee-avatars ─────────────────────────────────────────────────────────

function AssigneeAvatars({ c }: { c: ArendeRow }) {
  if (c.case_type === 'contract') {
    const name = c.assigned_technician_name
    if (!name) return <span className="text-slate-500 text-xs">—</span>
    return (
      <div className="flex items-center">
        <div
          className="w-7 h-7 rounded-full bg-[#20c58f]/20 border border-[#20c58f] flex items-center justify-center"
          title={name}
        >
          <span className="text-[10px] font-bold text-[#20c58f]">{getInitials(name)}</span>
        </div>
      </div>
    )
  }

  const slots = [
    { name: c.primary_assignee_name, id: c.primary_assignee_id },
    { name: c.secondary_assignee_name, id: c.secondary_assignee_id },
    { name: c.tertiary_assignee_name, id: c.tertiary_assignee_id },
  ].filter(s => s.name)

  if (slots.length === 0) return <span className="text-slate-500 text-xs">—</span>

  return (
    <div className="flex items-center">
      {slots.map((s, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-full bg-[#20c58f]/20 border border-[#20c58f] flex items-center justify-center"
          style={{ marginLeft: i > 0 ? '-6px' : 0 }}
          title={s.name!}
        >
          <span className="text-[10px] font-bold text-[#20c58f]">{getInitials(s.name!)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClickUpStatus }) {
  const color = STATUS_CONFIG[status]?.color || '#87909e'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ backgroundColor: `${color}22`, color, borderColor: `${color}44` }}
    >
      {status}
    </span>
  )
}

// ─── CaseType badge ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CaseType }) {
  if (type === 'private') return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-300 border border-slate-600">Privat</span>
  )
  if (type === 'business') return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Företag</span>
  )
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Avtal</span>
  )
}

// ─── Kolumnväljare ────────────────────────────────────────────────────────────

function ColumnPicker({ active, onChange }: { active: Set<ColKey>; onChange: (s: Set<ColKey>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (key: ColKey) => {
    const next = new Set(active)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
    localStorage.setItem(LS_KEY, JSON.stringify([...next]))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-slate-200 transition-colors bg-slate-800/50"
      >
        <Columns className="w-3.5 h-3.5" />
        Kolumner
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={active.has(col.key)}
                onChange={() => toggle(col.key)}
                className="rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <span className="text-xs text-slate-300">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sektionsheader ───────────────────────────────────────────────────────────

function SectionHeader({
  status, count, collapsed, onToggle
}: { status: ClickUpStatus; count: number; collapsed: boolean; onToggle: () => void }) {
  const color = STATUS_CONFIG[status]?.color || '#87909e'
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800/40 hover:bg-slate-800/60 border-b border-slate-700/50 transition-colors group"
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
        {status}
      </span>
      <span className="text-xs text-slate-500 ml-1">({count})</span>
      <div className="ml-auto text-slate-500 group-hover:text-slate-300 transition-colors">
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronDown className="w-3.5 h-3.5" />
        }
      </div>
    </button>
  )
}

// ─── Tabellrad ────────────────────────────────────────────────────────────────

function CaseRow({
  c, cols, onClick
}: { c: ArendeRow; cols: Set<ColKey>; onClick: () => void }) {
  const isDeleted = !!c.deleted_at

  return (
    <tr
      onClick={onClick}
      className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors group ${
        isDeleted ? 'opacity-60' : ''
      }`}
    >
      {isDeleted && (
        <td className="w-1 p-0">
          <div className="h-full w-1 bg-red-500 rounded-l" />
        </td>
      )}
      {cols.has('namn') && (
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isDeleted && <Trash2 className="w-3 h-3 text-red-400 flex-shrink-0" />}
            <div>
              <div className="text-sm text-slate-200 font-medium leading-tight">{getDisplayName(c)}</div>
              {c.case_number && <div className="text-[10px] text-slate-500">#{c.case_number}</div>}
              {isDeleted && <span className="text-[10px] text-red-400 font-medium">Raderat</span>}
            </div>
          </div>
        </td>
      )}
      {cols.has('adress') && (
        <td className="px-4 py-2.5">
          <span className="text-xs text-slate-400 line-clamp-1">{getDisplayAddress(c)}</span>
        </td>
      )}
      {cols.has('assignee') && (
        <td className="px-4 py-2.5">
          <AssigneeAvatars c={c} />
        </td>
      )}
      {cols.has('tjänst') && (
        <td className="px-4 py-2.5">
          <span className="text-xs text-slate-300">{getDisplayService(c)}</span>
        </td>
      )}
      {cols.has('duedate') && (
        <td className="px-4 py-2.5">
          <span className="text-xs text-slate-400">{getDisplayDueDate(c)}</span>
        </td>
      )}
      {cols.has('status') && (
        <td className="px-4 py-2.5">
          <StatusBadge status={c.status} />
        </td>
      )}
      {cols.has('pris') && (
        <td className="px-4 py-2.5">
          <span className="text-xs text-slate-300">{getDisplayPrice(c)}</span>
        </td>
      )}
      {cols.has('typ') && (
        <td className="px-4 py-2.5">
          <TypeBadge type={c.case_type} />
        </td>
      )}
      {cols.has('skapad') && (
        <td className="px-4 py-2.5">
          <span className="text-xs text-slate-500">
            {new Date(c.created_at).toLocaleDateString('sv-SE')}
          </span>
        </td>
      )}
    </tr>
  )
}

// ─── Huvudkomponent ───────────────────────────────────────────────────────────

export default function CasesPage() {
  const [allCases, setAllCases] = useState<ArendeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [cols, setCols] = useState<Set<ColKey>>(loadColPrefs)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Modal state
  const [editCaseOpen, setEditCaseOpen] = useState(false)
  const [editContractOpen, setEditContractOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<ArendeRow | null>(null)

  // ── Datahämtning ───────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [privRes, bizRes, contractRes] = await Promise.all([
        supabase
          .from('private_cases')
          .select('*, service:services(name)')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('business_cases')
          .select('*, service:services(name)')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('cases')
          .select('*, service:services(name)')
          .order('scheduled_date', { ascending: true, nullsFirst: false }),
      ])

      if (privRes.error) throw privRes.error
      if (bizRes.error) throw bizRes.error
      if (contractRes.error) throw contractRes.error

      const rows: ArendeRow[] = [
        ...(privRes.data || []).map(r => ({ ...r, case_type: 'private' as CaseType, _raw: r })),
        ...(bizRes.data || []).map(r => ({ ...r, case_type: 'business' as CaseType, _raw: r })),
        ...(contractRes.data || []).map(r => ({ ...r, case_type: 'contract' as CaseType, _raw: r })),
      ]
      setAllCases(rows)
    } catch (err: any) {
      setError(err.message || 'Kunde inte hämta ärenden')
      toast.error('Kunde inte hämta ärenden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── Filtrering ─────────────────────────────────────────────────────────────

  const filteredCases = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allCases.filter(c => {
      // Exkludera avslutade om toggle är av
      if (!includeCompleted && isCompletedStatus(c.status)) return false
      if (!includeCompleted && c.deleted_at) return false

      // Sökfilter
      if (q) {
        const haystack = [
          getDisplayName(c),
          getDisplayAddress(c),
          getDisplayService(c),
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [allCases, search, includeCompleted])

  // ── Gruppering per status ──────────────────────────────────────────────────

  const statusGroups = useMemo(() => {
    const map = new Map<ClickUpStatus, ArendeRow[]>()
    for (const c of filteredCases) {
      const s = c.status
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(c)
    }
    // Sortera i rätt ordning
    const ordered: { status: ClickUpStatus; cases: ArendeRow[] }[] = []
    for (const s of STATUS_ORDER) {
      if (map.has(s)) {
        ordered.push({ status: s, cases: map.get(s)! })
        map.delete(s)
      }
    }
    // Eventuella okända statusar sist
    for (const [s, cases] of map) {
      ordered.push({ status: s, cases })
    }
    return ordered
  }, [filteredCases])

  const totalCount = filteredCases.length

  // ── Toggle kollaps ─────────────────────────────────────────────────────────

  const toggleCollapse = (status: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  // ── Öppna modal ────────────────────────────────────────────────────────────

  const openCase = (c: ArendeRow) => {
    setSelectedCase(c)
    if (c.case_type === 'contract') setEditContractOpen(true)
    else setEditCaseOpen(true)
  }

  // ── Kolumnhuvuden ─────────────────────────────────────────────────────────

  const visibleCols = ALL_COLUMNS.filter(col => cols.has(col.key))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-white mr-2">Ärenden</h1>

          {/* Sök */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Sök på namn, adress, tjänst..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f]/50 focus:ring-1 focus:ring-[#20c58f]/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Toggle avslutade */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIncludeCompleted(!includeCompleted)}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  includeCompleted ? 'bg-[#20c58f]' : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                  includeCompleted ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
              <span className="text-xs text-slate-400">Inkludera avslutade</span>
            </label>

            <ColumnPicker active={cols} onChange={setCols} />

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              title="Uppdatera"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sammanfattning */}
        {!loading && (
          <div className="mt-1 text-xs text-slate-500">
            {totalCount} ärenden • {statusGroups.length} statusgrupper
          </div>
        )}
      </div>

      {/* Innehåll */}
      <div className="px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Laddar ärenden...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && statusGroups.length === 0 && (
          <div className="text-center py-24 text-slate-500 text-sm">
            {search ? 'Inga ärenden matchade sökningen.' : 'Inga ärenden hittades.'}
          </div>
        )}

        {!loading && !error && statusGroups.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900">
            {/* Kolumnhuvuden */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  {visibleCols.map(col => (
                    <th key={col.key} className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>

            {/* Statusgrupper */}
            {statusGroups.map(({ status, cases }) => (
              <div key={status}>
                <SectionHeader
                  status={status}
                  count={cases.length}
                  collapsed={collapsed.has(status)}
                  onToggle={() => toggleCollapse(status)}
                />
                {!collapsed.has(status) && (
                  <table className="w-full">
                    <tbody>
                      {cases.map(c => (
                        <CaseRow
                          key={`${c.case_type}-${c.id}`}
                          c={c}
                          cols={cols}
                          onClick={() => openCase(c)}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modaler */}
      {editCaseOpen && selectedCase && selectedCase.case_type !== 'contract' && (
        <EditCaseModal
          isOpen={editCaseOpen}
          onClose={() => { setEditCaseOpen(false); setSelectedCase(null) }}
          onSuccess={() => { setEditCaseOpen(false); setSelectedCase(null); fetchData() }}
          caseData={mapToTechnicianCase(selectedCase)}
        />
      )}
      {editContractOpen && selectedCase && selectedCase.case_type === 'contract' && (
        <EditContractCaseModal
          isOpen={editContractOpen}
          onClose={() => { setEditContractOpen(false); setSelectedCase(null) }}
          onSuccess={() => { setEditContractOpen(false); setSelectedCase(null); fetchData() }}
          caseData={selectedCase._raw}
        />
      )}
    </div>
  )
}
