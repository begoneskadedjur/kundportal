// src/components/admin/leads/LeadsExpandedRow.tsx - Expandable row component

import React from 'react'
import {
  Building,
  CheckCircle,
  Activity,
  MessageSquare
} from 'lucide-react'
import {
  Lead,
  CONTACT_METHOD_DISPLAY,
  COMPANY_SIZE_DISPLAY
} from '../../../types/database'

interface LeadsExpandedRowProps {
  lead: Lead
  isExpanded: boolean
}

const LeadsExpandedRow: React.FC<LeadsExpandedRowProps> = ({
  lead,
  isExpanded
}) => {
  if (!isExpanded) return null

  return (
    <tr className="bg-slate-800/30 border-b border-slate-700/30">
      <td colSpan={13} className="px-6 py-4 border-l-4 border-purple-400/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Affärsinformation */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              Affärsinformation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Källa:</span>
                <span className="text-white">{lead.source || 'Ej angiven'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kontaktmetod:</span>
                <span className="text-white">
                  {lead.contact_method ? CONTACT_METHOD_DISPLAY[lead.contact_method]?.label || lead.contact_method : 'Ej angiven'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Företagsstorlek:</span>
                <span className="text-white">
                  {lead.company_size ? COMPANY_SIZE_DISPLAY[lead.company_size]?.label || lead.company_size : 'Ej angiven'}
                </span>
              </div>
              {lead.contract_with && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Nuvarande leverantör:</span>
                  <span className="text-white">{lead.contract_with}</span>
                </div>
              )}
              {lead.contract_end_date && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Avtal löper ut:</span>
                  <span className="text-white">
                    {new Date(lead.contract_end_date).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* BANT-kriterier och kvalifikation */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Kvalifikation (BANT)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Budget bekräftad:</span>
                <span className={lead.budget_confirmed ? 'text-green-400' : 'text-slate-400'}>
                  {lead.budget_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Befogenhet bekräftad:</span>
                <span className={lead.authority_confirmed ? 'text-green-400' : 'text-slate-400'}>
                  {lead.authority_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Behov bekräftat:</span>
                <span className={lead.needs_confirmed ? 'text-green-400' : 'text-slate-400'}>
                  {lead.needs_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tidslinje bekräftad:</span>
                <span className={lead.timeline_confirmed ? 'text-green-400' : 'text-slate-400'}>
                  {lead.timeline_confirmed ? '✓' : '✗'}
                </span>
              </div>
              {lead.probability && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Sannolikhet:</span>
                  <span className="text-white font-mono">{lead.probability}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Aktivitet och tidslinje */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Aktivitet & Tidslinje
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Kommentarer:</span>
                <span className="text-white">{lead.lead_comments?.[0]?.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Händelser:</span>
                <span className="text-white">{lead.lead_events?.[0]?.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Skapad:</span>
                <span className="text-white">
                  {new Date(lead.created_at).toLocaleDateString('sv-SE')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Skapad av:</span>
                <span className="text-white">
                  {lead.created_by_profile?.display_name || lead.created_by_profile?.email || 'Okänd'}
                </span>
              </div>
              {lead.tags && lead.tags.length > 0 && (
                <div className="flex justify-between items-start">
                  <span className="text-slate-400">Taggar:</span>
                  <div className="flex flex-wrap gap-1 max-w-32">
                    {lead.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Anteckningar */}
        {lead.notes && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              Anteckningar
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {lead.notes}
            </p>
          </div>
        )}
      </td>
    </tr>
  )
}

export default LeadsExpandedRow