// src/types/invoice.ts
// Typer för fakturor (privat/företag direktfakturering)

import type { BillableCaseType } from './caseBilling'

/**
 * Fakturastatus
 */
export type InvoiceStatus = 'draft' | 'pending_approval' | 'ready' | 'sent' | 'paid' | 'cancelled'

/**
 * Faktura från databasen
 */
export interface Invoice {
  id: string
  invoice_number: string | null
  case_id: string
  case_type: 'private' | 'business'

  // Kundinformation
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  organization_number: string | null

  // Belopp
  subtotal: number
  vat_amount: number
  total_amount: number

  // Status
  status: InvoiceStatus
  requires_approval: boolean

  // Datum
  created_at: string
  approved_at: string | null
  sent_at: string | null
  paid_at: string | null
  due_date: string | null

  notes: string | null
}

/**
 * Faktura med rader
 */
export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}

/**
 * Faktura med ärendeinfo
 */
export interface InvoiceWithCase extends Invoice {
  case?: {
    id: string
    title?: string
    case_number?: string
    status?: string
  }
}

/**
 * Fakturarad från databasen
 */
export interface InvoiceItem {
  id: string
  invoice_id: string
  case_billing_item_id: string | null
  article_id: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  vat_rate: number
  created_at: string
}

/**
 * Input för att skapa faktura
 */
export interface CreateInvoiceInput {
  case_id: string
  case_type: 'private' | 'business'
  customer_name: string
  customer_email?: string
  customer_phone?: string
  customer_address?: string
  organization_number?: string
  due_date?: string
  notes?: string
}

/**
 * Input för att skapa fakturarad
 */
export interface CreateInvoiceItemInput {
  invoice_id: string
  case_billing_item_id?: string
  article_id?: string
  article_code?: string
  article_name: string
  quantity: number
  unit_price: number
  discount_percent?: number
  vat_rate?: number
}

/**
 * Filter för att hämta fakturor
 */
export interface InvoiceFilters {
  status?: InvoiceStatus | InvoiceStatus[]
  case_type?: 'private' | 'business'
  requires_approval?: boolean
  from_date?: string
  to_date?: string
  search?: string
}

/**
 * Statistik för fakturor
 */
export interface InvoiceStats {
  draft: { count: number; amount: number }
  pending_approval: { count: number; amount: number }
  ready: { count: number; amount: number }
  sent: { count: number; amount: number }
  paid: { count: number; amount: number }
  cancelled: { count: number; amount: number }
  total: { count: number; amount: number }
}

/**
 * UI-konfiguration för fakturastatus
 */
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, {
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}> = {
  draft: {
    label: 'Utkast',
    description: 'Faktura skapad men inte klar',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    icon: 'FileEdit'
  },
  pending_approval: {
    label: 'Kräver godkännande',
    description: 'Rabatt given, väntar på admin-godkännande',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: 'AlertCircle'
  },
  ready: {
    label: 'Redo att skicka',
    description: 'Faktura godkänd och redo att skickas',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: 'CheckCircle'
  },
  sent: {
    label: 'Skickad',
    description: 'Faktura skickad till kund',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    icon: 'Send'
  },
  paid: {
    label: 'Betald',
    description: 'Faktura är betald',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: 'CheckCheck'
  },
  cancelled: {
    label: 'Makulerad',
    description: 'Faktura har makulerats',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: 'XCircle'
  }
}

/**
 * Generera fakturanummer
 * Format: INV-YYYYMM-XXXX
 */
export const generateInvoiceNumber = (sequenceNumber: number): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const seq = String(sequenceNumber).padStart(4, '0')
  return `INV-${year}${month}-${seq}`
}

/**
 * Formatera fakturabelopp
 */
export const formatInvoiceAmount = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Formatera fakturadatum
 */
export const formatInvoiceDate = (date: string | null): string => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('sv-SE')
}

/**
 * Beräkna förfallodatum (30 dagar från nu)
 */
export const calculateDueDate = (daysFromNow: number = 30): string => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}

/**
 * Kontrollera om faktura är förfallen
 */
export const isInvoiceOverdue = (dueDate: string | null, status: InvoiceStatus): boolean => {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

/**
 * Räkna ut summor från fakturarader
 */
export const calculateInvoiceTotals = (items: InvoiceItem[]): {
  subtotal: number
  vat_amount: number
  total_amount: number
} => {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
  const vat_amount = items.reduce((sum, item) => {
    const itemVat = item.total_price * (item.vat_rate / 100)
    return sum + itemVat
  }, 0)

  return {
    subtotal,
    vat_amount,
    total_amount: subtotal + vat_amount
  }
}
