import React from 'react'
import {
  Phone, Mail, ExternalLink, MapPin, ChevronRight, Trash2, Edit,
  Bug, FileSignature, Receipt, Package, MessageSquare
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { isCompletedStatus } from '../../../types/database'
import type { TechnicianCase, WorkflowGroup, CaseSupplementaryData } from '../../../pages/technician/TechnicianCases'

// ─── Helpers ────────────────────────────────────────────

export function getDaysAge(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export function getAgeBorderColor(days: number): string {
  if (days < 14) return 'border-l-green-500'
  if (days < 30) return 'border-l-amber-400'
  if (days < 90) return 'border-l-orange-500'
  return 'border-l-red-500'
}

function getAgeTextColor(days: number): string {
  if (days < 14) return 'text-green-400'
  if (days < 30) return 'text-amber-400'
  if (days < 90) return 'text-orange-400'
  return 'text-red-400'
}

// ─── Smart hint logic ───────────────────────────────────

interface SmartHint {
  text: string
  severity: 'info' | 'success' | 'warning' | 'error'
}

function computeSmartHint(
  c: TechnicianCase,
  group: WorkflowGroup | undefined,
  sup?: CaseSupplementaryData
): SmartHint | null {
  const hasContact = !!(c.kontaktperson || c.telefon_kontaktperson || c.e_post_kontaktperson)
  const age = getDaysAge(c.created_date)
  const status = c.status?.toLowerCase() || ''
  const completed = isCompletedStatus(c.status as any)

  // 1. Incomplete data
  if (!hasContact && !completed) {
    return { text: 'Saknar kontaktuppgifter', severity: 'error' }
  }

  // 2. Stale + open
  if (status.includes('öppen') && age > 90) {
    if (!hasContact) return { text: 'Borde tas bort', severity: 'error' }
    return { text: 'Kontakta kund eller ta bort', severity: 'warning' }
  }

  // 3. Completed flow
  if (completed) {
    if (sup?.invoice?.status === 'paid' || c.billing_status === 'paid') {
      return { text: 'Klart', severity: 'success' }
    }
    if (sup?.invoice?.status === 'sent' || c.billing_status === 'sent') {
      return { text: 'Faktura skickad', severity: 'info' }
    }
    if (sup?.invoice) {
      return { text: 'Faktura skapad', severity: 'info' }
    }
    if (sup?.hasBillingItems) {
      return { text: 'Redo att faktureras', severity: 'warning' }
    }
    if (!c.case_price && !sup?.hasBillingItems) {
      return { text: 'Artiklar/pris saknas', severity: 'warning' }
    }
    return { text: 'Lägg till artiklar och fakturera', severity: 'warning' }
  }

  // 4. Offer/contract flow
  if (status.includes('offert skickad')) {
    if (sup?.contract) {
      if (sup.contract.status === 'declined') return { text: 'Kund avböjt — kontakta', severity: 'warning' }
      if (sup.contract.status === 'overdue') return { text: 'Offert utgången — kontakta kund', severity: 'warning' }
      if (sup.contract.status === 'signed') return { text: 'Offert signerad — uppdatera status', severity: 'warning' }
    }
    return { text: 'Väntar på kundsvar', severity: 'info' }
  }
  if (status.includes('offert signerad')) {
    return { text: 'Boka in utförande', severity: 'info' }
  }

  // 5. Normal workflow
  if (group === 'needs_booking') return { text: 'Boka in besök', severity: 'info' }
  if (group === 'booked') {
    if (c.due_date && new Date(c.due_date) < new Date()) return { text: 'Försenat besök!', severity: 'error' }
    return { text: 'Besök inbokat', severity: 'info' }
  }
  if (group === 'revisit') return { text: 'Återbesök planerat', severity: 'info' }
  if (group === 'report') return { text: 'Generera saneringsrapport', severity: 'info' }
  if (group === 'needs_action') {
    if (status.includes('bomkörning')) return { text: 'Bomkörning — kontakta kund', severity: 'warning' }
    if (status.includes('ombokning')) return { text: 'Hantera ombokning', severity: 'warning' }
    if (status.includes('reklamation')) return { text: 'Hantera reklamation', severity: 'warning' }
    if (status.includes('review')) return { text: 'Inväntar granskning', severity: 'info' }
    return { text: 'Kräver åtgärd', severity: 'warning' }
  }

  return null
}

const HINT_COLORS: Record<SmartHint['severity'], { label: string; text: string; bg: string }> = {
  info:    { label: 'text-slate-500', text: 'text-white',      bg: 'bg-slate-900/50' },
  success: { label: 'text-green-500', text: 'text-green-300',  bg: 'bg-green-500/10' },
  warning: { label: 'text-amber-500', text: 'text-amber-300',  bg: 'bg-amber-500/10' },
  error:   { label: 'text-red-500',   text: 'text-red-300',    bg: 'bg-red-500/10' },
}

// ─── Other helpers ──────────────────────────────────────

const formatAddress = (address: any): string => {
  if (!address) return 'Saknas'
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address
  if (typeof address === 'string') {
    try { const p = JSON.parse(address); return p.formatted_address || address }
    catch { return address }
  }
  return 'Okänt format'
}

const caseTypeBadge: Record<string, { label: string; cls: string }> = {
  private: { label: 'Privat', cls: 'bg-blue-500/20 text-blue-400' },
  business: { label: 'Företag', cls: 'bg-purple-500/20 text-purple-400' },
  contract: { label: 'Avtal', cls: 'bg-teal-500/20 text-teal-400' },
}

const getStatusColor = (status: string) => {
  const s = status?.toLowerCase() || ''
  if (s.includes('avslutat')) return 'bg-green-500/20 text-green-400'
  if (s.startsWith('återbesök')) return 'bg-cyan-500/20 text-cyan-400'
  if (s.includes('bokad') || s.includes('bokat') || s.includes('offert signerad')) return 'bg-blue-500/20 text-blue-400'
  if (s.includes('öppen') || s.includes('offert skickad')) return 'bg-yellow-500/20 text-yellow-400'
  if (s.includes('review')) return 'bg-purple-500/20 text-purple-400'
  if (s.includes('bomkörning') || s.includes('reklamation')) return 'bg-red-500/20 text-red-400'
  if (s.includes('ombokning')) return 'bg-orange-500/20 text-orange-400'
  if (s.includes('stängt')) return 'bg-slate-600/50 text-slate-400'
  return 'bg-slate-500/20 text-slate-400'
}

const CLOSE_REASON_LABELS: Record<string, string> = {
  kund_accepterade_inte_pris: 'Kund accepterade inte kostnadsförslaget',
  kund_aterkopplade_aldrig: 'Kund återkopplade aldrig',
  lost_vid_inspektion: 'Löst vid inspektion',
  kund_avbokade: 'Kund avbokade',
  kund_ej_narbar: 'Kund ej nåbar',
  dublett: 'Dublett',
  ovrigt: 'Övrigt',
  // Legacy (bakåtkompatibilitet)
  kund_avbojt: 'Kund avböjt',
  lost_utan_atgard: 'Löst utan åtgärd',
}

const CONTRACT_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Offert: Skickad',   color: 'text-amber-400' },
  signed:   { label: 'Avtal: Signerat',   color: 'text-green-400' },
  declined: { label: 'Offert: Avböjt',    color: 'text-red-400' },
  overdue:  { label: 'Offert: Utgången',  color: 'text-red-400' },
  active:   { label: 'Avtal: Aktivt',     color: 'text-green-400' },
  ended:    { label: 'Avtal: Avslutat',   color: 'text-slate-400' },
}

const INVOICE_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  paid:             { label: 'Faktura: Betald',           color: 'text-green-400' },
  sent:             { label: 'Faktura: Skickad',          color: 'text-blue-400' },
  ready:            { label: 'Faktura: Redo',             color: 'text-amber-400' },
  draft:            { label: 'Faktura: Under behandling', color: 'text-yellow-400' },
  pending_approval: { label: 'Faktura: Under behandling', color: 'text-yellow-400' },
}

// ─── Props ──────────────────────────────────────────────

interface CaseCardProps {
  case_: TechnicianCase
  workflowGroup?: WorkflowGroup
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete?: () => void
  onChat?: () => void
  showCheckbox?: boolean
  isChecked?: boolean
  onCheckChange?: (checked: boolean) => void
  showCloseReason?: boolean
  supplementary?: CaseSupplementaryData
}

// ─── Component ──────────────────────────────────────────

export default function CaseCard({
  case_, workflowGroup, isExpanded, onToggle,
  onEdit, onDelete, onChat, showCheckbox, isChecked, onCheckChange,
  showCloseReason, supplementary,
}: CaseCardProps) {
  const age = getDaysAge(case_.created_date)
  const ageBorder = getAgeBorderColor(age)
  const ageColor = getAgeTextColor(age)
  const typeBadge = caseTypeBadge[case_.case_type] || caseTypeBadge.private
  const hint = computeSmartHint(case_, workflowGroup, supplementary)

  // Invoice display: only show if real billing activity
  const hasRealInvoice = !!(
    supplementary?.invoice ||
    case_.billing_status === 'sent' ||
    case_.billing_status === 'paid'
  )
  const invoiceDisplay = supplementary?.invoice
    ? INVOICE_STATUS_DISPLAY[supplementary.invoice.status]
    : case_.billing_status === 'paid'
      ? INVOICE_STATUS_DISPLAY.paid
      : case_.billing_status === 'sent'
        ? INVOICE_STATUS_DISPLAY.sent
        : null

  // Contract/offer display
  const contractDisplay = supplementary?.contract
    ? CONTRACT_STATUS_DISPLAY[supplementary.contract.status]
    : null

  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700/50 border-l-[3px] ${ageBorder} overflow-hidden transition-colors hover:bg-slate-800/70`}>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 min-h-[60px] flex items-start gap-3"
      >
        {showCheckbox && (
          <label className="flex items-center pt-1" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={e => onCheckChange?.(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] bg-slate-800"
            />
          </label>
        )}

        <div className="flex-1 min-w-0">
          {/* Row 1: pest + title + age */}
          <div className="flex items-center gap-2">
            {((case_ as any).service_article?.name || case_.skadedjur) && (
              <span className="shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">
                <Bug className="w-3 h-3" />{(case_ as any).service_article?.name || case_.skadedjur}
              </span>
            )}
            <span className="font-medium text-white truncate">{case_.title}</span>
            <span className={`shrink-0 text-xs font-mono ${ageColor}`}>{age}d</span>
          </div>

          {/* Row 2: customer + phone */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-400 truncate">{case_.kontaktperson || 'Okänd'}</span>
            {case_.telefon_kontaktperson && (
              <a
                href={`tel:${case_.telefon_kontaktperson}`}
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-1.5 -m-1.5 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-[#20c58f]"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            {case_.e_post_kontaktperson && (
              <a
                href={`mailto:${case_.e_post_kontaktperson}`}
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-1.5 -m-1.5 text-slate-400 hover:text-[#20c58f]"
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Row 3: status + type + contract/invoice badges */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
              {case_.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.cls}`}>
              {typeBadge.label}
            </span>
            {contractDisplay && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 ${contractDisplay.color}`}>
                {contractDisplay.label}
              </span>
            )}
            {hasRealInvoice && invoiceDisplay && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 ${invoiceDisplay.color}`}>
                {invoiceDisplay.label}
              </span>
            )}
            {showCloseReason && case_.close_reason && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600/50 text-slate-400">
                {CLOSE_REASON_LABELS[case_.close_reason] || case_.close_reason}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className={`w-5 h-5 text-slate-500 shrink-0 mt-1 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-slate-700/50 space-y-3">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-500">Adress</span>
                  <p className="text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />{formatAddress(case_.adress)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Skapad</span>
                  <p className="text-slate-300">{case_.created_date ? formatDate(case_.created_date) : '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Pris</span>
                  <p className="text-slate-300">{case_.case_price ? formatCurrency(case_.case_price) : 'Ej satt'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Provision</span>
                  <p className="text-green-400 font-medium">{formatCurrency(case_.commission_amount)}</p>
                </div>
                {case_.completed_date && (
                  <div>
                    <span className="text-xs text-slate-500">Avslutad</span>
                    <p className="text-slate-300">{formatDate(case_.completed_date)}</p>
                  </div>
                )}
                {supplementary?.hasBillingItems && (
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-400">Artiklar tillagda</span>
                  </div>
                )}
              </div>

              {/* Smart hint */}
              {hint && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${HINT_COLORS[hint.severity].bg}`}>
                  <span className={HINT_COLORS[hint.severity].label}>Nästa steg:</span>
                  <span className={`font-medium ${HINT_COLORS[hint.severity].text}`}>{hint.text}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onEdit}
                  className="flex-1 min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[#20c58f] hover:bg-[#1ba876] text-white rounded-lg font-medium text-sm transition-colors"
                >
                  <Edit className="w-4 h-4" />Öppna ärende
                </button>
                {onChat && (
                  <button
                    onClick={onChat}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center px-3 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}
                {case_.clickup_url && (
                  <a
                    href={case_.clickup_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center px-3 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
