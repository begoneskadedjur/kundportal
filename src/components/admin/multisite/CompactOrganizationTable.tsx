import React, { useState } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  MoreVertical, 
  CheckCircle2, 
  AlertTriangle,
  Circle,
  Users,
  MapPin,
  TrendingUp,
  Mail,
  Phone,
  Calendar,
  Edit2,
  Trash2,
  XCircle,
  UserPlus,
  Key,
  UserCheck,
  Shield
} from 'lucide-react'
import Button from '../../ui/Button'
import { useNavigate } from 'react-router-dom'

interface Organization {
  id: string
  name: string
  organization_number: string
  organization_id?: string
  billing_address: string
  billing_email: string
  billing_method: 'consolidated' | 'per_site'
  is_active: boolean
  created_at: string
  updated_at: string
  sites_count?: number
  users_count?: number
  total_value?: number
  contract_type?: string
  contract_end_date?: string
  annual_value?: number
  monthly_value?: number
  account_manager?: string
  account_manager_email?: string
  sales_person?: string
  sales_person_email?: string
  sites?: any[]
  contact_phone?: string
  contact_person?: string
  worstPestLevel?: number | null
  worstProblemRating?: number | null
  unacknowledgedCount?: number
  criticalCasesCount?: number
  warningCasesCount?: number
}

interface OrganizationUser {
  id: string
  user_id: string
  organization_id: string
  role_type: string
  is_active: boolean
  created_at: string
  email?: string
  name?: string
  phone?: string
  site_ids?: string[]
}

interface CompactOrganizationTableProps {
  organizations: Organization[]
  organizationUsers: Record<string, OrganizationUser[]>
  onToggleExpand: (org: Organization) => void
  onToggleActive: (org: Organization) => void
  onEdit: (org: Organization) => void
  onDelete: (org: Organization) => void
  onAddUser: (org: Organization) => void
  onEditUser: (org: Organization, user: OrganizationUser) => void
  onDeleteUser: (orgId: string, userId: string) => void
  onResetPassword: (email: string, userName: string) => void
  expandedOrgId: string | null
  getDaysUntilContractEnd: (endDate: string | undefined) => number | null
}

const CompactOrganizationTable: React.FC<CompactOrganizationTableProps> = ({
  organizations,
  organizationUsers,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  expandedOrgId,
  getDaysUntilContractEnd
}) => {
  const navigate = useNavigate()
  const [hoveredOrgId, setHoveredOrgId] = useState<string | null>(null)
  const [showActionsForOrg, setShowActionsForOrg] = useState<string | null>(null)

  // Hjälpfunktion för bekräftelsestatus
  const getAcknowledgmentStatus = (org: Organization) => {
    if (org.unacknowledgedCount && org.unacknowledgedCount > 0) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        text: org.unacknowledgedCount.toString(),
        color: 'text-amber-400',
        borderColor: 'border-l-amber-400',
        tooltip: `${org.unacknowledgedCount} obekräftade rekommendationer`
      }
    }
    
    // Om det finns cases men alla är bekräftade
    if ((org.criticalCasesCount || 0) + (org.warningCasesCount || 0) > 0) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
        text: '',
        color: 'text-green-400',
        borderColor: 'border-l-green-400',
        tooltip: 'Alla rekommendationer bekräftade'
      }
    }
    
    return {
      icon: <Circle className="w-4 h-4 text-slate-600" />,
      text: '',
      color: 'text-slate-600',
      borderColor: 'border-l-slate-600',
      tooltip: 'Inga rekommendationer'
    }
  }

  // Hjälpfunktion för avtalsstatus
  const getContractStatus = (org: Organization) => {
    const daysLeft = getDaysUntilContractEnd(org.contract_end_date)
    
    if (!daysLeft) return { text: '-', color: 'text-slate-400' }
    
    if (daysLeft < 0) {
      return { 
        text: `Utgått`, 
        color: 'text-red-400 font-medium' 
      }
    } else if (daysLeft <= 30) {
      return { 
        text: `${daysLeft} dagar`, 
        color: 'text-amber-400 font-medium' 
      }
    } else if (daysLeft <= 90) {
      return { 
        text: `${daysLeft} dagar`, 
        color: 'text-yellow-400' 
      }
    }
    
    return { 
      text: `${daysLeft} dagar`, 
      color: 'text-slate-300' 
    }
  }

  // Formatera valuta
  const formatCurrency = (value: number | undefined) => {
    if (!value) return '-'
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const getRoleName = (roleType: string) => {
    const roleNames: Record<string, string> = {
      'verksamhetschef': 'Verksamhetschef',
      'quality_manager': 'Verksamhetschef',
      'regionchef': 'Regionchef',
      'regional_manager': 'Regionchef',
      'platsansvarig': 'Platsansvarig',
      'site_manager': 'Platsansvarig'
    }
    return roleNames[roleType] || roleType
  }

  const handleViewDetails = (orgId: string) => {
    navigate(`/admin/organisation/organizations-manage`, { state: { selectedOrgId: orgId } })
  }

  return (
    <div className="w-full">
      {/* Tabellhuvud */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-t-lg">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <div className="col-span-1">Status</div>
          <div className="col-span-3">Organisation</div>
          <div className="col-span-1 text-center">Enheter</div>
          <div className="col-span-1 text-center">Användare</div>
          <div className="col-span-2 text-right">Totalt värde</div>
          <div className="col-span-2 text-right">Årspremie</div>
          <div className="col-span-1 text-right">Avtal</div>
          <div className="col-span-1 text-center">Åtgärder</div>
        </div>
      </div>

      {/* Tabellkropp */}
      <div className="border-x border-b border-slate-700 rounded-b-lg overflow-hidden">
        {organizations.map((org, index) => {
          const ackStatus = getAcknowledgmentStatus(org)
          const contractStatus = getContractStatus(org)
          const isExpanded = expandedOrgId === org.id
          const isHovered = hoveredOrgId === org.id
          const showActions = showActionsForOrg === org.id

          return (
            <div key={org.id} className={index > 0 ? 'border-t border-slate-700' : ''}>
              {/* Kompakt rad */}
              <div
                className={`
                  grid grid-cols-12 gap-2 px-4 py-2.5 items-center
                  border-l-4 ${ackStatus.borderColor}
                  ${isHovered ? 'bg-slate-800/30' : ''}
                  ${!org.is_active ? 'opacity-60' : ''}
                  transition-all duration-200 cursor-pointer
                `}
                onMouseEnter={() => setHoveredOrgId(org.id)}
                onMouseLeave={() => setHoveredOrgId(null)}
                onClick={() => onToggleExpand(org)}
              >
                {/* Status */}
                <div className="col-span-1 flex items-center gap-1" title={ackStatus.tooltip}>
                  {ackStatus.icon}
                  {ackStatus.text && (
                    <span className={`text-xs font-medium ${ackStatus.color}`}>
                      {ackStatus.text}
                    </span>
                  )}
                </div>

                {/* Organisation */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm truncate">
                        {org.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {org.organization_number}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enheter */}
                <div className="col-span-1 text-center text-sm text-slate-300">
                  {org.sites_count || 0}
                </div>

                {/* Användare */}
                <div className="col-span-1 text-center text-sm text-slate-300">
                  {org.users_count || 0}
                </div>

                {/* Totalt värde */}
                <div className="col-span-2 text-right text-sm font-medium text-white">
                  {formatCurrency(org.total_value)}
                </div>

                {/* Årspremie */}
                <div className="col-span-2 text-right text-sm text-slate-300">
                  {formatCurrency(org.annual_value)}
                </div>

                {/* Avtal */}
                <div className={`col-span-1 text-right text-sm ${contractStatus.color}`}>
                  {contractStatus.text}
                </div>

                {/* Åtgärder */}
                <div 
                  className="col-span-1 flex justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowActionsForOrg(showActions ? null : org.id)
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {showActions && (
                      <div className="absolute right-0 top-8 z-10 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1">
                        <button
                          onClick={() => {
                            onEdit(org)
                            setShowActionsForOrg(null)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Redigera
                        </button>
                        <button
                          onClick={() => {
                            onToggleActive(org)
                            setShowActionsForOrg(null)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        >
                          {org.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          {org.is_active ? 'Inaktivera' : 'Aktivera'}
                        </button>
                        <button
                          onClick={() => {
                            onDelete(org)
                            setShowActionsForOrg(null)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Ta bort
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanderad sektion */}
              {isExpanded && (
                <div className="bg-slate-900/50 border-t border-slate-700 px-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Kontaktinformation */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Kontaktinformation</h4>
                      <div className="space-y-2 text-sm">
                        {org.billing_email && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Mail className="w-4 h-4" />
                            <span>{org.billing_email}</span>
                          </div>
                        )}
                        {org.contact_phone && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-4 h-4" />
                            <span>{org.contact_phone}</span>
                          </div>
                        )}
                        {org.contact_person && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <UserCheck className="w-4 h-4" />
                            <span>{org.contact_person}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Affärsdata */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Affärsdata</h4>
                      <div className="space-y-2 text-sm">
                        {org.account_manager && (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Account Manager:</span> {org.account_manager}
                          </div>
                        )}
                        {org.sales_person && (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Säljare:</span> {org.sales_person}
                          </div>
                        )}
                        {org.contract_type && (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Avtalstyp:</span> {org.contract_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Användare */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        Användare ({organizationUsers[org.id]?.length || 0})
                      </h4>
                      <Button
                        onClick={() => onAddUser(org)}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="w-3 h-3" />
                        Lägg till användare
                      </Button>
                    </div>

                    {organizationUsers[org.id] && organizationUsers[org.id].length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {organizationUsers[org.id].map(user => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-purple-500/20 rounded">
                                <UserCheck className="w-3 h-3 text-purple-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                              </div>
                              <span className="text-xs text-blue-400 ml-2">
                                {getRoleName(user.role_type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onResetPassword(user.email || '', user.name || '')}
                                className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                                title="Återställ lösenord"
                              >
                                <Key className="w-3 h-3 text-purple-400" />
                              </button>
                              <button
                                onClick={() => onEditUser(org, user)}
                                className="p-1 hover:bg-slate-700 rounded transition-colors"
                                title="Redigera"
                              >
                                <Edit2 className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                onClick={() => onDeleteUser(org.id, user.id)}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                title="Ta bort"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Inga användare registrerade
                      </p>
                    )}
                  </div>

                  {/* Visa fullständig hantering */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <Button
                      onClick={() => handleViewDetails(org.id)}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      Visa fullständig organisationshantering
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CompactOrganizationTable