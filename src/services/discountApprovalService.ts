// src/services/discountApprovalService.ts
// Rabattgodkännande: utsedda personer (profiles.can_approve_discounts)
// granskar fakturor i status pending_approval, ser teknikerns motivering
// och godkänner (→ ready) eller avslår (tekniker notifieras, fakturan
// ligger kvar för åtgärd). Avtalstilläggsrader är INTE rabatter - de
// visas med förklaring i stället för rabattflagga.

import { supabase } from '../lib/supabase'
import { InvoiceService } from './invoiceService'
import { DiscountNotificationService } from './discountNotificationService'
import type { Invoice } from '../types/invoice'

export interface DiscountLine {
  caseBillingItemId: string
  name: string
  discountPercent: number
  totalPrice: number
  motivation: string | null
  technicianId: string | null
  technicianName: string | null
}

export interface AdditionLine {
  description: string
  proratedAmount: number
  previousAnnualValue: number
  newAnnualValue: number
  effectiveFrom: string
  createdByName: string | null
}

export interface ApprovalItem {
  invoice: Invoice
  /** Rader med faktisk rabatt (avtalstillägg exkluderade) */
  discountLines: DiscountLine[]
  /** Avtalstillägg på fakturans ärende - pro rata, inte rabatt */
  additions: AdditionLine[]
}

export class DiscountApprovalService {
  /** Alla fakturor som väntar på godkännande, med rabatt-/tilläggsdetaljer */
  static async getPendingApprovals(): Promise<ApprovalItem[]> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'pending_approval')
      .eq('is_historical', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!invoices || invoices.length === 0) return []

    const caseIds = [...new Set(invoices.map(i => i.case_id).filter(Boolean))] as string[]

    const [cbiRes, addRes] = await Promise.all([
      caseIds.length > 0
        ? supabase
            .from('case_billing_items')
            .select('id, case_id, article_name, service_name, discount_percent, discount_motivation, total_price, contract_addition_annual, added_by_technician_id, added_by_technician_name')
            .in('case_id', caseIds)
            .gt('discount_percent', 0)
        : Promise.resolve({ data: [], error: null }),
      caseIds.length > 0
        ? supabase
            .from('contract_additions')
            .select('case_id, description, prorated_amount, previous_annual_value, new_annual_value, effective_from, created_by_name')
            .in('case_id', caseIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const discountsByCase = new Map<string, DiscountLine[]>()
    for (const row of cbiRes.data || []) {
      // Avtalstillägg är pro rata, inte rabatt
      if (row.contract_addition_annual != null) continue
      const list = discountsByCase.get(row.case_id) || []
      list.push({
        caseBillingItemId: row.id,
        name: row.service_name || row.article_name,
        discountPercent: Number(row.discount_percent),
        totalPrice: Number(row.total_price ?? 0),
        motivation: row.discount_motivation ?? null,
        technicianId: row.added_by_technician_id ?? null,
        technicianName: row.added_by_technician_name ?? null,
      })
      discountsByCase.set(row.case_id, list)
    }

    const additionsByCase = new Map<string, AdditionLine[]>()
    for (const row of addRes.data || []) {
      if (!row.case_id) continue
      const list = additionsByCase.get(row.case_id) || []
      list.push({
        description: row.description,
        proratedAmount: Number(row.prorated_amount),
        previousAnnualValue: Number(row.previous_annual_value),
        newAnnualValue: Number(row.new_annual_value),
        effectiveFrom: row.effective_from,
        createdByName: row.created_by_name ?? null,
      })
      additionsByCase.set(row.case_id, list)
    }

    // Sidan visar BARA fakturor med faktisk rabatt eller avtalstillägg.
    // Vanliga årspremiefakturor skapas alltid i pending_approval som sitt
    // normala startläge (godkänns i Fakturering-flödet) och hör inte hemma
    // i rabattgranskningen.
    return invoices
      .map(inv => ({
        invoice: inv as Invoice,
        discountLines: inv.case_id ? (discountsByCase.get(inv.case_id) || []) : [],
        additions: inv.case_id ? (additionsByCase.get(inv.case_id) || []) : [],
      }))
      .filter(item => item.discountLines.length > 0 || item.additions.length > 0)
  }

  /** Godkänn: faktura → ready, tekniker med rabattrader notifieras */
  static async approve(item: ApprovalItem, approvedBy: string): Promise<void> {
    await InvoiceService.updateInvoiceStatus(item.invoice.id, 'ready')
    const caseType = (item.invoice.invoice_type === 'adhoc' ? 'contract' : item.invoice.case_type) || 'contract'
    for (const line of item.discountLines) {
      await DiscountNotificationService.notifyDiscountApproved({
        technicianId: line.technicianId,
        caseId: item.invoice.case_id!,
        caseType: caseType as 'private' | 'business' | 'contract',
        articleName: line.name,
        approvedBy,
      })
    }
  }

  /**
   * Avslå: fakturan ligger kvar i pending_approval för åtgärd (justera pris,
   * makulera osv.) och teknikern notifieras med anledningen.
   */
  static async reject(item: ApprovalItem, rejectedBy: string, reason: string): Promise<void> {
    const caseType = (item.invoice.invoice_type === 'adhoc' ? 'contract' : item.invoice.case_type) || 'contract'
    for (const line of item.discountLines) {
      await DiscountNotificationService.notifyDiscountRejected({
        technicianId: line.technicianId,
        caseId: item.invoice.case_id!,
        caseType: caseType as 'private' | 'business' | 'contract',
        articleName: line.name,
        rejectedBy,
        reason,
      })
    }
  }
}
