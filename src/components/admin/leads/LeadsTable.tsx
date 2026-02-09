// src/components/admin/leads/LeadsTable.tsx - Lead table component (kompakt 7-kolumn layout)

import React from 'react'
import LeadsExpandedRow from './LeadsExpandedRow'
import {
  Target,
  Users,
  User,
  Calendar,
  Flame,
  Star,
  DollarSign,
  Edit3,
  Eye,
  ChevronDown,
  Activity,
  Building,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Trash2,
  Clock
} from 'lucide-react'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import TooltipWrapper from '../../ui/TooltipWrapper'
import {
  Lead,
  LeadStatus,
  LeadPriority,
  LEAD_STATUS_DISPLAY,
  calculateLeadScore,
  getLeadQuality,
  getPriorityLabel
} from '../../../types/database'

interface LeadsTableProps {
  leads: Lead[]
  expandedRows: Set<string>
  sortField: string | null
  sortDirection: 'asc' | 'desc'
  deletingLead: string | null
  visibleColumns: Set<string>
  onToggleExpandRow: (leadId: string) => void
  onSort: (field: string) => void
  onViewLead: (lead: Lead) => void
  onEditLead: (lead: Lead) => void
  onDeleteLead: (lead: Lead) => void
}

const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  expandedRows,
  sortField,
  sortDirection,
  deletingLead,
  visibleColumns,
  onToggleExpandRow,
  onSort,
  onViewLead,
  onEditLead,
  onDeleteLead
}) => {
  const isVisible = (col: string) => visibleColumns.has(col)

  const visibleCount = visibleColumns.size

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-purple-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/15' }
    if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500/15' }
    if (score >= 40) return { text: 'text-yellow-400', bg: 'bg-yellow-500/15' }
    if (score >= 20) return { text: 'text-orange-400', bg: 'bg-orange-500/15' }
    return { text: 'text-red-400', bg: 'bg-red-500/15' }
  }

  const getActivityColor = (days: number) => {
    if (days <= 1) return 'text-green-400'
    if (days <= 7) return 'text-yellow-400'
    if (days <= 30) return 'text-orange-400'
    return 'text-red-400'
  }

  const getActivityLabel = (days: number) => {
    if (days === 0) return 'Idag'
    if (days === 1) return 'Igår'
    return `${days}d`
  }

  return (
    <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-slate-800/95 backdrop-blur border-b border-slate-600 sticky top-0 z-10">
            <tr>
              {/* Lead & Kontakt — always visible, required */}
              <th className="w-[28%] px-3 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('company_name')}>
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-400" />
                  Lead & Kontakt
                  {getSortIcon('company_name')}
                </div>
              </th>

              {/* Status & Score */}
              {isVisible('statusScore') && (
                <th className="w-[13%] px-3 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('status')}>
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    Status & Score
                    {getSortIcon('status')}
                  </div>
                </th>
              )}

              {/* Prioritet (valfri kolumn) */}
              {isVisible('priority') && (
                <th className="w-[8%] px-2 py-2.5 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('priority')}>
                  <div className="flex items-center justify-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    Prioritet
                    {getSortIcon('priority')}
                  </div>
                </th>
              )}

              {/* Tilldelad */}
              {isVisible('assigned') && (
                <th className="w-[13%] px-3 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-green-400" />
                    Tilldelad
                  </div>
                </th>
              )}

              {/* Värde */}
              {isVisible('value') && (
                <th className="w-[10%] px-3 py-2.5 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('estimated_value')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                    Värde
                    {getSortIcon('estimated_value')}
                  </div>
                </th>
              )}

              {/* Nästa steg */}
              {isVisible('nextStep') && (
                <th className="w-[10%] px-3 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('follow_up_date')}>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    Nästa steg
                    {getSortIcon('follow_up_date')}
                  </div>
                </th>
              )}

              {/* Aktivitet */}
              {isVisible('activity') && (
                <th className="w-[8%] px-2 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('activity_pulse')}>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-green-400" />
                    Aktivitet
                    {getSortIcon('activity_pulse')}
                  </div>
                </th>
              )}

              {/* Deal Velocity (valfri) */}
              {isVisible('dealVelocity') && (
                <th className="w-[8%] px-2 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('deal_velocity')}>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    Velocity
                    {getSortIcon('deal_velocity')}
                  </div>
                </th>
              )}

              {/* Uppskattad deadline (valfri) */}
              {isVisible('closingDate') && (
                <th className="w-[8%] px-2 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('closing_date_estimate')}>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    Deadline
                    {getSortIcon('closing_date_estimate')}
                  </div>
                </th>
              )}

              {/* Senast uppdaterad (valfri) */}
              {isVisible('lastUpdated') && (
                <th className="w-[8%] px-2 py-2.5 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('updated_at')}>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Uppdaterad
                    {getSortIcon('updated_at')}
                  </div>
                </th>
              )}

              {/* Åtgärder — always visible, required */}
              <th className="w-24 px-2 py-2.5 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                Åtgärder
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isExpanded = expandedRows.has(lead.id)
              const score = calculateLeadScore(lead)
              const quality = getLeadQuality(score)
              const scoreColor = getScoreColor(score)
              const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))
              const commentCount = lead.lead_comments?.[0]?.count || 0
              const eventCount = lead.lead_events?.[0]?.count || 0
              const totalActivity = commentCount + eventCount

              return (
                <React.Fragment key={lead.id}>
                  <tr className={`hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${
                    lead.priority === 'urgent' ? 'border-l-4 border-l-red-500' :
                    lead.priority === 'high' ? 'border-l-4 border-l-orange-400' :
                    lead.priority === 'medium' ? 'border-l-4 border-l-yellow-400' :
                    lead.priority === 'low' ? 'border-l-4 border-l-green-400' : ''
                  }`}>
                    {/* Lead & Kontakt */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleExpandRow(lead.id)}
                          className="text-slate-400 hover:text-white p-0.5 flex-shrink-0"
                          title="Visa mer information"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{lead.company_name}</div>
                          {lead.organization_number && (
                            <div className="text-xs text-slate-500 font-mono">{lead.organization_number}</div>
                          )}
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span className="text-xs text-slate-400 truncate">{lead.contact_person}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status & Score */}
                    {isVisible('statusScore') && (
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full bg-${LEAD_STATUS_DISPLAY[lead.status].color}`} />
                            <span className={`text-xs font-medium text-${LEAD_STATUS_DISPLAY[lead.status].color}`}>
                              {LEAD_STATUS_DISPLAY[lead.status].label}
                            </span>
                          </div>
                          <TooltipWrapper
                            content={
                              <div className="space-y-1 text-xs">
                                <div className="font-semibold text-yellow-400">Lead Score: {score}/100</div>
                                <div>Kvalitet: {quality.label}</div>
                              </div>
                            }
                            position="bottom"
                            delay={300}
                          >
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${scoreColor.bg} ${scoreColor.text}`}>
                              <Star className="w-3 h-3" />
                              {score} {quality.label}
                            </span>
                          </TooltipWrapper>
                        </div>
                      </td>
                    )}

                    {/* Prioritet (valfri) */}
                    {isVisible('priority') && (
                      <td className="px-2 py-2.5 text-center">
                        {lead.priority ? (
                          <span className={`text-xs font-medium ${
                            lead.priority === 'urgent' ? 'text-red-400' :
                            lead.priority === 'high' ? 'text-orange-400' :
                            lead.priority === 'medium' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {getPriorityLabel(lead.priority)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    )}

                    {/* Tilldelad */}
                    {isVisible('assigned') && (
                      <td className="px-3 py-2.5">
                        {lead.lead_technicians && lead.lead_technicians.length > 0 ? (
                          <div className="space-y-0.5">
                            {lead.lead_technicians.slice(0, 2).map((assignment) => (
                              <div key={assignment.id} className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  assignment.is_primary ? 'bg-yellow-400' : 'bg-green-400'
                                }`} />
                                <span className="text-xs text-white truncate max-w-[100px]">
                                  {assignment.technicians?.name || 'Okänd'}
                                </span>
                              </div>
                            ))}
                            {lead.lead_technicians.length > 2 && (
                              <span className="text-xs text-slate-500">+{lead.lead_technicians.length - 2} till</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Ej tilldelad</span>
                        )}
                      </td>
                    )}

                    {/* Värde */}
                    {isVisible('value') && (
                      <td className="px-3 py-2.5 text-right">
                        {lead.estimated_value ? (
                          <div>
                            <div className="text-sm font-semibold text-white font-mono">
                              {formatCurrency(lead.estimated_value)}
                            </div>
                            {lead.probability != null && (
                              <div className="text-xs text-slate-500">{lead.probability}%</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    )}

                    {/* Nästa steg */}
                    {isVisible('nextStep') && (
                      <td className="px-3 py-2.5">
                        {lead.follow_up_date ? (
                          <span className={`text-xs font-medium ${
                            new Date(lead.follow_up_date) < new Date() ? 'text-red-400' :
                            new Date(lead.follow_up_date).toDateString() === new Date().toDateString() ? 'text-yellow-400' :
                            'text-white'
                          }`}>
                            {new Date(lead.follow_up_date).toLocaleDateString('sv-SE')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Ej schemalagd</span>
                        )}
                      </td>
                    )}

                    {/* Aktivitet */}
                    {isVisible('activity') && (
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium ${getActivityColor(daysSinceUpdate)}`}>
                            {getActivityLabel(daysSinceUpdate)}
                          </span>
                          {totalActivity > 0 && (
                            <span className="text-xs text-slate-500">({totalActivity})</span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Deal Velocity (valfri) */}
                    {isVisible('dealVelocity') && (() => {
                      const leadAge = Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
                      const isStagnant = leadAge > 30 && (lead.status === 'blue_cold' || lead.status === 'red_lost')
                      return (
                        <td className="px-2 py-2.5">
                          <span className={`text-xs font-medium ${
                            isStagnant ? 'text-red-400' :
                            leadAge > 14 ? 'text-yellow-400' :
                            'text-white'
                          }`}>
                            {leadAge}d
                          </span>
                        </td>
                      )
                    })()}

                    {/* Uppskattad deadline (valfri) */}
                    {isVisible('closingDate') && (
                      <td className="px-2 py-2.5">
                        {lead.closing_date_estimate ? (
                          <span className="text-xs text-white">
                            {new Date(lead.closing_date_estimate).toLocaleDateString('sv-SE')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    )}

                    {/* Senast uppdaterad (valfri) */}
                    {isVisible('lastUpdated') && (
                      <td className="px-2 py-2.5">
                        <div>
                          <div className="text-xs text-white">
                            {new Date(lead.updated_at).toLocaleDateString('sv-SE')}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[80px]">
                            {lead.updated_by_profile?.display_name ||
                             lead.updated_by_profile?.email ||
                             'Okänd'}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Åtgärder */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewLead(lead)}
                          className="text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 p-1.5 rounded-md"
                          title="Visa detaljer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditLead(lead)}
                          className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 p-1.5 rounded-md"
                          title="Redigera lead"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteLead(lead)}
                          disabled={deletingLead === lead.id}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-md disabled:opacity-50"
                          title="Radera lead"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingLead === lead.id ? 'animate-pulse' : ''}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable details row */}
                  <LeadsExpandedRow
                    lead={lead}
                    isExpanded={isExpanded}
                    colSpan={visibleCount}
                  />
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="text-center py-16 bg-slate-800/20">
            <div className="mx-auto w-fit p-3 rounded-full bg-slate-700/30 border border-slate-600/50 mb-4">
              <Target className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-300 mb-1">
              Inga leads matchar filtren
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Prova att justera dina sökkriterier för att hitta leads.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default LeadsTable
