import React from 'react'
import {
  Phone, Mail, ExternalLink, MapPin, ChevronRight, XCircle, Edit,
  CalendarPlus, CalendarCheck, FileText, RotateCcw, AlertTriangle,
  FileCheck, Bug
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import type { TechnicianCase, WorkflowGroup } from '../../../pages/technician/TechnicianCases'

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

function getNextStepHint(group: WorkflowGroup, c: TechnicianCase): string {
  switch (group) {
    case 'needs_booking': return 'Boka in besök'
    case 'booked': {
      if (c.due_date && new Date(c.due_date) < new Date()) return 'Försenat besök!'
      return 'Genomför besök'
    }
    case 'offer_sent': return 'Väntar på kundsvar'
    case 'revisit': return 'Återbesök planerat'
    case 'needs_action': {
      const s = c.status?.toLowerCase() || ''
      if (s.includes('bomkörning')) return 'Bomkörning – kontakta kund'
      if (s.includes('ombokning')) return 'Hantera ombokning'
      if (s.includes('reklamation')) return 'Hantera reklamation'
      if (s.includes('review')) return 'Inväntar granskning'
      return 'Kräver åtgärd'
    }
    case 'report': return 'Generera saneringsrapport'
    default: return ''
  }
}

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
  kund_ej_narbar: 'Kund ej nåbar',
  kund_avbojt: 'Kund avböjt',
  dublett: 'Dublett',
  lost_utan_atgard: 'Löst utan åtgärd',
  ovrigt: 'Övrigt',
}

// ─── Props ──────────────────────────────────────────────

interface CaseCardProps {
  case_: TechnicianCase
  workflowGroup?: WorkflowGroup
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onClose?: () => void
  showCheckbox?: boolean
  isChecked?: boolean
  onCheckChange?: (checked: boolean) => void
  showCloseReason?: boolean
}

// ─── Component ──────────────────────────────────────────

export default function CaseCard({
  case_, workflowGroup, isExpanded, onToggle,
  onEdit, onClose, showCheckbox, isChecked, onCheckChange,
  showCloseReason,
}: CaseCardProps) {
  const age = getDaysAge(case_.created_date)
  const ageBorder = getAgeBorderColor(age)
  const ageColor = getAgeTextColor(age)
  const typeBadge = caseTypeBadge[case_.case_type] || caseTypeBadge.private
  const hint = workflowGroup ? getNextStepHint(workflowGroup, case_) : ''

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
            {case_.skadedjur && (
              <span className="shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">
                <Bug className="w-3 h-3" />{case_.skadedjur}
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

          {/* Row 3: status + type badges */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
              {case_.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.cls}`}>
              {typeBadge.label}
            </span>
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
                  <p className="text-slate-300">{formatCurrency(case_.case_price)}</p>
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
                {case_.billing_status && case_.billing_status !== 'skip' && (
                  <div>
                    <span className="text-xs text-slate-500">Faktura</span>
                    <p className={
                      case_.billing_status === 'paid' ? 'text-green-400' :
                      case_.billing_status === 'sent' ? 'text-blue-400' : 'text-yellow-400'
                    }>
                      {case_.billing_status === 'paid' ? 'Betald' : case_.billing_status === 'sent' ? 'Skickad' : 'Väntande'}
                    </p>
                  </div>
                )}
              </div>

              {/* Next step hint */}
              {hint && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg text-sm">
                  <span className="text-slate-500">Nästa steg:</span>
                  <span className="text-white font-medium">{hint}</span>
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
                {onClose && (
                  <button
                    onClick={onClose}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
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
