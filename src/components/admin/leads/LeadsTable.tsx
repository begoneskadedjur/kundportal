// src/components/admin/leads/LeadsTable.tsx - Lead table component

import React from 'react'
import LeadsExpandedRow from './LeadsExpandedRow'
import {
  Target,
  Users,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
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
  getPriorityLabel,
  getPriorityColor
} from '../../../types/database'

interface LeadsTableProps {
  leads: Lead[]
  expandedRows: Set<string>
  sortField: string | null
  sortDirection: 'asc' | 'desc'
  deletingLead: string | null
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
  onToggleExpandRow,
  onSort,
  onViewLead,
  onEditLead,
  onDeleteLead
}) => {
  const getStatusBadge = (status: LeadStatus) => {
    const config = LEAD_STATUS_DISPLAY[status]
    return (
      <div className="flex items-center gap-2" title={config.label}>
        <div className={`w-3 h-3 rounded-full bg-${config.color}`} />
        <span className={`text-sm font-medium text-${config.color}`}>
          {config.label}
        </span>
      </div>
    )
  }

  const getPriorityIndicator = (priority: LeadPriority | null) => {
    if (!priority) {
      return (
        <span className="text-sm text-slate-400" title="Ej angiven">
          Ej angiven
        </span>
      )
    }

    const config = getPriorityColor(priority)
    const label = getPriorityLabel(priority)
    
    // Get priority color classes based on priority level
    const getPriorityDisplay = () => {
      switch (priority) {
        case 'urgent':
          return { color: 'text-red-400', label }
        case 'high':
          return { color: 'text-orange-400', label }
        case 'medium':
          return { color: 'text-yellow-400', label }
        case 'low':
          return { color: 'text-green-400', label }
        default:
          return { color: 'text-slate-400', label }
      }
    }

    const display = getPriorityDisplay()
    return (
      <div className="flex items-center justify-center" title={display.label}>
        <span className={`text-sm font-medium ${display.color}`}>
          {display.label}
        </span>
      </div>
    )
  }

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
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-purple-400" />
      : <ArrowDown className="w-4 h-4 text-purple-400" />
  }

  return (
    <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/70 border-b border-slate-600">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('company_name')}>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-400" />
                  Lead & Kontakt
                  {getSortIcon('company_name')}
                </div>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('status')}>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Status
                  {getSortIcon('status')}
                </div>
              </th>
              <th className="px-4 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden lg:table-cell" onClick={() => onSort('priority')}>
                <div className="flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Prioritet
                  {getSortIcon('priority')}
                </div>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider hidden xl:table-cell">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Tilldelad
                </div>
              </th>
              <th className="px-4 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('estimated_value')}>
                <div className="flex items-center justify-end gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                  Estimerat Värde
                  {getSortIcon('estimated_value')}
                </div>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => onSort('lead_score')}>
                <TooltipWrapper
                  content={
                    <div className="space-y-2">
                      <div className="font-semibold text-yellow-400">Lead Score - Poängberäkning</div>
                      <div className="text-sm space-y-1">
                        <p>Lead Score är en automatisk bedömning av leadets kvalitet och potential baserad på objektiva kriterier.</p>
                        
                        <div className="space-y-2 mt-3">
                          <div className="font-medium text-white">Poängberäkning:</div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                              <span className="font-medium">Specialfall:</span>
                            </div>
                            <div className="pl-4 text-xs space-y-0.5">
                              <div>🟢 Affär: alltid 100p</div>
                              <div>🔴 Förlorad: alltid 0p</div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              <span className="font-medium">Status-poäng (30-50p):</span>
                            </div>
                            <div className="pl-4 text-xs space-y-0.5">
                              <div>🔵 Kall: 30p (basnivå)</div>
                              <div>🟡 Varm: 40p</div>
                              <div>🟠 Het: 50p</div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-400"></div>
                              <span className="font-medium">BANT-kriterier (max 30p):</span>
                            </div>
                            <div className="pl-4 text-xs space-y-0.5">
                              <div>Budget bekräftad: +7.5p</div>
                              <div>Befogenhet bekräftad: +7.5p</div>
                              <div>Behov bekräftat: +7.5p</div>
                              <div>Tidslinje bekräftad: +7.5p</div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                              <span className="font-medium">Sannolikhetsmodifierare (-20 till +20p):</span>
                            </div>
                            <div className="pl-4 text-xs space-y-0.5">
                              <div>0-20%: -20p</div>
                              <div>21-40%: -10p</div>
                              <div>41-60%: 0p (neutral)</div>
                              <div>61-80%: +10p</div>
                              <div>81-100%: +20p</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-1 mt-3 pt-2 border-t border-slate-600">
                          <div className="font-medium text-white">Total poäng: 0-100p (begränsad)</div>
                          <div className="text-xs text-slate-300 mt-1">
                            Formeln: Status-poäng + BANT-poäng + Sannolikhetsmodifierare
                          </div>
                        </div>
                        
                        <div className="space-y-1 mt-3 pt-2 border-t border-slate-600">
                          <div className="font-medium text-white">Kvalitetsnivåer:</div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-400"></div>
                              <span>80-100p: Utmärkt</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              <span>60-79p: Bra</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                              <span>40-59p: Medel</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                              <span>20-39p: Svag</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-400"></div>
                              <span>0-19p: Mycket svag</span>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-300 mt-2">
                          Automatisk beräkning. Högre poäng = större sannolikhet för framgångsrik affär.
                        </p>
                      </div>
                    </div>
                  }
                  position="bottom"
                  delay={300}
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Lead Score
                    <HelpCircle className="w-3 h-3 text-slate-400 hover:text-slate-300 transition-colors" />
                    {getSortIcon('lead_score')}
                  </div>
                </TooltipWrapper>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => onSort('closing_date_estimate')}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Uppskattad deadline
                  {getSortIcon('closing_date_estimate')}
                </div>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => onSort('deal_velocity')}>
                <TooltipWrapper
                  content={
                    <div className="space-y-2">
                      <div className="font-semibold text-orange-400">Deal Velocity - Leadålder</div>
                      <div className="text-sm space-y-1">
                        <p>Visar hur länge leadet har varit aktivt i systemet.</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                            <span>0-14 dagar: Aktiv (Vit text)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <span>15-30 dagar: Långsam (Gul text)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                            <span>30+ dagar + kall/förlorad: Stagnerad (Röd text)</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Flame className="w-3 h-3 text-red-400" />
                            <span>Flamikonen: Deadline inom 7 dagar</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 mt-2">
                          Hjälper dig identifiera leads som behöver omedelbar uppmärksamhet eller riskerar att stagnera.
                        </p>
                      </div>
                    </div>
                  }
                  position="bottom"
                  delay={300}
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Deal Velocity
                    <HelpCircle className="w-3 h-3 text-slate-400 hover:text-slate-300 transition-colors" />
                    {getSortIcon('deal_velocity')}
                  </div>
                </TooltipWrapper>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => onSort('activity_pulse')}>
                <TooltipWrapper
                  content={
                    <div className="space-y-2">
                      <div className="font-semibold text-green-400">Activity Pulse - Aktivitetspuls</div>
                      <div className="text-sm space-y-1">
                        <p>Visar hur många dagar sedan leadet senast uppdaterades.</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            <span>0-1 dag: Aktiv (Grön text)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <span>2-7 dagar: Nylig aktivitet (Gul text)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                            <span>8-30 dagar: Tyst period (Orange text)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                            <span>30+ dagar: Inaktiv (Röd text)</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 mt-2">
                          Aktivitet inkluderar kommentarer, händelser och uppdateringar. 
                          Siffran i parenteserna visar totalt antal aktiviteter.
                        </p>
                      </div>
                    </div>
                  }
                  position="bottom"
                  delay={300}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    Activity Pulse
                    <HelpCircle className="w-3 h-3 text-slate-400 hover:text-slate-300 transition-colors" />
                    {getSortIcon('activity_pulse')}
                  </div>
                </TooltipWrapper>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden md:table-cell" onClick={() => onSort('updated_at')}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Senast Uppdaterad
                  {getSortIcon('updated_at')}
                </div>
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors hidden sm:table-cell" onClick={() => onSort('follow_up_date')}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  Nästa Aktivitet
                  {getSortIcon('follow_up_date')}
                </div>
              </th>
              <th className="px-4 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                <div className="flex items-center justify-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-400" />
                  Åtgärder
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => {
              const isExpanded = expandedRows.has(lead.id)
              return (
                <React.Fragment key={lead.id}>
                  {/* Main lead row */}
                  <tr className={`hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${
                    lead.priority === 'urgent' ? 'border-l-4 border-l-red-500' :
                    lead.priority === 'high' ? 'border-l-4 border-l-orange-400' :
                    lead.priority === 'medium' ? 'border-l-4 border-l-yellow-400' :
                    lead.priority === 'low' ? 'border-l-4 border-l-green-400' : ''
                  }`}>
                    {/* Lead & Kontakt */}
                    <td className="px-4 py-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-white">{lead.company_name}</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onToggleExpandRow(lead.id)}
                                className="text-slate-400 hover:text-white p-1"
                                title="Visa mer information"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`} />
                              </Button>
                            </div>
                            {lead.organization_number && (
                              <div className="text-xs text-slate-400 font-mono">{lead.organization_number}</div>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-white">{lead.contact_person}</span>
                            </div>
                            <div className="space-y-1 text-xs text-slate-400">
                              {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-blue-400 transition-colors duration-200">
                                  <Mail className="w-3 h-3" />
                                  {lead.email}
                                </a>
                              )}
                              {lead.phone_number && (
                                <a href={`tel:${lead.phone_number}`} className="flex items-center gap-1 hover:text-blue-400 transition-colors duration-200">
                                  <Phone className="w-3 h-3" />
                                  {lead.phone_number}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {getStatusBadge(lead.status)}
                    </td>

                    {/* Prioritet */}
                    <td className="px-4 py-4 hidden lg:table-cell text-center">
                      {getPriorityIndicator(lead.priority)}
                    </td>

                    {/* Tilldelad */}
                    <td className="px-4 py-4 hidden xl:table-cell">
                      <div className="space-y-1">
                        {lead.lead_technicians && lead.lead_technicians.length > 0 ? (
                          lead.lead_technicians.map((assignment, idx) => (
                            <div key={assignment.id} className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                assignment.is_primary ? 'bg-yellow-400' : 'bg-green-400'
                              }`} />
                              <span className="text-sm text-white truncate">
                                {assignment.technicians?.name || 'Okänd'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400 italic">Ej tilldelad</span>
                        )}
                      </div>
                    </td>

                    {/* Estimerat Värde */}
                    <td className="px-4 py-4 text-right">
                      {lead.estimated_value ? (
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white font-mono">
                            {formatCurrency(lead.estimated_value)}
                          </div>
                          {lead.probability && (
                            <div className="text-xs text-slate-400">{lead.probability}% sannolikhet</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>

                    {/* Lead Score */}
                    <td className="px-4 py-4">
                      {(() => {
                        const score = calculateLeadScore(lead)
                        const quality = getLeadQuality(score)
                        
                        const getScoreStyle = (score: number) => {
                          if (score >= 80) return {
                            bgColor: 'bg-green-500/20',
                            borderColor: 'border-green-400',
                            textColor: 'text-green-400',
                            labelColor: 'text-green-300'
                          }
                          if (score >= 60) return {
                            bgColor: 'bg-blue-500/20',
                            borderColor: 'border-blue-400',
                            textColor: 'text-blue-400',
                            labelColor: 'text-blue-300'
                          }
                          if (score >= 40) return {
                            bgColor: 'bg-yellow-500/20',
                            borderColor: 'border-yellow-400',
                            textColor: 'text-yellow-400',
                            labelColor: 'text-yellow-300'
                          }
                          if (score >= 20) return {
                            bgColor: 'bg-orange-500/20',
                            borderColor: 'border-orange-400',
                            textColor: 'text-orange-400',
                            labelColor: 'text-orange-300'
                          }
                          return {
                            bgColor: 'bg-red-500/20',
                            borderColor: 'border-red-400',
                            textColor: 'text-red-400',
                            labelColor: 'text-red-300'
                          }
                        }
                        
                        const style = getScoreStyle(score)
                        
                        return (
                          <div className="flex flex-col items-center gap-2">
                            {/* Score Badge */}
                            <div className={`
                              relative px-4 py-2 rounded-lg border-2 transition-all duration-200
                              ${style.bgColor} ${style.borderColor}
                              hover:scale-105 hover:shadow-lg
                            `}>
                              <div className={`text-2xl font-bold font-mono ${style.textColor}`}>
                                {score}
                              </div>
                              {/* Score progress indicator */}
                              <div className="absolute bottom-0 left-0 h-1 bg-slate-700 rounded-b-md overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${style.textColor.replace('text-', 'bg-')}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Quality Label */}
                            <div className={`text-xs font-medium ${style.labelColor} text-center px-2 py-1 rounded-md ${style.bgColor}`}>
                              {quality.label}
                            </div>
                          </div>
                        )
                      })()}
                    </td>

                    {/* Förhoppning slutförande */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {lead.closing_date_estimate ? (
                        <div className="text-sm text-white">
                          {new Date(lead.closing_date_estimate).toLocaleDateString('sv-SE')}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Ej angiven</span>
                      )}
                    </td>

                    {/* Deal Velocity */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {(() => {
                        const leadAge = Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
                        const isUrgent = lead.closing_date_estimate && 
                          Math.floor((new Date(lead.closing_date_estimate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7 &&
                          Math.floor((new Date(lead.closing_date_estimate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) >= 0;
                        const isStagnant = leadAge > 30 && (lead.status === 'blue_cold' || lead.status === 'red_lost');
                        
                        return (
                          <div className="flex items-center gap-2">
                            {isUrgent && <Flame className="w-4 h-4 text-red-400" title="Deadline inom 7 dagar!" />}
                            <div className="space-y-1">
                              <div className={`text-sm font-medium ${
                                isStagnant ? 'text-red-400' :
                                leadAge > 14 ? 'text-yellow-400' :
                                'text-white'
                              }`}>
                                {leadAge} dagar
                              </div>
                              <div className="text-xs text-slate-400">
                                {isStagnant ? 'Stagnerad' :
                                 leadAge > 14 ? 'Långsam' :
                                 'Aktiv'}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Activity Pulse */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {(() => {
                        const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                        const commentCount = (lead.lead_comments?.[0]?.count || 0);
                        const eventCount = (lead.lead_events?.[0]?.count || 0);
                        const totalActivity = commentCount + eventCount;
                        
                        const getActivityColor = (days: number) => {
                          if (days <= 1) return 'text-green-400';
                          if (days <= 7) return 'text-yellow-400';
                          if (days <= 30) return 'text-orange-400';
                          return 'text-red-400';
                        };
                        
                        const getActivityStatus = (days: number) => {
                          if (days <= 1) return 'Aktiv';
                          if (days <= 7) return 'Nylig';
                          if (days <= 30) return 'Tyst';
                          return 'Inaktiv';
                        };
                        
                        return (
                          <div className="space-y-1">
                            <div className={`text-sm font-medium ${getActivityColor(daysSinceUpdate)}`}>
                              {daysSinceUpdate === 0 ? 'Idag' : 
                               daysSinceUpdate === 1 ? 'Igår' : 
                               `${daysSinceUpdate} dagar`}
                            </div>
                            <div className="text-xs text-slate-400">
                              {getActivityStatus(daysSinceUpdate)}
                              {totalActivity > 0 && ` (${totalActivity})`}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Senast Uppdaterad */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="space-y-1">
                        <div className="text-sm text-white">
                          {new Date(lead.updated_at).toLocaleDateString('sv-SE')}
                        </div>
                        <div className="text-xs text-slate-400">
                          {lead.updated_by_profile?.display_name || 
                           lead.updated_by_profile?.email || 
                           lead.created_by_profile?.display_name || 
                           lead.created_by_profile?.email || 
                           'Okänd'}
                        </div>
                      </div>
                    </td>

                    {/* Nästa Aktivitet */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      {lead.follow_up_date ? (
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${
                            new Date(lead.follow_up_date) < new Date() ? 'text-red-400' :
                            new Date(lead.follow_up_date).toDateString() === new Date().toDateString() ? 'text-yellow-400' :
                            'text-white'
                          }`}>
                            {new Date(lead.follow_up_date).toLocaleDateString('sv-SE')}
                          </div>
                          <div className="text-xs text-slate-400">Uppföljning</div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Ej schemalagd</span>
                      )}
                    </td>

                    {/* Åtgärder */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditLead(lead)}
                          className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all duration-200 p-2 rounded-md"
                          title="Redigera lead"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewLead(lead)}
                          className="text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 transition-all duration-200 p-2 rounded-md"
                          title="Visa detaljer"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteLead(lead)}
                          disabled={deletingLead === lead.id}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 p-2 rounded-md disabled:opacity-50"
                          title="Radera lead"
                        >
                          <Trash2 className={`w-4 h-4 ${deletingLead === lead.id ? 'animate-pulse' : ''}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable details row */}
                  <LeadsExpandedRow
                    lead={lead}
                    isExpanded={isExpanded}
                  />
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="text-center py-20 bg-slate-800/20">
            <div className="mx-auto w-fit p-4 rounded-full bg-slate-700/30 border border-slate-600/50 mb-6">
              <Target className="w-16 h-16 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              Inga leads matchar filtren
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              Prova att justera dina sökkriterier för att hitta leads.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default LeadsTable