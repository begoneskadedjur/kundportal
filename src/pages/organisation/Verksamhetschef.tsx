// src/pages/organisation/Verksamhetschef.tsx - Dashboard för verksamhetschefer
import React, { useState, useEffect } from 'react'
import { Building2, Users, TrendingUp, MapPin, AlertTriangle, CheckCircle, Calendar, Clock } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getCustomerDisplayName, isMultisiteCustomer } from '../../utils/multisiteHelpers'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import OrganisationLayout from '../../components/organisation/OrganisationLayout'
import ServiceRequestModal from '../../components/organisation/ServiceRequestModal'
import OrganisationServiceActivityTimeline from '../../components/organisation/OrganisationServiceActivityTimeline'
import MultisitePendingQuoteNotification from '../../components/organisation/MultisitePendingQuoteNotification'

interface SiteMetrics {
  customerId: string
  customerName: string
  region: string
  activeCases: number
  completedThisMonth: number
  pendingQuotes: number
  scheduledVisits: number
  trafficLight: 'green' | 'yellow' | 'red'
}

interface UpcomingVisit {
  id: string
  title: string
  siteName: string
  scheduledDate: string
  technicianName?: string
  status: string
}

const VerksamhetschefDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, sites, userRole, loading: contextLoading } = useMultisite()
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics[]>([])
  const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [showQuoteNotification, setShowQuoteNotification] = useState(false)

  useEffect(() => {
    if (organization) {
      fetchCustomersAndMetrics()
      fetchPendingQuotes()
    } else {
      setLoading(false)
    }
  }, [organization])

  useEffect(() => {
    if (pendingQuotes.length > 0) {
      setShowQuoteNotification(true)
    }
  }, [pendingQuotes])

  const fetchCustomersAndMetrics = async () => {
    if (!organization || !organization.organization_id) {
      console.warn('No organization data available')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      // Hämta endast enheter som tillhör organisationen (inte huvudkontor)
      // VIKTIGT: Kontrollera is_multisite för att inte påverka vanliga kunder
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organization.organization_id) // Använd organization_id
        .eq('site_type', 'enhet')
        .eq('is_multisite', true) // Säkerställ att vi bara hämtar multisite-kunder
        .eq('is_active', true)
      
      if (customersError) {
        console.error('Error fetching customers:', customersError)
        throw customersError
      }
      
      setCustomers(customersData || [])
      
      if (!customersData || customersData.length === 0) {
        setSiteMetrics([])
        setUpcomingVisits([])
        setLoading(false)
        return
      }
      
      // Optimerat: Hämta all data i batch istället för loop
      const customerIds = customersData.map(c => c.id)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      // Parallella queries för bättre prestanda
      const [casesData, quotesData, visitsData] = await Promise.all([
        // Hämta alla ärenden för alla kunder på en gång
        supabase
          .from('cases')
          .select('id, customer_id, status, updated_at, scheduled_date, title, technician_name')
          .in('customer_id', customerIds),
        
        // Hämta alla offerter
        supabase
          .from('customer_pending_quotes')
          .select('quote_id, customer_id')
          .in('customer_id', customerIds),
        
        // Hämta kommande besök
        supabase
          .from('cases')
          .select('id, title, customer_id, scheduled_date, technician_name, status')
          .in('customer_id', customerIds)
          .in('status', ['Bokad', 'Bokat'])
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true })
          .limit(10)
      ])
      
      // Bearbeta data per customer
      const metrics: SiteMetrics[] = customersData.map(customer => {
        const customerCases = casesData.data?.filter(c => c.customer_id === customer.id) || []
        const activeCases = customerCases.filter(c => 
          ['Öppen', 'Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'].includes(c.status)
        )
        const completedThisMonth = customerCases.filter(c => 
          ['Avklarad', 'Stängd'].includes(c.status) &&
          new Date(c.updated_at) >= startOfMonth
        )
        const scheduledCases = customerCases.filter(c => c.status === 'Bokad' || c.status === 'Bokat')
        const customerQuotes = quotesData.data?.filter(q => q.customer_id === customer.id) || []
        
        // Beräkna trafikljus
        let trafficLight: 'green' | 'yellow' | 'red' = 'green'
        const activeCount = activeCases.length
        if (activeCount > 5 && activeCount <= 10) trafficLight = 'yellow'
        if (activeCount > 10) trafficLight = 'red'
        
        return {
          customerId: customer.id,
          customerName: getCustomerDisplayName(customer),
          region: customer.region || customer.city || 'Okänd',
          activeCases: activeCases.length,
          completedThisMonth: completedThisMonth.length,
          pendingQuotes: customerQuotes.length,
          scheduledVisits: scheduledCases.length,
          trafficLight
        }
      })
      
      setSiteMetrics(metrics)
      
      // Formatera kommande besök (vi har redan hämtat data)
      if (visitsData.data) {
        const visitsWithCustomerNames = visitsData.data.map(visit => {
          const customer = customersData.find(c => c.id === visit.customer_id)
          return {
            id: visit.id,
            title: visit.title || 'Ingen titel',
            siteName: getCustomerDisplayName(customer) || 'Okänd enhet',
            scheduledDate: visit.scheduled_date,
            technicianName: visit.technician_name,
            status: visit.status
          }
        })
        setUpcomingVisits(visitsWithCustomerNames)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingQuotes = async () => {
    if (!organization || !userRole) {
      return
    }

    try {
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

      // Verksamhetschef sees all quotes for the organization
      const relevantQuotes = quoteRecipients || []

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
            sites?.filter(site => qr.site_ids.includes(site.id)).map(site => site.site_name) : 
            [],
          region: qr.region
        }
      })

      setPendingQuotes(transformedQuotes)
    } catch (error) {
      console.error('Error fetching pending quotes:', error)
    }
  }

  // Hämta unika regioner från customers
  const regions = Array.from(new Set(siteMetrics.map(m => m.region)))
  
  // Filtrera metrics baserat på vald region
  const filteredMetrics = selectedRegion === 'all' 
    ? siteMetrics 
    : siteMetrics.filter(m => m.region === selectedRegion)

  // Beräkna totaler
  const totals = {
    sites: filteredMetrics.length,
    activeCases: filteredMetrics.reduce((sum, m) => sum + m.activeCases, 0),
    completedThisMonth: filteredMetrics.reduce((sum, m) => sum + m.completedThisMonth, 0),
    pendingQuotes: filteredMetrics.reduce((sum, m) => sum + m.pendingQuotes, 0),
    scheduledVisits: filteredMetrics.reduce((sum, m) => sum + m.scheduledVisits, 0),
    trafficLight: {
      green: filteredMetrics.filter(m => m.trafficLight === 'green').length,
      yellow: filteredMetrics.filter(m => m.trafficLight === 'yellow').length,
      red: filteredMetrics.filter(m => m.trafficLight === 'red').length
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar organisationsdata..." />
      </div>
    )
  }

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Multisite Quote Notifications */}
        {showQuoteNotification && pendingQuotes.length > 0 && (
          <MultisitePendingQuoteNotification
            quotes={pendingQuotes}
            userRole="verksamhetschef"
            organizationName={organization?.organization_name}
            onDismiss={() => setShowQuoteNotification(false)}
          />
        )}
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                Full översikt över alla enheter
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

        {/* Region Filter */}
        <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-lg">
          <label className="text-slate-300">Filtrera per region:</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Alla regioner</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        {/* Översikt */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span className="text-slate-400 text-sm">Enheter</span>
            </div>
            <p className="text-2xl font-bold text-white">{totals.sites}</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span className="text-slate-400 text-sm">Aktiva</span>
            </div>
            <p className="text-2xl font-bold text-white">{totals.activeCases}</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-slate-400 text-sm">Avklarade</span>
            </div>
            <p className="text-2xl font-bold text-white">{totals.completedThisMonth}</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <span className="text-slate-400 text-sm">Schemalagda</span>
            </div>
            <p className="text-2xl font-bold text-white">{totals.scheduledVisits}</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-slate-400 text-sm">Offerter</span>
            </div>
            <p className="text-2xl font-bold text-white">{totals.pendingQuotes}</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full bg-green-500`}></div>
                <div className={`w-2 h-2 rounded-full bg-yellow-500`}></div>
                <div className={`w-2 h-2 rounded-full bg-red-500`}></div>
              </div>
              <span className="text-slate-400 text-sm">Trafikljus</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-green-400">{totals.trafficLight.green}</span>
              <span className="text-yellow-400">{totals.trafficLight.yellow}</span>
              <span className="text-red-400">{totals.trafficLight.red}</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enhetslista */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  Enhetsöversikt
                </h2>
              </div>
              
              <div className="p-6">
                {filteredMetrics.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Inga enheter hittades</p>
                    <p className="text-slate-500 text-sm mt-2">
                      Kontakta administratören för att lägga till enheter
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredMetrics.map((metric) => (
                      <div
                        key={metric.customerId}
                        className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-white">{metric.customerName}</h3>
                            <p className="text-sm text-slate-400">{metric.region}</p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${
                            metric.trafficLight === 'green' ? 'bg-green-500' :
                            metric.trafficLight === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-slate-500">Aktiva</p>
                            <p className="font-semibold text-amber-400">{metric.activeCases}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Avkl.</p>
                            <p className="font-semibold text-green-400">{metric.completedThisMonth}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Sched.</p>
                            <p className="font-semibold text-cyan-400">{metric.scheduledVisits}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Offer.</p>
                            <p className="font-semibold text-purple-400">{metric.pendingQuotes}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Kommande besök */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Kommande besök
                </h2>
              </div>
              <div className="p-6">
                {upcomingVisits.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Inga schemalagda besök</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {upcomingVisits.map((visit) => (
                      <div key={visit.id} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                        <h4 className="font-medium text-white text-sm mb-1">{visit.title}</h4>
                        <p className="text-xs text-purple-400 mb-2">{visit.siteName}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {new Date(visit.scheduledDate).toLocaleDateString('sv-SE', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {visit.technicianName && (
                            <span className="text-xs text-slate-500">
                              {visit.technicianName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Servicehistorik för hela organisationen */}
        {customers.length > 0 && (
          <OrganisationServiceActivityTimeline 
            organizationId={organization?.organization_id}
          />
        )}
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <ServiceRequestModal
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

export default VerksamhetschefDashboard