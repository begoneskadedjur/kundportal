// src/hooks/useInvoiceCaseChain.ts
// Datahook för fakturamodalens fakturakedja (InvoiceCaseChain): alla fakturor
// på ärendet, ofakturerade pending-tjänsterader och ärendets avslutsläge.
// Read-only — påverkar inte Fortnox-flödet.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvoiceWithItems, InvoiceStatus } from '../types/invoice'
import type { CaseType } from '../types/communication'

export interface ChainInvoice {
  id: string
  invoice_number: string | null
  invoice_type: string
  status: InvoiceStatus
  total_amount: number
  created_at: string
}

export interface CaseChainData {
  loading: boolean
  invoices: ChainInvoice[]
  /** Tjänsterader (status pending) på ärendet som inte ligger på denna faktura */
  pendingCount: number
  pendingAmount: number
  /** Ärendet är avslutat — ingen slutfaktura-rad ska utlovas */
  caseClosed: boolean
  /** Kedjesektionen ska visas (delfaktura, flera fakturor eller väntande rader) */
  show: boolean
}

const EMPTY_CHAIN: CaseChainData = {
  loading: false,
  invoices: [],
  pendingCount: 0,
  pendingAmount: 0,
  caseClosed: false,
  show: false,
}

export function useInvoiceCaseChain(
  invoice: InvoiceWithItems | null,
  effectiveCaseType: CaseType | null
): CaseChainData {
  const [chain, setChain] = useState<CaseChainData>(EMPTY_CHAIN)

  useEffect(() => {
    if (!invoice?.case_id || !effectiveCaseType) {
      setChain(EMPTY_CHAIN)
      return
    }
    let cancelled = false
    const caseId = invoice.case_id
    const invoiceType = invoice.invoice_type as string

    const load = async () => {
      setChain({ ...EMPTY_CHAIN, loading: true })
      try {
        const caseTable =
          effectiveCaseType === 'private'
            ? 'private_cases'
            : effectiveCaseType === 'business'
              ? 'business_cases'
              : 'cases'

        const [invoicesRes, pendingRes, caseRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('id, invoice_number, invoice_type, status, total_amount, created_at')
            .eq('case_id', caseId)
            .order('created_at', { ascending: true }),
          // Contract-fakturor (årspremie) har ingen radkoppling till ärendet — hoppa över
          invoiceType === 'contract'
            ? Promise.resolve({ data: null })
            : supabase
                .from('case_billing_items')
                .select('id, total_price')
                .eq('case_id', caseId)
                .eq('case_type', effectiveCaseType)
                .eq('item_type', 'service')
                .eq('status', 'pending'),
          supabase.from(caseTable).select('status, completed_date').eq('id', caseId).maybeSingle(),
        ])
        if (cancelled) return

        const invoices = (invoicesRes.data as ChainInvoice[] | null) || []

        // Rader som redan ligger på denna faktura räknas inte som "utanför"
        const linkedIds = new Set(
          (invoice.items || []).map(i => i.case_billing_item_id).filter(Boolean) as string[]
        )
        const pendingRows = ((pendingRes.data as { id: string; total_price: number }[] | null) || []).filter(
          r => !linkedIds.has(r.id)
        )
        const pendingAmount = pendingRows.reduce((s, r) => s + Number(r.total_price || 0), 0)

        const caseRow = caseRes.data as { status: string | null; completed_date: string | null } | null
        const caseClosed = !!caseRow && (caseRow.status === 'Avslutat' || caseRow.completed_date != null)

        const nonCancelled = invoices.filter(i => i.status !== 'cancelled')
        const show = invoiceType === 'partial' || nonCancelled.length > 1 || pendingRows.length > 0

        setChain({
          loading: false,
          invoices,
          pendingCount: pendingRows.length,
          pendingAmount,
          caseClosed,
          show,
        })
      } catch {
        if (!cancelled) setChain(EMPTY_CHAIN)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice?.case_id, effectiveCaseType])

  return chain
}
