// src/components/admin/leads/LeadsExpandedRow.tsx - Expandable row with full lead details

import React from 'react'
import {
  Building,
  CheckCircle,
  Activity,
  MessageSquare,
  Mail,
  Phone,
  Clock,
  Flame,
  Calendar,
  Tag
} from 'lucide-react'
import {
  Lead,
  CONTACT_METHOD_DISPLAY,
  COMPANY_SIZE_DISPLAY
} from '../../../types/database'

interface LeadsExpandedRowProps {
  lead: Lead
  isExpanded: boolean
  colSpan?: number
}

const LeadsExpandedRow: React.FC<LeadsExpandedRowProps> = ({
  lead,
  isExpanded,
  colSpan = 8
}) => {
  if (!isExpanded) return null

  const leadAge = Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const isStagnant = leadAge > 30 && (lead.status === 'blue_cold' || lead.status === 'red_lost')
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <tr className="bg-slate-800/30 border-b border-slate-700/30">
      <td colSpan={colSpan} className="px-6 py-4 border-l-4 border-purple-400/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Sektion 1: Kontakt & Affärsinformation */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              Kontakt & Affärsinfo
            </h4>
            <div className="space-y-2 text-sm">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </a>
              )}
              {lead.phone_number && (
                <a href={`tel:${lead.phone_number}`} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{lead.phone_number}</span>
                </a>
              )}
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

          {/* Sektion 2: BANT-kriterier */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Kvalifikation (BANT)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Budget bekräftad:</span>
                <span className={lead.budget_confirmed ? 'text-green-400' : 'text-slate-500'}>
                  {lead.budget_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Befogenhet bekräftad:</span>
                <span className={lead.authority_confirmed ? 'text-green-400' : 'text-slate-500'}>
                  {lead.authority_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Behov bekräftat:</span>
                <span className={lead.needs_confirmed ? 'text-green-400' : 'text-slate-500'}>
                  {lead.needs_confirmed ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tidslinje bekräftad:</span>
                <span className={lead.timeline_confirmed ? 'text-green-400' : 'text-slate-500'}>
                  {lead.timeline_confirmed ? '✓' : '✗'}
                </span>
              </div>
              {lead.probability != null && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Sannolikhet:</span>
                  <span className="text-white font-mono">{lead.probability}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Sektion 3: Tidslinje & Velocity */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Tidslinje & Velocity
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Leadålder:</span>
                <span className={`font-medium ${
                  isStagnant ? 'text-red-400' :
                  leadAge > 14 ? 'text-yellow-400' :
                  'text-white'
                }`}>
                  {leadAge} dagar {isStagnant ? '(Stagnerad)' : leadAge > 14 ? '(Långsam)' : '(Aktiv)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Senast uppdaterad:</span>
                <span className="text-white">
                  {daysSinceUpdate === 0 ? 'Idag' : daysSinceUpdate === 1 ? 'Igår' : `${daysSinceUpdate} dagar sedan`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Uppdaterad av:</span>
                <span className="text-white">
                  {lead.updated_by_profile?.display_name || lead.updated_by_profile?.email || 'Okänd'}
                </span>
              </div>
              {lead.closing_date_estimate && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Deadline:</span>
                  <span className="text-white">
                    {new Date(lead.closing_date_estimate).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              )}
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
              <div className="flex justify-between">
                <span className="text-slate-400">Kommentarer:</span>
                <span className="text-white">{lead.lead_comments?.[0]?.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Händelser:</span>
                <span className="text-white">{lead.lead_events?.[0]?.count || 0}</span>
              </div>
            </div>
          </div>

          {/* Sektion 4: Anteckningar & Taggar */}
          <div className="space-y-3">
            {lead.tags && lead.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-blue-400" />
                  Taggar
                </h4>
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {lead.notes && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  Anteckningar
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {lead.notes}
                </p>
              </div>
            )}
            {!lead.notes && (!lead.tags || lead.tags.length === 0) && (
              <div className="text-sm text-slate-500 italic">Inga anteckningar eller taggar</div>
            )}
          </div>

        </div>
      </td>
    </tr>
  )
}

export default LeadsExpandedRow
