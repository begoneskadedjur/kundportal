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
  Shield,
  Building2,
  Plus
} from 'lucide-react'
import Button from '../../ui/Button'
import { useNavigate } from 'react-router-dom'
import { getTemplateById } from '../../../constants/oneflowTemplates'
import UnacknowledgedRecommendationsModal from './UnacknowledgedRecommendationsModal'

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
  // Organisationstyp för unified view
  organizationType?: 'multisite' | 'single'
  // Avtalsinfo
  contract_type?: string
  contract_end_date?: string
  contract_length?: number
  annual_value?: number
  monthly_value?: number
  account_manager?: string
  account_manager_email?: string
  sales_person?: string
  sales_person_email?: string
  // Enheter
  sites?: any[]
  contact_phone?: string
  contact_person?: string
  // Trafikljusdata
  worstPestLevel?: number | null
  worstProblemRating?: number | null
  unacknowledgedCount?: number
  criticalCasesCount?: number
  warningCasesCount?: number
  // Portal access fält (för kompatibilitet)
  portalAccessStatus?: 'full' | 'partial' | 'none'
  activeUsersCount?: number
  hasLoggedIn?: boolean
  lastLoginDate?: string
  primary_contact_email?: string
  primary_contact_phone?: string
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

interface Site {
  id: string
  site_name: string
  site_code: string
  region: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  billing_email?: string
  is_active: boolean
}

interface CompactOrganizationTableProps {
  organizations: Organization[]
  organizationUsers: Record<string, OrganizationUser[]>
  organizationSites: Record<string, Site[]>
  onToggleExpand: (org: Organization) => void
  onToggleActive: (org: Organization) => void
  onEdit: (org: Organization) => void
  onDelete: (org: Organization) => void
  onAddUser: (org: Organization) => void
  onEditUser: (org: Organization, user: OrganizationUser) => void
  onDeleteUser: (orgId: string, userId: string) => void
  onResetPassword: (email: string, userName: string) => void
  onAddSite: (org: Organization) => void
  onEditSite: (org: Organization, site: Site) => void
  onDeleteSite: (orgId: string, siteId: string) => void
  expandedOrgId: string | null
  getDaysUntilContractEnd: (endDate: string | undefined) => number | null
  formatContractLength: (length: number | null | undefined) => string
  // Nya callbacks för portal-hantering
  onInviteToPortal?: (org: Organization) => void
  onViewMultiSiteDetails?: (org: Organization) => void
  onViewSingleCustomerDetails?: (org: Organization) => void
}

// Mappning för contract_types från databasen
const CONTRACT_TYPE_MAPPING: Record<string, string> = {
  '242dff01-ecf7-4de1-ab5f-7fad11cb8812': 'Skadedjursavtal',
  '21ed7bc7-e767-48e3-b981-4305b1ae7141': 'Betongstationer',
  '37eeca21-f8b3-45f7-810a-7f616f84e71e': 'Mekaniska råttfällor',
  '73c7c42b-a302-4da2-abf2-8d6080045bc8': 'Fågelavtal',
  'bc612355-b6ce-4ca8-82cd-4f82a8538b71': 'Avloppsfällor',
  'e3a610c9-15b9-42fe-8085-d0a7e17d4465': 'Betesstationer',
  '3d749768-63be-433f-936d-be070edf4876': 'Avrop - 2.490kr'
}

const CompactOrganizationTable: React.FC<CompactOrganizationTableProps> = ({
  organizations,
  organizationUsers,
  organizationSites,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  onAddSite,
  onEditSite,
  onDeleteSite,
  expandedOrgId,
  getDaysUntilContractEnd,
  formatContractLength,
  onInviteToPortal,
  onViewMultiSiteDetails,
  onViewSingleCustomerDetails
}) => {
  const navigate = useNavigate()
  const [hoveredOrgId, setHoveredOrgId] = useState<string | null>(null)
  const [showActionsForOrg, setShowActionsForOrg] = useState<string | null>(null)
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false)
  const [selectedOrgForModal, setSelectedOrgForModal] = useState<Organization | null>(null)

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
    
    if (!daysLeft || !org.contract_end_date) return { text: '-', color: 'text-slate-400' }
    
    if (daysLeft < 0) {
      return { 
        text: `Utgått`, 
        color: 'text-red-400 font-medium' 
      }
    } else if (daysLeft <= 30) {
      // Visa i dagar om mindre än 30 dagar
      return { 
        text: `${daysLeft} dagar`, 
        color: 'text-amber-400 font-medium' 
      }
    } else if (daysLeft <= 90) {
      // Beräkna exakta månader för kort tid
      const today = new Date()
      const endDate = new Date(org.contract_end_date)
      
      let months = 0
      const tempDate = new Date(today)
      
      while (tempDate < endDate) {
        tempDate.setMonth(tempDate.getMonth() + 1)
        if (tempDate <= endDate) {
          months++
        }
      }
      
      return { 
        text: `${months} mån`, 
        color: 'text-yellow-400' 
      }
    } else {
      // Visa datum för längre tid
      const endDate = new Date(org.contract_end_date)
      const formattedDate = endDate.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      return { 
        text: formattedDate, 
        color: 'text-slate-300' 
      }
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

  // Hjälpfunktion för att hämta avtalsnamn
  const getContractTypeName = (contractType: string | undefined) => {
    if (!contractType) return null
    
    // Kolla först om det är en UUID från contract_types tabellen
    if (CONTRACT_TYPE_MAPPING[contractType]) {
      return CONTRACT_TYPE_MAPPING[contractType]
    }
    
    // Fallback till OneFlow templates
    const template = getTemplateById(contractType)
    if (template) {
      return template.name
    }
    
    // Om det redan är ett namn (inte UUID), returnera det
    if (!contractType.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return contractType
    }
    
    return contractType
  }

  const handleViewDetails = (orgId: string) => {
    navigate(`/admin/organisation/organizations-manage`, { state: { selectedOrgId: orgId } })
  }

  return (
    <>
      <div className="w-full">
      {/* Tabellhuvud */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-t-lg">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Kund</div>
          <div className="col-span-1 text-center">Enheter</div>
          <div className="col-span-1 text-center">Portal</div>
          <div className="col-span-2 text-right">Årspremie</div>
          <div className="col-span-2 text-right">Totalt värde</div>
          <div className="col-span-1 text-center">Längd</div>
          <div className="col-span-1 text-right">Löper ut</div>
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
                  grid grid-cols-12 gap-3 px-4 py-2.5 items-center
                  border-l-4 ${ackStatus.borderColor}
                  ${isHovered ? 'bg-slate-800/30' : ''}
                  ${!org.is_active ? 'opacity-60' : ''}
                  transition-all duration-200 cursor-pointer
                `}
                onMouseEnter={() => setHoveredOrgId(org.id)}
                onMouseLeave={() => setHoveredOrgId(null)}
                onClick={() => {
                  onToggleExpand(org)
                  // Stäng åtgärdsmenyn om kortet kollapsas
                  if (expandedOrgId === org.id) {
                    setShowActionsForOrg(null)
                  }
                }}
              >
                {/* Status */}
                <div 
                  className={`col-span-1 flex items-center gap-1 ${
                    org.unacknowledgedCount > 0 ? 'cursor-pointer hover:opacity-80' : ''
                  }`}
                  title={ackStatus.tooltip}
                  onClick={(e) => {
                    if (org.unacknowledgedCount > 0) {
                      e.stopPropagation()
                      setSelectedOrgForModal(org)
                      setShowRecommendationsModal(true)
                    }
                  }}
                >
                  {ackStatus.icon}
                  {ackStatus.text && (
                    <span className={`text-xs font-medium ${ackStatus.color}`}>
                      {ackStatus.text}
                    </span>
                  )}
                </div>

                {/* Organisation */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {org.organizationType === 'multisite' ? (
                          <Building2 className="w-4 h-4 text-blue-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                          </div>
                        )}
                        <div className="font-medium text-white text-sm truncate">
                          {org.name}
                          {org.organizationType === 'multisite' && (
                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              {org.sites_count} enheter
                            </span>
                          )}
                        </div>
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

                {/* Användare / Portal-status */}
                <div className="col-span-1 text-center text-sm">
                  {org.organizationType === 'multisite' ? (
                    <span className="text-slate-300">
                      {org.activeUsersCount || 0}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className={`text-xs px-2 py-1 rounded ${
                        org.activeUsersCount && org.activeUsersCount > 0
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {org.activeUsersCount && org.activeUsersCount > 0 ? '✓ Portal' : 'Ingen portal'}
                      </div>
                      {org.activeUsersCount && org.activeUsersCount > 0 && (
                        <div className="text-xs text-green-400">
                          ✓ Inloggad
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Årspremie */}
                <div className="col-span-2 text-right text-sm text-slate-300">
                  {formatCurrency(org.annual_value)}
                </div>

                {/* Totalt värde */}
                <div className="col-span-2 text-right text-sm font-medium text-white">
                  {formatCurrency(org.total_value)}
                </div>

                {/* Avtalslängd */}
                <div className="col-span-1 text-center text-sm text-slate-300">
                  {formatContractLength(org.contract_length)}
                </div>

                {/* Löper ut */}
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
                        // Expandera kortet automatiskt om det inte redan är expanderat
                        if (!showActions && expandedOrgId !== org.id) {
                          onToggleExpand(org)
                        }
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {showActions && (
                      <div className="absolute right-0 top-8 z-10 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1">
                        {/* Portal-specifika åtgärder för vanliga kunder */}
                        {org.organizationType === 'single' && (
                          <>
                            {(!org.activeUsersCount || org.activeUsersCount === 0) && (
                              <button
                                onClick={() => {
                                  onInviteToPortal?.(org)
                                  setShowActionsForOrg(null)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <UserPlus className="w-4 h-4" />
                                Bjud in till portal
                              </button>
                            )}
                            {org.activeUsersCount && org.activeUsersCount > 0 && (
                              <button
                                onClick={() => {
                                  onResetPassword(org.billing_email || '', org.name || '')
                                  setShowActionsForOrg(null)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Key className="w-4 h-4" />
                                Återställ lösenord
                              </button>
                            )}
                            <div className="border-t border-slate-700 my-1"></div>
                          </>
                        )}
                        
                        {/* Gemensamma åtgärder */}
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
                            <span className="text-slate-500">Avtalstyp:</span> {getContractTypeName(org.contract_type)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Enheter - Visa endast för multisite organisationer */}
                  {org.organizationType === 'multisite' && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          Enheter ({organizationSites[org.id]?.length || 0})
                        </h4>
                        <Button
                          onClick={() => onAddSite(org)}
                          variant="primary"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          Lägg till enhet
                        </Button>
                      </div>

                      {organizationSites[org.id] && organizationSites[org.id].length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {organizationSites[org.id].map(site => (
                            <div
                              key={site.id}
                              className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-500/20 rounded">
                                  <MapPin className="w-3 h-3 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-medium truncate">
                                    {site.site_name} ({site.site_code})
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {site.region} • {site.contact_email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => onEditSite(org, site)}
                                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                                  title="Redigera"
                                >
                                  <Edit2 className="w-3 h-3 text-slate-400" />
                                </button>
                                <button
                                  onClick={() => onDeleteSite(org.id, site.id)}
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
                          Inga enheter registrerade
                        </p>
                      )}
                    </div>
                  )}

                  {/* Användare - Visa endast för multisite organisationer */}
                  {org.organizationType === 'multisite' && (
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
                  )}

                  {/* Portal Access - Visa för alla kunder */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <Key className="w-4 h-4 text-green-400" />
                        Portalåtkomst
                      </h4>
                      {org.organizationType === 'single' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                            Avtalskund - Ej Multi-site
                          </span>
                        </div>
                      )}
                      {org.organizationType === 'multisite' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                            Multisite-organisation
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      {org.organizationType === 'multisite' ? (
                        <div className="text-sm text-slate-400">
                          <p className="mb-2">Individuell lösenordsåterställning görs för varje användare ovan.</p>
                          <p className="text-xs text-slate-500">
                            Klicka på nyckel-ikonen bredvid varje användare för att skicka återställningsmail.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <p className="text-slate-300">
                              Lösenordsåterställning för kunden
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Skickas till kundens huvudemail via Resend
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              const email = org.primary_contact_email || org.billing_email
                              onResetPassword(email, org.name)
                            }}
                            variant="primary"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Key className="w-3 h-3" />
                            Återställ lösenord
                          </Button>
                        </div>
                      )}
                    </div>
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

    {/* Modal för obekräftade rekommendationer */}
    {showRecommendationsModal && selectedOrgForModal && (
      <UnacknowledgedRecommendationsModal
        isOpen={showRecommendationsModal}
        onClose={() => {
          setShowRecommendationsModal(false)
          setSelectedOrgForModal(null)
        }}
        organizationId={selectedOrgForModal.organization_id}
        organizationName={selectedOrgForModal.name}
      />
    )}
    </>
  )
}

export default CompactOrganizationTable