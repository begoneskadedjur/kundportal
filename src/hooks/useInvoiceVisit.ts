// src/hooks/useInvoiceVisit.ts
// Datahook som kopplar en faktura till det BESÖK den faktiskt avser.
//
// Bakgrund: när ett återbesök bokas (RevisitContractModal) sparas det utförda
// besöket som ett snapshot i visits-tabellen och ärendets fält (work_report,
// time_spent_minutes, pest_level ...) nollställs medvetet inför nästa besök.
// Samtidigt flyttas cases.scheduled_start fram till nästa besök. Fakturan avser
// fortfarande det UTFÖRDA besöket, så den ska läsa snapshotet - inte ärendet.
//
// Kedja faktura -> besök:
//   privat/företag:   invoice_items.case_billing_item_id -> case_billing_items.visit_number
//   adhoc/contract:   invoice_items.contract_billing_item_id -> contract_billing_items.case_id
//                     -> case_billing_items (samma case_id, status billed/invoiced) -> visit_number
//   sedan:            visits där case_id = ärendet och visit_number = numret
//
// Flera besöksnummer på samma faktura (batch): högsta visit_number vinner.
// Saknas koppling eller visits-rad: null, tyst - dagens beteende gäller.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvoiceWithItems } from '../types/invoice'

export interface VisitSnapshot {
  id: string
  visit_number: number | null
  visit_date: string
  technician_name: string | null
  /** Besökets samtliga tekniker i rollordning. Tom lista på äldre besök. */
  technicians?: Array<{ id: string | null; name: string; role?: string }> | null
  work_performed: string | null
  findings: string | null
  recommendations: string | null
  materials_used: string | null
  time_spent_minutes: number | null
  pest_level: number | null
  problem_rating: number | null
}

interface UseInvoiceVisitResult {
  visit: VisitSnapshot | null
  isLoading: boolean
}

const VISIT_COLUMNS =
  'id, visit_number, visit_date, technician_name, technicians, work_performed, findings, recommendations, materials_used, time_spent_minutes, pest_level, problem_rating'

export function useInvoiceVisit(invoice: InvoiceWithItems | null): UseInvoiceVisitResult {
  const [visit, setVisit] = useState<VisitSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const caseId = invoice?.case_id ?? null
  const invoiceId = invoice?.id ?? null

  useEffect(() => {
    if (!invoiceId || !caseId) {
      setVisit(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const items = invoice?.items || []

    const load = async () => {
      setIsLoading(true)
      try {
        // 1. Direkt väg: fakturaraderna pekar på case_billing_items
        const directIds = items
          .map(i => (i as { case_billing_item_id?: string | null }).case_billing_item_id)
          .filter(Boolean) as string[]

        const visitNumbers = new Set<number>()

        if (directIds.length > 0) {
          const { data, error } = await supabase
            .from('case_billing_items')
            .select('visit_number')
            .in('id', directIds)
          if (error) throw error
          for (const row of (data as { visit_number: number | null }[] | null) || []) {
            if (row.visit_number != null) visitNumbers.add(row.visit_number)
          }
        }

        // 2. Adhoc/contract: raderna pekar på contract_billing_items, som bär
        //    case_id. Besöksnumret finns på ärendets fakturerade tjänsterader.
        if (visitNumbers.size === 0) {
          const contractIds = items
            .map(i => (i as { contract_billing_item_id?: string | null }).contract_billing_item_id)
            .filter(Boolean) as string[]

          let chainCaseIds: string[] = []
          if (contractIds.length > 0) {
            const { data, error } = await supabase
              .from('contract_billing_items')
              .select('case_id')
              .in('id', contractIds)
            if (error) throw error
            chainCaseIds = Array.from(
              new Set(
                ((data as { case_id: string | null }[] | null) || [])
                  .map(r => r.case_id)
                  .filter(Boolean) as string[]
              )
            )
          }
          // Fakturans eget case_id duger som utgångspunkt när radkopplingen
          // saknas (t.ex. manuellt skapade adhoc-rader)
          if (chainCaseIds.length === 0) chainCaseIds = [caseId]

          const { data: billed, error: billedError } = await supabase
            .from('case_billing_items')
            .select('visit_number')
            .in('case_id', chainCaseIds)
            .in('status', ['billed', 'invoiced'])
          if (billedError) throw billedError
          for (const row of (billed as { visit_number: number | null }[] | null) || []) {
            if (row.visit_number != null) visitNumbers.add(row.visit_number)
          }
        }

        if (cancelled) return

        if (visitNumbers.size === 0) {
          setVisit(null)
          return
        }

        // Flera besök på samma faktura: det senaste utförda besöket gäller
        const targetVisitNumber = Math.max(...visitNumbers)

        const { data: visitRow, error: visitError } = await supabase
          .from('visits')
          .select(VISIT_COLUMNS)
          .eq('case_id', caseId)
          .eq('visit_number', targetVisitNumber)
          .maybeSingle()
        if (visitError) throw visitError
        if (cancelled) return

        setVisit((visitRow as VisitSnapshot | null) ?? null)
      } catch (err) {
        console.error('[useInvoiceVisit] Kunde inte hämta besökssnapshot:', err)
        if (!cancelled) setVisit(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // invoice.items är en ny array vid varje render - kör om på id/case_id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, caseId])

  return { visit, isLoading }
}
