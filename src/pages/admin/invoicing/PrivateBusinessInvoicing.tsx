// src/pages/admin/invoicing/PrivateBusinessInvoicing.tsx
// Fakturering 2.0 – arbetskö i pipelineordning, arkiv bakom toggle och färgdiet på raderna

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Search,
  Download,
  CheckCircle,
  FileEdit,
  XCircle,
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { InvoiceService } from '../../../services/invoiceService'
import type { Invoice, InvoiceStatus, InvoiceFilters } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'
import InvoiceDetailModal from '../../../components/admin/invoicing/InvoiceDetailModal'

type InvoiceTabType = 'private-business' | 'contract' | 'adhoc'
type QueueFilter = 'pending_approval' | 'ready' | 'overdue' | null

interface Props {
  invoiceType?: InvoiceTabType
}

// Arbetslägen – status som kräver handling. Övriga (booked, sent, paid, cancelled) bor i arkivet.
const WORK_STATUSES: InvoiceStatus[] = ['pending_approval', 'ready', 'draft', 'overdue']

// Färgdiet: statuspunkten bär färgen, texten intill är alltid slate-300
const STATUS_DOT: Record<InvoiceStatus, string> = {
  draft: 'bg-orange-400',
  pending_approval: 'bg-amber-400',
  ready: 'bg-sky-400',
  booked: 'bg-blue-400',
  sent: 'bg-purple-400',
  paid: 'bg-emerald-400',
  cancelled: 'bg-red-400',
  overdue: 'bg-red-400'
}

// Kompakt belopp för arbetskön: tkr från 10 000 kr, annars fullt belopp
const compactAmount = (n: number): string =>
  n >= 10000 ? `${Math.round(n / 1000).toLocaleString('sv-SE')} tkr` : formatInvoiceAmount(n)

export default function PrivateBusinessInvoicing({ invoiceType = 'private-business' }: Props) {
  // Godkännande-åtgärder visas bara för faktureringsansvariga
  const { user, profile } = useAuth()
  const canApproveInvoices = !!profile?.can_approve_invoices
  const approverName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  // Ärendenummer per case_id - fakturanumret är en obruten löpande serie
  // (bokföringskrav) och kan inte bygga på ärendenumret, så kopplingen
  // visas i stället under fakturanumret i listan
  const [caseNumbers, setCaseNumbers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  // Filter state – arbetskö-cell + arkiv-toggle
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(null)
  const [showArchive, setShowArchive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Månadsgruppering (endast för contract/adhoc)
  const groupByMonth = invoiceType === 'contract' || invoiceType === 'adhoc'
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const currentMonthKey = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  })()

  // Förfallen oavsett status-kolumn (t.ex. skickad med passerat förfallodatum)
  const isRowOverdue = (inv: Invoice) =>
    inv.status === 'overdue' || isInvoiceOverdue(inv.due_date, inv.status)

  // Arbetsläge = kräver handling; visas i defaultvyn
  const isWorkInvoice = (inv: Invoice) =>
    WORK_STATUSES.includes(inv.status) || isRowOverdue(inv)

  // Arbetskö-underlag – beräknas ur redan hämtade fakturor (per flik)
  const pendingApprovalInvoices = invoices.filter(i => i.status === 'pending_approval')
  const readyInvoices = invoices.filter(i => i.status === 'ready')
  const overdueInvoices = invoices.filter(isRowOverdue)
  const invoicedThisMonth = invoices.filter(
    i => i.created_at.slice(0, 7) === currentMonthKey && ['booked', 'sent', 'paid'].includes(i.status)
  )
  const sumOf = (list: Invoice[]) => list.reduce((s, i) => s + i.total_amount, 0)
  const oldestPendingDate = pendingApprovalInvoices.length > 0
    ? pendingApprovalInvoices.reduce((min, i) => (i.created_at < min ? i.created_at : min), pendingApprovalInvoices[0].created_at).slice(0, 10)
    : null

  const currentMonthName = new Date().toLocaleDateString('sv-SE', { month: 'long' })

  // Synlig lista: aktivt cellfilter vinner, annars arbetslägen (arkiv bakom toggle)
  const visibleInvoices = (() => {
    if (queueFilter === 'overdue') return invoices.filter(isRowOverdue)
    if (queueFilter) return invoices.filter(i => i.status === queueFilter)
    if (!showArchive) return invoices.filter(isWorkInvoice)
    return invoices
  })()
  const archivedCount = invoices.filter(i => !isWorkInvoice(i)).length

  // Auto-expandera aktuell månad när data laddats
  useEffect(() => {
    if (!groupByMonth || invoices.length === 0) return
    if (expandedMonths.size > 0) return
    const today = new Date()
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const keys = new Set(
      invoices
        .filter(i => i.billing_period_start)
        .map(i => (i.billing_period_start as string).slice(0, 7))
    )
    if (keys.has(currentKey)) {
      setExpandedMonths(new Set([currentKey]))
    } else if (keys.size > 0) {
      // Annars ta tidigaste tillgängliga månad
      const firstKey = Array.from(keys).sort()[0]
      setExpandedMonths(new Set([firstKey]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, groupByMonth])

  // Rensa markeringar när vyn byts – markerade rader ska aldrig vara osynliga
  useEffect(() => {
    setSelectedIds([])
  }, [queueFilter, showArchive])

  // Gruppera synliga fakturor per YYYY-MM baserat på billing_period_start
  const groupedInvoices = groupByMonth
    ? (() => {
        const map = new Map<string, Invoice[]>()
        for (const inv of visibleInvoices) {
          const key = inv.billing_period_start ? inv.billing_period_start.slice(0, 7) : 'okänd'
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(inv)
        }
        // Sortera månader stigande (tidigaste först)
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      })()
    : []

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatMonthLabel = (key: string) => {
    if (key === 'okänd') return 'Okänd period'
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  // Ladda data – statusfiltrering sker numera i klienten så att
  // arbetskön alltid räknar på flikens fullständiga underlag
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const filters: InvoiceFilters = {}
      if (searchTerm) filters.search = searchTerm

      // Filter per invoice_type beroende på vilken flik
      if (invoiceType === 'private-business') {
        // 'case' och 'partial' är legacy-typer som finns i databasen men inte i typunionen
        filters.invoice_type = ['private', 'business', 'case', 'partial'] as InvoiceFilters['invoice_type']
      } else if (invoiceType === 'contract') {
        filters.invoice_type = 'contract'
      } else if (invoiceType === 'adhoc') {
        filters.invoice_type = 'adhoc'
      }

      const invoicesData = await InvoiceService.getInvoices(filters)

      setInvoices(invoicesData)
      setSelectedIds([])

      // Slå upp ärendenummer för fakturor kopplade till ärenden
      const byTable: Record<'private_cases' | 'business_cases' | 'cases', string[]> = {
        private_cases: [], business_cases: [], cases: []
      }
      for (const inv of invoicesData) {
        if (!inv.case_id) continue
        if (inv.case_type === 'private') byTable.private_cases.push(inv.case_id)
        else if (inv.case_type === 'business') byTable.business_cases.push(inv.case_id)
        else byTable.cases.push(inv.case_id)
      }
      const map: Record<string, string> = {}
      await Promise.all(
        (Object.keys(byTable) as (keyof typeof byTable)[])
          .filter(t => byTable[t].length > 0)
          .map(async table => {
            const { data } = await supabase
              .from(table)
              .select('id, case_number')
              .in('id', [...new Set(byTable[table])])
            for (const row of data || []) {
              if (row.case_number) map[row.id] = row.case_number
            }
          })
      )
      setCaseNumbers(map)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda fakturor')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, invoiceType])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Hantera statusändring
  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await InvoiceService.updateInvoiceStatus(id, status)
      toast.success('Status uppdaterad')
      loadData()
    } catch (error) {
      console.error('Fel vid statusändring:', error)
      toast.error('Kunde inte uppdatera status')
    }
  }

  // Godkänn enskild faktura (endast faktureringsansvarig)
  const handleApproveInvoice = async (id: string) => {
    if (!user || !canApproveInvoices) return
    try {
      await InvoiceService.approveInvoice(id, user.id, approverName)
      toast.success('Faktura godkänd')
      loadData()
    } catch (error) {
      console.error('Fel vid godkännande:', error)
      toast.error('Kunde inte godkänna fakturan')
    }
  }

  // Batch-godkänn markerade fakturor som väntar på godkännande
  const handleBatchApprove = async () => {
    if (!user || !canApproveInvoices) return
    const toApprove = invoices.filter(
      i => selectedIds.includes(i.id) && i.status === 'pending_approval'
    )
    if (toApprove.length === 0) {
      toast.error('Inga markerade fakturor väntar på godkännande')
      return
    }
    try {
      await Promise.all(toApprove.map(i => InvoiceService.approveInvoice(i.id, user.id, approverName)))
      toast.success(`${toApprove.length} ${toApprove.length === 1 ? 'faktura godkänd' : 'fakturor godkända'}`)
      loadData()
    } catch (error) {
      console.error('Fel vid godkännande:', error)
      toast.error('Kunde inte godkänna fakturor')
    }
  }

  // Exportera till Fortnox (CSV) – endast status 'ready' exporteras,
  // annars riskerar redan skickade fakturor att exporteras dubbelt
  const handleExport = async () => {
    const source = selectedIds.length > 0
      ? invoices.filter(i => selectedIds.includes(i.id))
      : invoices
    const idsToExport = source.filter(i => i.status === 'ready').map(i => i.id)

    if (idsToExport.length === 0) {
      toast.error('Inga fakturor med status Redo för Fortnox att exportera')
      return
    }

    try {
      const csv = await InvoiceService.exportForFortnox(idsToExport)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fortnox-export-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${idsToExport.length} fakturor exporterade`)
    } catch (error) {
      console.error('Fel vid export:', error)
      toast.error('Kunde inte exportera')
    }
  }

  const toggleQueueFilter = (key: Exclude<QueueFilter, null>) => {
    setQueueFilter(prev => (prev === key ? null : key))
  }

  // En cell i arbetskön
  const QueueCell = ({
    filterKey, label, list, hint, warnColor
  }: {
    filterKey: Exclude<QueueFilter, null>
    label: string
    list: Invoice[]
    hint?: string
    warnColor?: 'amber' | 'red'
  }) => {
    const active = queueFilter === filterKey
    const countColor = active
      ? 'text-[#20c58f]'
      : list.length > 0 && warnColor === 'amber'
        ? 'text-amber-400'
        : list.length > 0 && warnColor === 'red'
          ? 'text-red-400'
          : 'text-white'
    return (
      <button
        onClick={() => toggleQueueFilter(filterKey)}
        className={`flex-1 min-w-0 px-4 py-2.5 text-left transition-colors hover:bg-slate-800/40 border-b-2 ${
          active ? 'border-b-[#20c58f]' : 'border-b-transparent'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
        <div className="tabular-nums">
          <span className={`text-lg font-bold ${countColor}`}>{list.length}</span>
          <span className="text-xs font-medium text-slate-400"> · {compactAmount(sumOf(list))}</span>
        </div>
        {hint && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{hint}</div>}
      </button>
    )
  }

  // En rad i fakturatabellen (återanvänds av både platt vy och månadsgrupperad vy)
  const renderInvoiceRow = (invoice: Invoice) => {
    const rowOverdue = isRowOverdue(invoice)
    const caseNumber = invoice.case_id ? caseNumbers[invoice.case_id] : undefined
    const period = invoice.billing_period_start && invoice.billing_period_end
      ? `${invoice.billing_period_start.slice(0, 10)} – ${invoice.billing_period_end.slice(0, 10)}`
      : null

    // Typ som dämpad undertext – bara i Privat & Företag-fliken
    const typeLabel = invoiceType === 'private-business'
      ? (invoice.invoice_type === 'private' || invoice.case_type === 'private' ? 'Privat' : 'Företag')
      : null
    const subParts: { key: string; mono?: boolean; text: string }[] = []
    if (typeLabel) subParts.push({ key: 'type', text: typeLabel })
    if (invoice.organization_number) subParts.push({ key: 'org', mono: true, text: invoice.organization_number })
    if (invoice.rot_rut_type) subParts.push({ key: 'rotrut', text: invoice.rot_rut_type })

    return (
      <tr key={invoice.id} className="group hover:bg-slate-800/40">
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={selectedIds.includes(invoice.id)}
            onChange={(e) => setSelectedIds(prev =>
              e.target.checked ? [...prev, invoice.id] : prev.filter(id => id !== invoice.id)
            )}
            className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
          />
        </td>
        <td className="px-3 py-2">
          <div className="font-mono text-xs text-white">{invoice.invoice_number || '-'}</div>
          {(caseNumber || (groupByMonth && period)) && (
            <div className="font-mono text-[10px] text-slate-500">
              {caseNumber || `Period ${period}`}
            </div>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="text-sm text-white">{invoice.customer_name}</div>
          {subParts.length > 0 && (
            <div className="text-xs text-slate-500">
              {subParts.map((part, i) => (
                <span key={part.key}>
                  {i > 0 && ' · '}
                  <span className={part.mono ? 'font-mono' : undefined}>{part.text}</span>
                </span>
              ))}
            </div>
          )}
        </td>
        <td className={`px-3 py-2 text-xs tabular-nums ${rowOverdue ? 'text-red-400' : 'text-slate-400'}`}>
          {formatInvoiceDate(invoice.created_at)}
        </td>
        <td className="px-3 py-2 text-right text-sm font-medium text-white tabular-nums">
          {formatInvoiceAmount(invoice.total_amount)}
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[invoice.status]}`} />
            {INVOICE_STATUS_CONFIG[invoice.status].label}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity">
            {invoice.status === 'pending_approval' && canApproveInvoices && (
              <button
                onClick={() => handleApproveInvoice(invoice.id)}
                className="p-1 text-slate-500 hover:text-[#20c58f] hover:bg-slate-700/50 rounded"
                title="Godkänn"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            {invoice.status === 'ready' && (
              <button
                onClick={() => setSelectedInvoiceId(invoice.id)}
                className="p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded"
                title="Skapa utkast i Fortnox"
              >
                <FileEdit className="w-4 h-4" />
              </button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <button
                onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded"
                title="Makulera"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded"
              title="Detaljer"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const tableHead = (withSelectAll: boolean) => (
    <thead className={withSelectAll ? 'bg-slate-900/80 sticky top-0 z-10' : 'bg-slate-900/50'}>
      <tr>
        <th className="px-3 py-2 text-left w-8">
          {withSelectAll && (
            <input
              type="checkbox"
              checked={visibleInvoices.length > 0 && selectedIds.length === visibleInvoices.length}
              onChange={(e) => setSelectedIds(e.target.checked ? visibleInvoices.map(i => i.id) : [])}
              className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
            />
          )}
        </th>
        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nr</th>
        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kund</th>
        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Datum</th>
        <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Belopp</th>
        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
        <th className="px-3 py-2 w-24"></th>
      </tr>
    </thead>
  )

  return (
    <div className="space-y-3">
      {/* Arbetskö – fyra celler i pipelineordning på en yta med hårfina avdelare */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 flex divide-x divide-slate-800 overflow-hidden">
        <QueueCell
          filterKey="pending_approval"
          label="Kräver godkännande"
          list={pendingApprovalInvoices}
          warnColor="amber"
          hint={oldestPendingDate ? `äldsta väntar sedan ${oldestPendingDate}` : undefined}
        />
        <QueueCell
          filterKey="ready"
          label="Redo för Fortnox"
          list={readyInvoices}
          hint="skapas som utkast, bokförs ej"
        />
        <QueueCell
          filterKey="overdue"
          label="Förfallna"
          list={overdueInvoices}
          warnColor="red"
        />
        {/* Avstämningstal – ej klickbart filter */}
        <div className="flex-1 min-w-0 px-4 py-2.5 border-b-2 border-b-transparent">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
            Fakturerat i {currentMonthName}
          </div>
          <div className="text-[15px] font-semibold text-slate-300 tabular-nums">
            {formatInvoiceAmount(sumOf(invoicedThisMonth))}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">avstämningstal · ej filter</div>
        </div>
      </div>

      {/* Sökrad: sök vänster · Arkiv-toggle · uppdatera · Till Fortnox höger */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sök fakturanr, kund..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-56"
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowArchive(v => !v)}
          aria-pressed={showArchive}
          className={`flex items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
            showArchive ? 'text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border transition-colors ${
            showArchive ? 'bg-[#20c58f]/30 border-[#20c58f]' : 'bg-slate-800 border-slate-600'
          }`}>
            <span className={`absolute top-[2px] left-[2px] h-2.5 w-2.5 rounded-full transition-transform ${
              showArchive ? 'translate-x-3 bg-[#20c58f]' : 'translate-x-0 bg-slate-500'
            }`} />
          </span>
          Arkiv
        </button>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-[#20c58f] hover:bg-[#1bab7c] text-[#fff] rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Till Fortnox ({readyInvoices.length})
        </button>
      </div>

      {/* Batchrad – flat verktygsrad, syns bara när rader är markerade */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 text-sm">
          <span className="font-semibold text-white">{selectedIds.length} markerade</span>
          {canApproveInvoices && (
            <>
              <span className="text-[#20c58f]/40">·</span>
              <button
                onClick={handleBatchApprove}
                className="font-semibold text-[#20c58f] hover:underline"
              >
                Godkänn
              </button>
            </>
          )}
          <span className="text-[#20c58f]/40">·</span>
          <button
            onClick={handleExport}
            className="font-semibold text-[#20c58f] hover:underline"
          >
            Exportera
          </button>
        </div>
      )}

      {/* Tabell */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar...</span>
          </div>
        ) : visibleInvoices.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileEdit className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {queueFilter || showArchive || searchTerm
                ? 'Inga fakturor hittades'
                : 'Inget i arbetskön just nu'}
            </p>
          </div>
        ) : groupByMonth ? (
          <div className="max-h-[calc(100vh-280px)] overflow-auto divide-y divide-slate-800/80">
            {groupedInvoices.map(([monthKey, list]) => {
              const isOpen = expandedMonths.has(monthKey)
              const totalSum = sumOf(list)
              const unbilledSum = sumOf(list.filter(isWorkInvoice))
              const isCurrent = monthKey === currentMonthKey
              return (
                <div key={monthKey} className={isCurrent ? 'border-l-2 border-l-[#20c58f]' : ''}>
                  <button
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors text-left"
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                    <span className="text-sm font-bold text-white capitalize">
                      {formatMonthLabel(monthKey)}
                    </span>
                    <span className="flex-1" />
                    <span className="text-xs text-slate-500 tabular-nums">
                      {list.length} {list.length === 1 ? 'faktura' : 'fakturor'}
                      {' · '}
                      <span className="text-sm font-medium text-white">{formatInvoiceAmount(totalSum)}</span>
                      {unbilledSum > 0 && (
                        <>
                          {' · '}
                          <span className="text-amber-400">varav ofakturerat {formatInvoiceAmount(unbilledSum)}</span>
                        </>
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <table className="w-full text-sm">
                      {tableHead(false)}
                      <tbody className="divide-y divide-slate-800/60">
                        {list.map(invoice => renderInvoiceRow(invoice))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full text-sm">
              {tableHead(true)}
              <tbody className="divide-y divide-slate-800/60">
                {visibleInvoices.map(invoice => renderInvoiceRow(invoice))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer med summa */}
        {!loading && visibleInvoices.length > 0 && (
          <div className="px-4 py-2 bg-slate-950/30 border-t border-slate-800 flex justify-between items-center text-sm">
            <span className="text-slate-400">
              {visibleInvoices.length} fakturor
              {selectedIds.length > 0 && ` (${selectedIds.length} markerade)`}
            </span>
            <span className="text-white font-medium tabular-nums">
              Summa: {formatInvoiceAmount(sumOf(visibleInvoices))}
            </span>
          </div>
        )}

        {/* Arkivrad – genväg till slutlägena när de är dolda */}
        {!loading && !showArchive && archivedCount > 0 && (
          <div className="px-4 py-2.5 bg-slate-950/30 border-t border-slate-800 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>
              {archivedCount} {archivedCount === 1 ? 'faktura' : 'fakturor'} i arkivet (bokförda, skickade, betalda)
            </span>
            <span>·</span>
            <button
              onClick={() => setShowArchive(true)}
              className="text-slate-400 underline hover:text-white"
            >
              Visa arkiv
            </button>
            {queueFilter && (
              <>
                <span>·</span>
                <button
                  onClick={() => setQueueFilter(null)}
                  className="text-[#20c58f] hover:underline"
                >
                  Visa alla arbetslägen
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <InvoiceDetailModal
        isOpen={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        invoiceId={selectedInvoiceId}
        onStatusChange={loadData}
      />
    </div>
  )
}
