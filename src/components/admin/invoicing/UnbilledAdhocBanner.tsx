// src/components/admin/invoicing/UnbilledAdhocBanner.tsx
// Säkerhetsnät för merförsäljning avtal: listar ad hoc-rader som saknar
// fakturakoppling (t.ex. efter ett fakturafel vid ärendeavslut) och låter
// admin återköra fakturagenereringen per ärende. Utan denna lista är sådana
// rader osynliga - faktureringssidan läser annars enbart invoices.
// Samma urvalsfilter som ContractInvoiceGenerator.generateAdhocInvoiceForCase.

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

interface OrphanRow {
  id: string
  case_id: string | null
  customer_id: string
  total_price: number
  status: string
  invoice_date: string | null
  customer: { company_name: string; adhoc_invoice_grouping: string | null } | null
}

interface CaseGroup {
  key: string
  caseId: string | null
  customerId: string
  customerName: string
  grouping: 'per_case' | 'monthly_batch'
  total: number
  count: number
  invoiceDate: string | null
  hasPending: boolean
}

export default function UnbilledAdhocBanner() {
  const [groups, setGroups] = useState<CaseGroup[]>([])
  const [generating, setGenerating] = useState<string | null>(null)

  const fetchOrphans = useCallback(async () => {
    const { data, error } = await supabase
      .from('contract_billing_items')
      .select('id, case_id, customer_id, total_price, status, invoice_date, customer:customers(company_name, adhoc_invoice_grouping)')
      .eq('item_type', 'ad_hoc')
      .is('invoice_id', null)
      .neq('status', 'cancelled')

    if (error) {
      console.error('[UnbilledAdhocBanner] Kunde inte hämta ofakturerade rader:', error)
      return
    }

    const byCase = new Map<string, CaseGroup>()
    for (const row of (data ?? []) as unknown as OrphanRow[]) {
      const key = `${row.customer_id}|${row.case_id ?? 'okänt'}`
      const existing = byCase.get(key)
      if (existing) {
        existing.total += Number(row.total_price)
        existing.count += 1
        existing.hasPending = existing.hasPending || row.status === 'pending'
      } else {
        byCase.set(key, {
          key,
          caseId: row.case_id,
          customerId: row.customer_id,
          customerName: row.customer?.company_name ?? 'Okänd kund',
          grouping: (row.customer?.adhoc_invoice_grouping ?? 'per_case') as 'per_case' | 'monthly_batch',
          total: Number(row.total_price),
          count: 1,
          invoiceDate: row.invoice_date,
          hasPending: row.status === 'pending'
        })
      }
    }
    setGroups([...byCase.values()].sort((a, b) => (a.invoiceDate ?? '').localeCompare(b.invoiceDate ?? '')))
  }, [])

  useEffect(() => { fetchOrphans() }, [fetchOrphans])

  const handleGenerate = async (group: CaseGroup) => {
    if (!group.caseId) {
      toast.error('Raden saknar ärendekoppling och måste hanteras manuellt')
      return
    }
    setGenerating(group.key)
    try {
      const { ContractInvoiceGenerator } = await import('../../../services/contractInvoiceGenerator')
      // T12:00 undviker att datumet tippar över midnatt vid tidszonstolkning
      const completedAt = group.invoiceDate ? new Date(`${group.invoiceDate}T12:00:00`) : new Date()
      const invoiceId = await ContractInvoiceGenerator.generateAdhocInvoiceForCase({
        customerId: group.customerId,
        caseId: group.caseId,
        completedAt,
        grouping: group.grouping
      })
      if (invoiceId) {
        toast.success(`Faktura skapad för ${group.customerName}`)
      } else {
        toast('Inget att fakturera - raderna kan redan vara kopplade', { icon: 'ℹ️' })
      }
      await fetchOrphans()
    } catch (err) {
      toast.error(`Kunde inte skapa faktura: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(null)
    }
  }

  if (groups.length === 0) return null

  const totalAmount = groups.reduce((sum, g) => sum + g.total, 0)

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-300">
          Ofakturerad merförsäljning - {groups.length} ärende{groups.length > 1 ? 'n' : ''}, {formatCurrency(totalAmount)}
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-2">
        Faktureringsrader utan koppling till någon faktura. Uppstår om fakturaskapandet
        misslyckades vid ärendeavslut - återkör genereringen här.
      </p>
      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.key} className="flex items-center justify-between px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
            <div className="min-w-0">
              <span className="text-sm text-white font-medium">{group.customerName}</span>
              <span className="text-xs text-slate-400 ml-2">
                {group.count} rad{group.count > 1 ? 'er' : ''} · {formatCurrency(group.total)}
                {group.invoiceDate ? ` · ${group.invoiceDate}` : ''}
                {group.hasPending ? ' · innehåller rad som väntar på rabattgodkännande' : ''}
              </span>
            </div>
            <button
              onClick={() => handleGenerate(group)}
              disabled={generating !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#20c58f] hover:bg-[#1ba876] disabled:opacity-50 rounded-lg transition-colors shrink-0 ml-3"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating === group.key ? 'animate-spin' : ''}`} />
              Skapa faktura
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
