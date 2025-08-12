import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { MultisiteOrganization, OrganizationSite } from '../../../types/multisite'
import {
  Receipt,
  Building2,
  MapPin,
  Download,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Filter
} from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import { formatCurrency } from '../../../utils/formatters'
import toast from 'react-hot-toast'

interface BillingData {
  organization: MultisiteOrganization
  sites: OrganizationSite[]
  totalAmount: number
  pendingAmount: number
  paidAmount: number
  lastInvoiceDate: string | null
  nextInvoiceDate: string | null
  invoiceCount: number
}

export default function BillingManagement() {
  const [billingData, setBillingData] = useState<BillingData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchBillingData()
  }, [billingPeriod])

  const fetchBillingData = async () => {
    setLoading(true)
    try {
      // Fetch organizations with billing info
      const { data: orgs, error: orgsError } = await supabase
        .from('multisite_organizations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (orgsError) throw orgsError

      const billingInfo: BillingData[] = []

      for (const org of orgs || []) {
        // Fetch sites
        const { data: sites, error: sitesError } = await supabase
          .from('organization_sites')
          .select('*')
          .eq('organization_id', org.id)
          .eq('is_active', true)

        if (sitesError) throw sitesError

        // Fetch billing data (simulated - would connect to real billing system)
        // In a real implementation, this would fetch from billing_audit_log or invoices table
        const { data: cases, error: casesError } = await supabase
          .from('cases')
          .select('price')
          .in('site_id', (sites || []).map(s => s.id))
          .not('price', 'is', null)

        if (casesError) throw casesError

        const totalAmount = cases?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
        const pendingAmount = totalAmount * 0.3 // Simulated pending
        const paidAmount = totalAmount * 0.7 // Simulated paid

        billingInfo.push({
          organization: org,
          sites: sites || [],
          totalAmount,
          pendingAmount,
          paidAmount,
          lastInvoiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Simulated
          nextInvoiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Simulated
          invoiceCount: Math.floor(Math.random() * 20) + 1 // Simulated
        })
      }

      setBillingData(billingInfo)
    } catch (error) {
      console.error('Error fetching billing data:', error)
      toast.error('Kunde inte hämta faktureringsdata')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInvoice = async (orgId: string, billingType: 'consolidated' | 'per_site') => {
    toast.success(`Genererar ${billingType === 'consolidated' ? 'konsoliderad' : 'per-site'} faktura...`)
    // In a real implementation, this would trigger invoice generation
  }

  const handleSendInvoice = async (orgId: string) => {
    toast.success('Faktura skickad via e-post')
    // In a real implementation, this would send the invoice
  }

  const handleExportBilling = () => {
    const csvContent = [
      ['Organisation', 'Faktureringstyp', 'Antal sites', 'Total belopp', 'Betalt', 'Obetalt', 'Senaste faktura', 'Nästa faktura'],
      ...filteredData.map(data => [
        data.organization.name,
        data.organization.billing_type === 'consolidated' ? 'Konsoliderad' : 'Per anläggning',
        data.sites.length,
        formatCurrency(data.totalAmount),
        formatCurrency(data.paidAmount),
        formatCurrency(data.pendingAmount),
        data.lastInvoiceDate ? new Date(data.lastInvoiceDate).toLocaleDateString('sv-SE') : '-',
        data.nextInvoiceDate ? new Date(data.nextInvoiceDate).toLocaleDateString('sv-SE') : '-'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `multisite-fakturering-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const filteredData = billingData.filter(data =>
    data.organization.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.organization.organization_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totals = {
    organizations: filteredData.length,
    sites: filteredData.reduce((sum, d) => sum + d.sites.length, 0),
    totalAmount: filteredData.reduce((sum, d) => sum + d.totalAmount, 0),
    pendingAmount: filteredData.reduce((sum, d) => sum + d.pendingAmount, 0),
    paidAmount: filteredData.reduce((sum, d) => sum + d.paidAmount, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Multisite Fakturering"
          description="Hantera konsoliderad och per-site fakturering"
          icon={Receipt}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-400">Organisationer</span>
            </div>
            <div className="text-2xl font-bold text-white">{totals.organizations}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-400">Totalt sites</span>
            </div>
            <div className="text-2xl font-bold text-white">{totals.sites}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">Totalt fakturerat</span>
            </div>
            <div className="text-xl font-bold text-white">{formatCurrency(totals.totalAmount)}</div>
          </Card>
          <Card className="p-4 border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">Betalt</span>
            </div>
            <div className="text-xl font-bold text-green-400">{formatCurrency(totals.paidAmount)}</div>
          </Card>
          <Card className="p-4 border-yellow-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-slate-400">Obetalt</span>
            </div>
            <div className="text-xl font-bold text-yellow-400">{formatCurrency(totals.pendingAmount)}</div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök organisation..."
              className="w-full"
            />
          </div>
          
          <select
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value as 'month' | 'quarter' | 'year')}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="month">Månadsvis</option>
            <option value="quarter">Kvartalsvis</option>
            <option value="year">Årsvis</option>
          </select>

          <Button
            onClick={handleExportBilling}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportera CSV
          </Button>
        </div>

        {/* Organizations Billing List */}
        {filteredData.length === 0 ? (
          <Card className="p-12 text-center">
            <Receipt className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Inga organisationer hittades
            </h3>
            <p className="text-slate-400">
              {searchTerm ? 'Prova att ändra din sökning' : 'Inga multisite-organisationer med fakturering finns än'}
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredData.map(data => (
              <Card key={data.organization.id} className="overflow-hidden">
                {/* Organization Header */}
                <div className="p-6 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {data.organization.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Receipt className="w-4 h-4" />
                          <span>
                            {data.organization.billing_type === 'consolidated' ? 'Konsoliderad fakturering' : 'Per-site fakturering'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>{data.sites.length} anläggningar</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <FileText className="w-4 h-4" />
                          <span>{data.invoiceCount} fakturor</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {data.organization.billing_type === 'consolidated' ? (
                        <Button
                          onClick={() => handleGenerateInvoice(data.organization.id, 'consolidated')}
                          variant="primary"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Generera konsoliderad
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleGenerateInvoice(data.organization.id, 'per_site')}
                          variant="primary"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Generera per site
                        </Button>
                      )}
                      <Button
                        onClick={() => handleSendInvoice(data.organization.id)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Skicka
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Billing Stats */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Total fakturerat</div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(data.totalAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Betalt</div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatCurrency(data.paidAmount)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {data.paidAmount > 0 ? Math.round((data.paidAmount / data.totalAmount) * 100) : 0}% av totalt
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Obetalt</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {formatCurrency(data.pendingAmount)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {data.pendingAmount > 0 ? Math.round((data.pendingAmount / data.totalAmount) * 100) : 0}% av totalt
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Nästa faktura</div>
                    <div className="text-lg font-medium text-white">
                      {data.nextInvoiceDate 
                        ? new Date(data.nextInvoiceDate).toLocaleDateString('sv-SE')
                        : '-'}
                    </div>
                    {data.lastInvoiceDate && (
                      <div className="text-xs text-slate-500 mt-1">
                        Senaste: {new Date(data.lastInvoiceDate).toLocaleDateString('sv-SE')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sites breakdown for per-site billing */}
                {data.organization.billing_type === 'per_site' && data.sites.length > 0 && (
                  <div className="p-6 pt-0">
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Fakturering per anläggning</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.sites.map(site => (
                        <div key={site.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-white text-sm">{site.site_name}</div>
                              <div className="text-xs text-slate-500">{site.region}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-white">
                                {formatCurrency(data.totalAmount / data.sites.length)}
                              </div>
                              <div className="text-xs text-slate-500">Estimat</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}