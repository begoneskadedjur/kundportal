// src/hooks/useInvoiceMarking.ts
// Datahook för fakturamodalens ärendemärkningspanel (InvoiceMarkingSection).
// Läser kundens märkningsflaggor + ärendets värden och räknar fram exakt
// vilken sträng som blir "Er referens" i Fortnox — samma prioritering som
// handleSendToFortnox (ärendets märkning vinner över fakturans snapshot).
// Read-only, påverkar inte Fortnox-flödet.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvoiceWithItems } from '../types/invoice'
import type { CaseType } from '../types/communication'

export interface MarkingField {
  key: 'work_order_number' | 'work_object' | 'room_number'
  label: string
  value: string | null
}

export interface InvoiceMarkingInfo {
  fields: MarkingField[]
  /** Etiketter för aktiverade fält som saknar värde på ärendet */
  missing: string[]
  /** Strängen som blir Er referens i Fortnox (ärendets märkning vinner), null = ingen */
  effectiveReference: string | null
}

const FIELD_LABELS: Record<MarkingField['key'], string> = {
  work_order_number: 'Arbetsorder nr',
  work_object: 'Objekt',
  room_number: 'Rum nr',
}

/**
 * Returnerar null när panelen inte ska visas: ingen kund, inga aktiverade
 * flaggor, eller inget kopplat contract-ärende — märkningsfälten finns bara
 * på cases-tabellen (verifierat mot schemat; private/business saknar dem).
 */
export function useInvoiceMarking(
  invoice: InvoiceWithItems | null,
  effectiveCaseType: CaseType | null
): InvoiceMarkingInfo | null {
  const [info, setInfo] = useState<InvoiceMarkingInfo | null>(null)

  useEffect(() => {
    if (!invoice?.customer_id || !invoice.case_id || effectiveCaseType !== 'contract') {
      setInfo(null)
      return
    }
    let cancelled = false
    const customerId = invoice.customer_id
    const caseId = invoice.case_id
    const invoiceMarking = invoice.invoice_marking

    const load = async () => {
      try {
        const [{ data: customer }, { data: caseRow }] = await Promise.all([
          supabase
            .from('customers')
            .select('work_order_number_enabled, work_object_enabled, room_number_enabled')
            .eq('id', customerId)
            .maybeSingle(),
          supabase
            .from('cases')
            .select('work_order_number, work_object, room_number, invoice_marking')
            .eq('id', caseId)
            .maybeSingle(),
        ])
        if (cancelled) return
        if (!customer || !caseRow) {
          setInfo(null)
          return
        }
        const c = customer as {
          work_order_number_enabled: boolean
          work_object_enabled: boolean
          room_number_enabled: boolean
        }
        const cs = caseRow as {
          work_order_number: string | null
          work_object: string | null
          room_number: string | null
          invoice_marking: string | null
        }
        const fields: MarkingField[] = []
        if (c.work_order_number_enabled) {
          fields.push({ key: 'work_order_number', label: FIELD_LABELS.work_order_number, value: cs.work_order_number })
        }
        if (c.work_object_enabled) {
          fields.push({ key: 'work_object', label: FIELD_LABELS.work_object, value: cs.work_object })
        }
        if (c.room_number_enabled) {
          fields.push({ key: 'room_number', label: FIELD_LABELS.room_number, value: cs.room_number })
        }
        if (fields.length === 0) {
          setInfo(null)
          return
        }
        // Samma prioritering som handleSendToFortnox: ärendets aktuella
        // märkning vinner över fakturans snapshot
        const effectiveReference = cs.invoice_marking?.trim() || invoiceMarking || null
        setInfo({
          fields,
          missing: fields.filter(f => !f.value?.trim()).map(f => f.label),
          effectiveReference,
        })
      } catch {
        if (!cancelled) setInfo(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [invoice?.customer_id, invoice?.case_id, invoice?.invoice_marking, effectiveCaseType])

  return info
}
