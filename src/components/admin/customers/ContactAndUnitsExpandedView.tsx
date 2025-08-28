// src/components/admin/customers/ContactAndUnitsExpandedView.tsx - Kompakt expanderad vy för multi-site organisationer

import React from 'react'
import { 
  Users, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  DollarSign,
  Activity,
  AlertTriangle,
  Crown,
  Shield,
  UserCheck,
  HelpCircle
} from 'lucide-react'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'

interface ContactAndUnitsExpandedViewProps {
  organization: ConsolidatedCustomer
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export const ContactAndUnitsExpandedView: React.FC<ContactAndUnitsExpandedViewProps> = ({
  organization
}) => {
  // Hitta verksamhetschef - använd först organisation-nivå data, sedan huvudkontor site
  const verksamhetschef = organization.sites.find(site => site.site_type === 'huvudkontor') 
    || organization.sites[0]

  // Hitta namn för verksamhetschef (förbättrad version)
  const getContactName = (contact_person: string | null, contact_email: string) => {
    // Först: använd organisation-nivå kontaktperson om det finns
    if (contact_person && contact_person.trim() !== '') {
      return contact_person
    }
    
    // Andra prioritet: Sök efter användare med samma email i multisiteUsers för att få display_name
    const userWithEmail = organization.multisiteUsers?.find(user => 
      user.email === contact_email && user.display_name && user.display_name.trim() !== ''
    )
    if (userWithEmail?.display_name) {
      return userWithEmail.display_name
    }
    
    // Sista utväg: försök extrahera namn från email (men bara om inget annat finns)
    if (contact_email) {
      const emailParts = contact_email.split('@')
      if (emailParts[0] && emailParts[0].length > 3) { // Endast om email-delen är rimlig
        return emailParts[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      }
    }
    return null
  }

  // Hitta verksamhetschef från multisiteUsers först, sedan fallback till gamla metoden
  const verksamhetschefFromUsers = organization.multisiteUsers?.find(user => user.role_type === 'verksamhetschef')
  const verksamhetschefName = verksamhetschefFromUsers?.display_name 
    || getContactName(organization.contact_person, organization.contact_email) 
    || getContactName(verksamhetschef?.contact_person, verksamhetschef?.contact_email)
    || "Ej angivet" // Mer exakt fallback

  // Hitta portal-användare och deras roller (ersätter "andra kontakter")
  const portalUsers = organization.sites.filter(site => 
    site.hasPortalAccess || site.invitationStatus === 'pending' || site.invitationStatus === 'active'
  )

  // Räkna olika typer av användare från multisite_user_roles
  const userRolesSummary = {
    active: organization.multisiteUsers?.filter(user => user.hasLoggedIn).length || 0,
    pending: organization.multisiteUsers?.filter(user => !user.hasLoggedIn).length || 0,
    verksamhetschef: organization.multisiteUsers?.filter(user => user.role_type === 'verksamhetschef').length || 0,
    regionchef: organization.multisiteUsers?.filter(user => user.role_type === 'regionchef').length || 0,
    platsansvarig: organization.multisiteUsers?.filter(user => user.role_type === 'platsansvarig').length || 0
  }

  // Räkna ärenden per enhet
  const unitsWithCases = organization.sites.filter(site => site.casesCount > 0)

  return (
    <tr>
      <td colSpan={11} className="px-6 py-6 bg-slate-800/30">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Kontaktöversikt */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Kontaktöversikt
              </h4>
              
              {/* Verksamhetschef */}
              <div className="bg-slate-700/50 rounded-lg p-4 mb-4 border border-slate-600/50">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Verksamhetschef</span>
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-white">
                    {verksamhetschefName || 'Namn ej angivet'}
                  </div>
                  {verksamhetschef.site_name && (
                    <div className="text-xs text-slate-400">
                      {verksamhetschef.site_name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <a 
                      href={`mailto:${verksamhetschefFromUsers?.email || organization.contact_email}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {verksamhetschefFromUsers?.email || organization.contact_email}
                    </a>
                  </div>
                  {(organization.contact_phone || verksamhetschef?.contact_phone) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <a 
                        href={`tel:${organization.contact_phone || verksamhetschef?.contact_phone}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {organization.contact_phone || verksamhetschef?.contact_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Portal användare */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Portal-användare</span>
                  <span className="text-sm font-semibold text-green-400">
                    {organization.activeUsersCount} aktiva
                  </span>
                </div>
                {organization.pendingInvitationsCount > 0 && (
                  <div className="text-xs text-amber-400">
                    +{organization.pendingInvitationsCount} väntande inbjudningar
                  </div>
                )}
              </div>

              {/* Portal-användare och roller */}
              <div className="mt-4">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-green-400" />
                    <h5 className="text-sm font-medium text-slate-300">Alla användare och roller</h5>
                  </div>
                  
                  {/* Användarlistning - från multisite_user_roles istället för sites */}
                  <div className="space-y-2 mb-3">
                    {organization.multisiteUsers?.map((user, index) => {
                      const userName = user.display_name || getContactName(null, user.email) || 'Ej angivet'
                      
                      const getRoleIcon = (roleType: string) => {
                        switch (roleType) {
                          case 'verksamhetschef':
                            return <Crown className="w-3 h-3 text-amber-400" />
                          case 'regionchef':
                            return <Shield className="w-3 h-3 text-purple-400" />
                          case 'platsansvarig':
                            return <Building2 className="w-3 h-3 text-blue-400" />
                          default:
                            return <Users className="w-3 h-3 text-slate-400" />
                        }
                      }

                      const getRoleColor = (roleType: string) => {
                        switch (roleType) {
                          case 'verksamhetschef':
                            return 'bg-amber-500/20 text-amber-400'
                          case 'regionchef':
                            return 'bg-purple-500/20 text-purple-400'
                          case 'platsansvarig':
                            return 'bg-blue-500/20 text-blue-400'
                          default:
                            return 'bg-slate-500/20 text-slate-400'
                        }
                      }

                      const getRoleLabel = (roleType: string) => {
                        switch (roleType) {
                          case 'verksamhetschef':
                            return 'Verksamhetschef'
                          case 'regionchef':
                            return 'Regionchef'
                          case 'platsansvarig':
                            return 'Platsansvarig'
                          default:
                            return roleType
                        }
                      }
                      
                      return (
                        <div key={user.user_id || index} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(user.role_type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-200 font-medium">
                                  {userName}
                                </span>
                                <div className="flex items-center gap-1">
                                  <a 
                                    href={`mailto:${user.email}`}
                                    className="text-slate-400 hover:text-blue-400 transition-colors"
                                    title={`Skicka email till ${userName}`}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                              <div className="text-xs text-slate-400">
                                {user.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(user.role_type)}`}>
                              {getRoleLabel(user.role_type)}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${
                              user.hasLoggedIn ? 'bg-green-400' : 'bg-slate-500'
                            }`} 
                            title={user.hasLoggedIn ? 'Har loggat in' : 'Aldrig inloggad'} />
                          </div>
                        </div>
                      )
                    }) || <div className="text-xs text-slate-500 italic">Inga användare hittades</div>}
                  </div>
                  
                  {/* Rollsummering */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-800/50 rounded p-2">
                      <div className="text-xs text-slate-400">Aktiva användare</div>
                      <div className="text-sm font-semibold text-green-400">
                        {userRolesSummary.active}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-2">
                      <div className="text-xs text-slate-400">Väntande inbjudningar</div>
                      <div className="text-sm font-semibold text-amber-400">
                        {userRolesSummary.pending}
                      </div>
                    </div>
                  </div>
                  
                  {/* Rollfördelning */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="w-3 h-3 text-amber-400" />
                        <span className="text-slate-300">Verksamhetschefer</span>
                      </div>
                      <span className="text-amber-400 font-medium">{userRolesSummary.verksamhetschef}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-purple-400" />
                        <span className="text-slate-300">Regionchefer</span>
                      </div>
                      <span className="text-purple-400 font-medium">{userRolesSummary.regionchef}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span className="text-slate-300">Platsansvariga</span>
                      </div>
                      <span className="text-blue-400 font-medium">{userRolesSummary.platsansvarig}</span>
                    </div>
                  </div>
                  
                  {/* Portal-tillgång sammanfattning */}
                  <div className="mt-3 pt-3 border-t border-slate-600/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Portal-tillgång</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          (organization.multisiteUsers?.length || 0) > 0 ? 'bg-green-400' : 'bg-slate-500'
                        }`} />
                        <span className={`text-xs font-medium ${
                          (organization.multisiteUsers?.length || 0) > 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {(organization.multisiteUsers?.length || 0) > 0 
                            ? `${organization.multisiteUsers?.length || 0} användare har tillgång`
                            : 'Ingen tillgång'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhetsaktivitet & Ärenden */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-400" />
                Enhetsöversikt
              </h4>
              
              {/* Sammanfattning */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Totalt enheter</div>
                  <div className="text-lg font-semibold text-white">{organization.totalSites}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Aktiva ärenden</div>
                  <div className="text-lg font-semibold text-blue-400">{organization.totalCasesCount}</div>
                </div>
              </div>

              {/* Extra ärenden per enhet */}
              {unitsWithCases.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    Intäkter från ärenden som inte ingår i avtal
                  </h5>
                  <div className="space-y-2">
                    {unitsWithCases.slice(0, 4).map(site => {
                      // Hitta ansvariga användare för denna site
                      const siteResponsibleUsers = organization.multisiteUsers?.filter(user => 
                        user.role_type === 'platsansvarig' && 
                        Array.isArray(user.site_ids) && 
                        user.site_ids.includes(site.id)
                      ) || []
                      
                      return (
                        <div key={site.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                          {/* Site header med grundinfo */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="text-sm font-medium text-slate-200">
                                {site.site_name || site.company_name}
                              </span>
                              {site.site_code && (
                                <span className="text-xs text-slate-500">({site.site_code})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-blue-400">
                                {site.casesCount} ärenden
                              </span>
                              <span className="text-xs font-medium text-green-400">
                                {formatCurrency(site.casesValue)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Ansvariga användare för denna site */}
                          {siteResponsibleUsers.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50">
                              <div className="text-xs text-slate-400 mb-1">Ansvariga:</div>
                              <div className="flex flex-wrap gap-1">
                                {siteResponsibleUsers.map(user => (
                                  <div key={user.user_id} className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
                                    <span className="text-xs text-slate-300">
                                      {user.display_name || getContactName(null, user.email) || 'Ej angivet'}
                                    </span>
                                    <a 
                                      href={`mailto:${user.email}`}
                                      className="text-slate-400 hover:text-blue-400 transition-colors"
                                      title={`Skicka email till ${user.display_name || user.email}`}
                                    >
                                      <Mail className="w-3 h-3" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Visa grundkontakt för site om ingen platsansvarig finns */}
                          {siteResponsibleUsers.length === 0 && (site.contact_person || site.contact_email) && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50">
                              <div className="text-xs text-slate-400 mb-1">Kontakt:</div>
                              <div className="flex items-center gap-2">
                                {site.contact_person && (
                                  <span className="text-xs text-slate-300">{site.contact_person}</span>
                                )}
                                {site.contact_email && (
                                  <a 
                                    href={`mailto:${site.contact_email}`}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                                {site.contact_phone && (
                                  <a 
                                    href={`tel:${site.contact_phone}`}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <Phone className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {unitsWithCases.length > 4 && (
                      <div className="text-xs text-slate-500 text-center">
                        +{unitsWithCases.length - 4} fler enheter med ärenden...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Faktureringsstatus */}
            <div>
              <h5 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
                <DollarSign className="w-3 h-3" />
                Faktureringsstatus (Ärenden)
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
                  <div className="text-xs text-green-400">Betald</div>
                  <div className="font-medium text-green-400">
                    {formatCurrency(organization.casesBillingStatus.paid?.value || 0)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {organization.casesBillingStatus.paid?.count || 0} ärenden
                  </div>
                </div>
                <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20">
                  <div className="text-xs text-amber-400">Väntande</div>
                  <div className="font-medium text-amber-400">
                    {formatCurrency(organization.casesBillingStatus.pending?.value || 0)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {organization.casesBillingStatus.pending?.count || 0} ärenden
                  </div>
                </div>
              </div>
            </div>

            {/* Health Score & Churn Risk med tooltips */}
            <div className="space-y-3">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TooltipWrapper 
                    content={
                      <div className="p-3 max-w-sm">
                        <div className="font-medium text-white mb-2">Health Score Beräkning</div>
                        <div className="text-xs text-slate-300 space-y-1">
                          <div>• <strong>Avtalsdata:</strong> Kontraktslängd och värde</div>
                          <div>• <strong>Betalningshistorik:</strong> Fakturastatus och betalningsmönster</div>
                          <div>• <strong>Engagemang:</strong> Portal-användning och kommunikation</div>
                          <div>• <strong>Tjänsteutnyttjande:</strong> Frekvens av extra ärenden</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Skala: 0-100 (högre = friskare kund)
                        </div>
                      </div>
                    }
                    placement="top"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-slate-300">Health Score</span>
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </div>
                  </TooltipWrapper>
                </div>
                <div className="text-lg font-bold text-green-400">
                  {organization.overallHealthScore.score}/100
                </div>
                <div className="text-xs text-slate-400">
                  Status: {organization.overallHealthScore.level === 'excellent' ? 'Utmärkt' :
                           organization.overallHealthScore.level === 'good' ? 'Bra' :
                           organization.overallHealthScore.level === 'fair' ? 'Acceptabel' : 'Riskabel'}
                </div>
              </div>
              
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TooltipWrapper 
                    content={
                      <div className="p-3 max-w-sm">
                        <div className="font-medium text-white mb-2">Churn Risk Beräkning</div>
                        <div className="text-xs text-slate-300 space-y-1">
                          <div>• <strong>Avtalsförnyelse:</strong> Dagar till förnyelse</div>
                          <div>• <strong>Health Score:</strong> Övergripande kundstatus</div>
                          <div>• <strong>Betalningsproblem:</strong> Försenade eller missade betalningar</div>
                          <div>• <strong>Support-ärenden:</strong> Antal och typ av problem</div>
                          <div>• <strong>Användningsmönster:</strong> Minskat engagemang</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Skala: Låg → Medel → Hög → Kritisk
                        </div>
                      </div>
                    }
                    placement="top"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-medium text-slate-300">Churn Risk</span>
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </div>
                  </TooltipWrapper>
                </div>
                <div className={`text-lg font-bold ${
                  organization.highestChurnRisk.risk === 'low' ? 'text-green-400' :
                  organization.highestChurnRisk.risk === 'medium' ? 'text-amber-400' :
                  organization.highestChurnRisk.risk === 'high' ? 'text-red-400' : 'text-red-500'
                }`}>
                  {organization.highestChurnRisk.risk === 'low' ? 'Låg' :
                   organization.highestChurnRisk.risk === 'medium' ? 'Medel' :
                   organization.highestChurnRisk.risk === 'high' ? 'Hög' : 'Kritisk'}
                </div>
                <div className="text-xs text-slate-400">
                  Score: {organization.highestChurnRisk.score.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Varningar */}
            {(organization.hasExpiringSites || organization.hasHighRiskSites) && (
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">Uppmärksamhet krävs</span>
                </div>
                <div className="space-y-1 text-xs text-red-300">
                  {organization.hasExpiringSites && (
                    <div>• Enheter med utgående avtal</div>
                  )}
                  {organization.hasHighRiskSites && (
                    <div>• Enheter i riskzonen</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

export default ContactAndUnitsExpandedView