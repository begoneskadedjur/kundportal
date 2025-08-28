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
  Crown
} from 'lucide-react'
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
  // Hitta verksamhetschef (huvudkontor kontakt)
  const verksamhetschef = organization.sites.find(site => site.site_type === 'huvudkontor') 
    || organization.sites[0]

  // Andra viktiga kontakter
  const otherContacts = organization.sites.filter(site => 
    site.id !== verksamhetschef.id && site.contact_person && site.contact_person.trim() !== ''
  )

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
                    {verksamhetschef.contact_person || 'Ej angivet'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <a 
                      href={`mailto:${verksamhetschef.contact_email}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {verksamhetschef.contact_email}
                    </a>
                  </div>
                  {verksamhetschef.contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <a 
                        href={`tel:${verksamhetschef.contact_phone}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {verksamhetschef.contact_phone}
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

              {/* Andra kontakter */}
              {otherContacts.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-xs font-medium text-slate-400 mb-2">Andra kontakter</h5>
                  <div className="space-y-2">
                    {otherContacts.slice(0, 3).map(contact => (
                      <div key={contact.id} className="flex items-center gap-3 text-xs">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-300">{contact.contact_person}</span>
                        <span className="text-slate-500">•</span>
                        <a 
                          href={`mailto:${contact.contact_email}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {contact.contact_email}
                        </a>
                      </div>
                    ))}
                    {otherContacts.length > 3 && (
                      <div className="text-xs text-slate-500">
                        +{otherContacts.length - 3} fler kontakter...
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                    Enheter med extra ärenden
                  </h5>
                  <div className="space-y-2">
                    {unitsWithCases.slice(0, 4).map(site => (
                      <div key={site.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-300">
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
                    ))}
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
                Faktureringsstatus (Extra ärenden)
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
                  <div className="text-xs text-green-400">Betald</div>
                  <div className="font-medium text-green-400">
                    {formatCurrency(organization.casesBillingStatus.paid.value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {organization.casesBillingStatus.paid.count} ärenden
                  </div>
                </div>
                <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20">
                  <div className="text-xs text-amber-400">Väntande</div>
                  <div className="font-medium text-amber-400">
                    {formatCurrency(organization.casesBillingStatus.pending.value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {organization.casesBillingStatus.pending.count} ärenden
                  </div>
                </div>
              </div>
            </div>

            {/* Varningar */}
            {(organization.hasExpiringSites || organization.hasHighRiskSites) && (
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
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