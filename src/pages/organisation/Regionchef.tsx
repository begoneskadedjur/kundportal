// src/pages/organisation/Regionchef.tsx - Dashboard för regionchefer
import React, { useState, useEffect } from 'react'
import { Building2, MapPin, AlertTriangle, CheckCircle, TrendingUp, Users } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getCustomerDisplayName, isMultisiteCustomer } from '../../utils/multisiteHelpers'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import OrganisationLayout from '../../components/organisation/OrganisationLayout'
import OrganizationServiceRequest from '../../components/organisation/OrganizationServiceRequest'
import OrganisationServiceActivityTimeline from '../../components/organisation/OrganisationServiceActivityTimeline'
import MultisitePendingQuoteNotification from '../../components/organisation/MultisitePendingQuoteNotification'

interface SiteMetrics {
  customerId: string
  customerName: string
  city: string
  activeCases: number
  completedThisMonth: number
  scheduledVisits: number
  trafficLight: 'green' | 'yellow' | 'red'
}

const RegionchefDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [showQuoteNotification, setShowQuoteNotification] = useState(false)

  useEffect(() => {
    if (organization && userRole) {
      fetchCustomersAndMetrics()
      fetchPendingQuotes()
    } else {
      setLoading(false)
    }
  }, [organization, userRole])

  useEffect(() => {
    if (pendingQuotes.length > 0) {
      setShowQuoteNotification(true)
    }
  }, [pendingQuotes])

  const fetchCustomersAndMetrics = async () => {
    if (!organization || !organization.organization_id || !userRole) {
      console.warn('No organization or user role data available')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      // Hämta endast enheter för denna organisation och region
      // VIKTIGT: Kontrollera is_multisite för att inte påverka vanliga kunder
      let customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organization.organization_id) // Använd organization_id
        .eq('site_type', 'enhet')
        .eq('is_multisite', true) // Säkerställ multisite-kunder
        .eq('is_active', true)
      
      // Filtrera på region om användaren är regionchef
      if (userRole.region) {
        customersQuery = customersQuery.eq('region', userRole.region)
      }
      
      const { data: customersData, error: customersError } = await customersQuery
      
      if (customersError) {
        console.error('Error fetching customers:', customersError)
        throw customersError
      }
      
      setCustomers(customersData || [])
      
      if (!customersData || customersData.length === 0) {
        setSiteMetrics([])
        setLoading(false)
        return
      }
      
      // Optimerat: Hämta all data i batch
      const customerIds = customersData.map(c => c.id)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      // Parallell query för bättre prestanda
      const { data: casesData } = await supabase
        .from('cases')
        .select('id, customer_id, status, updated_at, scheduled_date')
        .in('customer_id', customerIds)
      
      // Bearbeta data per customer
      const metrics: SiteMetrics[] = customersData.map(customer => {
        const customerCases = casesData?.filter(c => c.customer_id === customer.id) || []
        const activeCases = customerCases.filter(c => 
          ['Öppen', 'Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'].includes(c.status)
        )
        const completedThisMonth = customerCases.filter(c => 
          ['Avklarad', 'Stängd'].includes(c.status) &&
          new Date(c.updated_at) >= startOfMonth
        )
        const scheduledCases = customerCases.filter(c => c.status === 'Bokad' || c.status === 'Bokat')
        
        // Beräkna trafikljus
        let trafficLight: 'green' | 'yellow' | 'red' = 'green'
        const activeCount = activeCases.length
        if (activeCount > 5 && activeCount <= 10) trafficLight = 'yellow'
        if (activeCount > 10) trafficLight = 'red'
        
        return {
          customerId: customer.id,
          customerName: getCustomerDisplayName(customer),
          city: customer.city || 'Okänd stad',
          activeCases: activeCases.length,
          completedThisMonth: completedThisMonth.length,
          scheduledVisits: scheduledCases.length,
          trafficLight
        }
      })
      
      setSiteMetrics(metrics)
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingQuotes = async () => {
    if (!organization || !userRole || !accessibleSites.length) {
      return
    }

    try {
      const siteIds = accessibleSites.map(site => site.id)
      
      // First get quote recipients without the problematic JOIN
      const { data: quoteRecipients, error: recipientsError } = await supabase
        .from('quote_recipients')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)

      if (recipientsError) {
        console.error('Error fetching quote recipients:', recipientsError)
        return
      }

      if (!quoteRecipients || quoteRecipients.length === 0) {
        setPendingQuotes([])
        return
      }

      // Separate quote IDs by source type
      const caseQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'case')
        .map(qr => qr.quote_id)
      
      const contractQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'contract')
        .map(qr => qr.quote_id)

      // Fetch cases data if we have case quotes
      let casesData: any[] = []
      if (caseQuoteIds.length > 0) {
        const { data: cases, error: casesError } = await supabase
          .from('cases')
          .select(`
            id, case_number, title, quote_sent_at, customer_id,
            customers:customers!cases_customer_id_fkey(company_name, site_name)
          `)
          .in('id', caseQuoteIds)

        if (casesError) {
          console.error('Error fetching cases:', casesError)
        } else {
          casesData = cases || []
        }
      }

      // Fetch contracts data if we have contract quotes
      let contractsData: any[] = []
      if (contractQuoteIds.length > 0) {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id, oneflow_contract_id, company_name, total_value, 
            selected_products, created_at, customer_id
          `)
          .in('id', contractQuoteIds)

        if (contractsError) {
          console.error('Error fetching contracts:', contractsError)
        } else {
          contractsData = contracts || []
        }
      }

      // Get regionchef site_ids from multisite_user_roles
      const { data: regionchefRoles } = await supabase
        .from('multisite_user_roles')
        .select('site_ids')
        .eq('organization_id', organization.id)
        .eq('role_type', 'regionchef')
        .eq('is_active', true)
        
      const regionchefSiteIds = regionchefRoles?.flatMap(role => role.site_ids || []) || []
      
      // Regionchef sees quotes for their assigned sites (from multisite_user_roles)
      const relevantQuotes = (quoteRecipients || []).filter(qr => 
        qr.recipient_role === 'verksamhetschef' || 
        (qr.recipient_role === 'regionchef' && qr.site_ids?.some((siteId: string) => 
          regionchefSiteIds.includes(siteId)
        )) ||
        (qr.recipient_role === 'platsansvarig' && qr.site_ids?.some((siteId: string) => 
          regionchefSiteIds.includes(siteId)
        ))
      )

      // Transform to match MultisiteQuote interface
      const transformedQuotes = relevantQuotes.map(qr => {
        // Find the corresponding case or contract data
        let quoteData: any = {}
        let source_type = qr.source_type
        
        if (source_type === 'case') {
          const caseData = casesData.find(c => c.id === qr.quote_id)
          if (caseData) {
            quoteData = {
              case_number: caseData.case_number,
              title: caseData.title,
              quote_sent_at: caseData.quote_sent_at,
              company_name: caseData.customers?.company_name,
              site_name: caseData.customers?.site_name,
              oneflow_contract_id: ''
            }
          }
        } else if (source_type === 'contract') {
          const contractData = contractsData.find(c => c.id === qr.quote_id)
          if (contractData) {
            // Generate a case number for contract quotes
            const caseNumber = `Offert #${contractData.id.slice(-6)}`
            const products = contractData.selected_products 
              ? (Array.isArray(contractData.selected_products) 
                  ? contractData.selected_products.map((p: any) => p.name || p.title).join(', ')
                  : String(contractData.selected_products)
                )
              : ''
            
            quoteData = {
              case_number: caseNumber,
              title: contractData.company_name || 'Skadedjursbekämpning',
              quote_sent_at: contractData.created_at,
              company_name: contractData.company_name,
              site_name: '', // Contracts don't have site_name directly
              oneflow_contract_id: contractData.oneflow_contract_id || '',
              products: products
            }
          }
        }

        return {
          id: qr.quote_id,
          case_number: quoteData.case_number || 'Okänt ärendenummer',
          title: quoteData.title || 'Okänd titel', 
          quote_sent_at: quoteData.quote_sent_at || qr.created_at,
          oneflow_contract_id: quoteData.oneflow_contract_id || '', 
          source_type: source_type,
          company_name: quoteData.company_name,
          site_name: quoteData.site_name,
          products: quoteData.products,
          recipient_role: qr.recipient_role,
          recipient_sites: qr.site_ids ? 
            customers.filter(customer => qr.site_ids.includes(customer.id)).map(customer => getCustomerDisplayName(customer)) : 
            [],
          region: qr.region
        }
      })

      setPendingQuotes(transformedQuotes)
    } catch (error) {
      console.error('Error fetching pending quotes:', error)
    }
  }

  // Beräkna totaler
  const totals = {
    sites: siteMetrics.length,
    activeCases: siteMetrics.reduce((sum, m) => sum + m.activeCases, 0),
    completedThisMonth: siteMetrics.reduce((sum, m) => sum + m.completedThisMonth, 0),
    scheduledVisits: siteMetrics.reduce((sum, m) => sum + m.scheduledVisits, 0)
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar regiondata..." />
      </div>
    )
  }

  return (
    <OrganisationLayout userRoleType="regionchef">
      <div className="space-y-6">
        {/* Multisite Quote Notifications */}
        {showQuoteNotification && pendingQuotes.length > 0 && (
          <MultisitePendingQuoteNotification
            quotes={pendingQuotes}
            userRole="regionchef"
            organizationName={organization?.organization_name}
            onDismiss={() => setShowQuoteNotification(false)}
          />
        )}
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-2xl p-6 border border-blue-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {organization?.organization_name}
              </h1>
              <p className="text-blue-200">
                Regionchef - {userRole?.region || 'Okänd region'}
              </p>
            </div>
            <Button
              onClick={() => setShowServiceRequestModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Begär service
            </Button>
          </div>
        </div>

        {/* Översikt */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Enheter i region</p>
              <p className="text-2xl font-bold text-white">{totals.sites}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Aktiva ärenden</p>
              <p className="text-2xl font-bold text-white">{totals.activeCases}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Avklarade (månaden)</p>
              <p className="text-2xl font-bold text-white">{totals.completedThisMonth}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Schemalagda besök</p>
              <p className="text-2xl font-bold text-white">{totals.scheduledVisits}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Trafikljus</p>
              <div className="flex gap-2 text-lg font-bold">
                <span className="text-green-400">{siteMetrics.filter(m => m.trafficLight === 'green').length}</span>
                <span className="text-yellow-400">{siteMetrics.filter(m => m.trafficLight === 'yellow').length}</span>
                <span className="text-red-400">{siteMetrics.filter(m => m.trafficLight === 'red').length}</span>
              </div>
            </div>
          </div>
        </Card>
        </div>

        {/* Enheter i regionen */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Enheter i {userRole?.region || 'din region'}
            </h2>
          </div>
          
          <div className="p-6">
            {siteMetrics.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Inga enheter i din region</p>
                <p className="text-slate-500 text-sm mt-2">
                  Kontakta verksamhetschefen för att få tillgång till enheter
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {siteMetrics.map((metric) => (
                  <div
                    key={metric.customerId}
                    className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white text-lg">{metric.customerName}</h3>
                          <div className={`w-3 h-3 rounded-full ${
                            metric.trafficLight === 'green' ? 'bg-green-500' :
                            metric.trafficLight === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                        </div>
                        <p className="text-slate-400 text-sm mb-3">{metric.city}</p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Aktiva ärenden</p>
                            <p className="font-semibold text-amber-400">{metric.activeCases}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Avklarade</p>
                            <p className="font-semibold text-green-400">{metric.completedThisMonth}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Schemalagda</p>
                            <p className="font-semibold text-purple-400">{metric.scheduledVisits}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-6">
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                          Visa detaljer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Servicehistorik för alla enheter i regionen */}
        {customers.length > 0 && (
          <OrganisationServiceActivityTimeline 
            siteIds={customers.map(c => c.id)}
          />
        )}
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <OrganizationServiceRequest
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            onSuccess={() => {
              fetchCustomersAndMetrics()
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default RegionchefDashboard