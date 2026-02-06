// src/components/admin/customers/SingleCustomerDetailModal.tsx
import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Building2,
  Calendar,
  TrendingUp,
  AlertCircle,
  Users,
  Coins,
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  FileText,
  Activity,
  Shield,
  TrendingDown
} from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import HealthScoreBadge from './HealthScoreBadge'
import ChurnRiskBadge from './ChurnRiskBadge'
import PortalAccessBadge from './PortalAccessBadge'
import AdminCasesList from './AdminCasesList'
import CustomerEquipmentDualView from './CustomerEquipmentDualView'
import { formatCurrency, getContractProgress } from '../../../utils/customerMetrics'
import { supabase } from '../../../lib/supabase'

interface SingleCustomerDetailModalProps {
  customer: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'text-green-400 bg-green-500/10 border-green-500/20',
  invoiced: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  approved: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Betald',
  invoiced: 'Fakturerad',
  approved: 'Godkänd',
  pending: 'Väntande'
}

export default function SingleCustomerDetailModal({
  customer,
  isOpen,
  onClose
}: SingleCustomerDetailModalProps) {
  if (!isOpen || !customer || customer.organizationType !== 'single') return null

  // Single customer data (direct access since there's only one site)
  const site = customer.sites[0]
  const contractValue = customer.totalContractValue

  // Kontraktsperiod — korrekt beräkning baserat på start/slut-datum
  const contractProgress = getContractProgress(site.contract_start_date, site.contract_end_date)

  // Hämta faktureringsdata från contract_billing_items
  const [billingItems, setBillingItems] = useState<Array<{
    total_price: number
    status: string
    item_type: string
  }>>([])
  const [billingLoading, setBillingLoading] = useState(false)

  useEffect(() => {
    const fetchBilling = async () => {
      setBillingLoading(true)
      try {
        const { data, error } = await supabase
          .from('contract_billing_items')
          .select('total_price, status, item_type')
          .eq('customer_id', site.id)
          .neq('status', 'cancelled')
        if (error) throw error
        setBillingItems(data || [])
      } catch {
        setBillingItems([])
      } finally {
        setBillingLoading(false)
      }
    }
    fetchBilling()
  }, [site.id])

  const billingStats = useMemo(() => {
    const byStatus: Record<string, { amount: number; count: number }> = {
      paid: { amount: 0, count: 0 },
      invoiced: { amount: 0, count: 0 },
      approved: { amount: 0, count: 0 },
      pending: { amount: 0, count: 0 }
    }
    billingItems.forEach(i => {
      if (byStatus[i.status]) {
        byStatus[i.status].amount += i.total_price
        byStatus[i.status].count++
      }
    })
    const contractBilling = billingItems
      .filter(i => i.item_type === 'contract')
      .reduce((s, i) => s + i.total_price, 0)
    const adHocBilling = billingItems
      .filter(i => i.item_type === 'ad_hoc')
      .reduce((s, i) => s + i.total_price, 0)
    const total = contractBilling + adHocBilling
    return { byStatus, contractBilling, adHocBilling, total }
  }, [billingItems])

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-3">
        <div className="max-w-7xl mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">

          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 rounded-t-2xl">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold text-white">
                        {customer.company_name}
                      </h2>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Enskild kund
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {customer.contact_person || 'Kontaktperson ej angiven'}
                      </span>
                      <span className="text-blue-400">{customer.contact_email}</span>
                      {customer.organization_number && (
                        <span>• Org.nr: {customer.organization_number}</span>
                      )}
                      {customer.assigned_account_manager && (
                        <span>• Säljare: {customer.assigned_account_manager}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-400">Fakturerat</span>
                  </div>
                  {billingLoading ? (
                    <div className="animate-pulse h-6 w-24 bg-slate-700 rounded mt-1" />
                  ) : (
                    <>
                      <div className="text-lg font-semibold text-green-400">
                        {formatCurrency(billingStats.total)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs text-slate-500">
                          Avtal: {formatCurrency(billingStats.contractBilling)}
                        </div>
                        <div className="text-xs text-blue-400">
                          Tillägg: {formatCurrency(billingStats.adHocBilling)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-400">Avtalstid</span>
                  </div>
                  <div className={`text-lg font-semibold ${
                    contractProgress.status === 'expired' ? 'text-red-400' :
                    contractProgress.status === 'expiring-soon' ? 'text-amber-400' :
                    'text-green-400'
                  }`}>
                    {contractProgress.daysRemaining <= 0 ? 'Utgången' : `${contractProgress.monthsRemaining} mån kvar`}
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        contractProgress.status === 'expired' ? 'bg-red-400' :
                        contractProgress.status === 'expiring-soon' ? 'bg-amber-400' :
                        'bg-green-400'
                      }`}
                      style={{ width: `${contractProgress.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400">Health Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HealthScoreBadge
                      score={customer.overallHealthScore.score}
                      level={customer.overallHealthScore.level}
                      tooltip={customer.overallHealthScore.tooltip}
                      size="sm"
                      showIcon={false}
                    />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400">Churn Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChurnRiskBadge
                      risk={customer.highestChurnRisk.risk}
                      score={customer.highestChurnRisk.score}
                      tooltip={customer.highestChurnRisk.tooltip}
                      size="sm"
                      showIcon={false}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 space-y-5">

            {/* Customer Overview Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Kundöversikt</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Contact Information */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-slate-400" />
                    Kontaktinformation
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">Kontaktperson</div>
                        <div className="text-white font-medium">
                          {customer.contact_person || 'Kontaktperson ej angiven'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">E-postadress</div>
                        <a
                          href={`mailto:${customer.contact_email}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {customer.contact_email}
                        </a>
                      </div>
                    </div>

                    {customer.contact_phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Telefonnummer</div>
                          <a
                            href={`tel:${customer.contact_phone}`}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {customer.contact_phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {customer.contact_address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Adress</div>
                          <div className="text-white">{customer.contact_address}</div>
                        </div>
                      </div>
                    )}

                    {customer.organization_number && (
                      <div className="flex items-start gap-3">
                        <Hash className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Organisationsnummer</div>
                          <div className="text-white font-mono">{customer.organization_number}</div>
                        </div>
                      </div>
                    )}

                    {customer.assigned_account_manager && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Säljare</div>
                          <div className="text-white">{customer.assigned_account_manager}</div>
                          {customer.account_manager_email && (
                            <a
                              href={`mailto:${customer.account_manager_email}`}
                              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                            >
                              {customer.account_manager_email}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Portal Access Status */}
                    <div className="flex items-start gap-3 pt-3 border-t border-slate-700/50">
                      <Shield className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">Portalåtkomst</div>
                        <div className="mt-1">
                          <PortalAccessBadge
                            status={customer.portalAccessStatus}
                            tooltip={
                              customer.portalAccessStatus === 'full' ? 'Kund har fullständig portalåtkomst' :
                              customer.portalAccessStatus === 'partial' ? 'Kund har begränsad portalåtkomst' :
                              'Kund har ingen portalåtkomst'
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contract Overview */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-green-400" />
                    Kontraktsöversikt
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Totalt fakturerat</div>
                      {billingLoading ? (
                        <div className="animate-pulse h-7 w-32 bg-slate-700 rounded" />
                      ) : (
                        <>
                          <div className="text-xl font-bold text-green-400">
                            {formatCurrency(billingStats.total)}
                          </div>
                          <div className="space-y-1 mt-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">Avtalsfakturering:</span>
                              <span className="text-slate-300">{formatCurrency(billingStats.contractBilling)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">Tilläggstjänster:</span>
                              <span className="text-blue-400">{formatCurrency(billingStats.adHocBilling)}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-2">
                              Kontraktsvärde: {formatCurrency(contractValue)}/år
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-2">Kontraktsperiod</div>
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-semibold ${
                          contractProgress.status === 'expired' ? 'text-red-400' :
                          contractProgress.status === 'expiring-soon' ? 'text-amber-400' :
                          'text-green-400'
                        }`}>
                          {contractProgress.daysRemaining <= 0 ? 'Utgången' : `${contractProgress.monthsRemaining} månader kvar`}
                        </div>
                        {contractProgress.status === 'expiring-soon' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Löper ut snart
                          </span>
                        )}
                        {contractProgress.status === 'expired' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            Utgången
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Avtalstid förbrukad</span>
                          <span>{contractProgress.percentage}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              contractProgress.status === 'expired' ? 'bg-red-400' :
                              contractProgress.status === 'expiring-soon' ? 'bg-amber-400' :
                              'bg-green-400'
                            }`}
                            style={{ width: `${contractProgress.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Exakta kontraktsdatum */}
                      {(site.contract_start_date || site.contract_end_date) && (
                        <div className="text-sm text-slate-500 mt-2">
                          {site.contract_start_date && new Date(site.contract_start_date).toLocaleDateString('sv-SE', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                          {site.contract_start_date && site.contract_end_date && ' — '}
                          {site.contract_end_date && new Date(site.contract_end_date).toLocaleDateString('sv-SE', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </div>
                      )}
                    </div>

                    {/* Faktureringsstatus från contract_billing_items */}
                    <div className="pt-3 border-t border-slate-700/50">
                      <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                        <Coins className="w-4 h-4" />
                        Faktureringsstatus
                      </div>

                      {billingLoading ? (
                        <div className="text-center py-3">
                          <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-1" />
                          <p className="text-slate-400 text-xs">Laddar...</p>
                        </div>
                      ) : billingItems.length > 0 ? (
                        <div className="space-y-1.5">
                          {(['paid', 'invoiced', 'approved', 'pending'] as const).map(status => {
                            const data = billingStats.byStatus[status]
                            if (data.amount === 0 && data.count === 0) return null
                            return (
                              <div key={status} className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${STATUS_COLORS[status]}`}>
                                <span className="font-medium">{STATUS_LABELS[status]}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold">{formatCurrency(data.amount)}</span>
                                  <span className="opacity-70">{data.count} st</span>
                                </div>
                              </div>
                            )
                          })}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 text-sm">
                            <span className="text-slate-400">Totalt</span>
                            <span className="text-green-400 font-semibold">{formatCurrency(billingStats.total)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                          <div className="text-slate-400 text-sm">Inga faktureringsdata</div>
                          <div className="text-slate-500 text-xs mt-1">Data visas när avtalsfakturering genereras</div>
                        </div>
                      )}
                    </div>

                    {/* Additional customer info */}
                    {(customer.industry_category || customer.business_type || customer.customer_size) && (
                      <div className="pt-3 border-t border-slate-700/50">
                        <div className="grid grid-cols-1 gap-3">
                          {customer.industry_category && (
                            <div>
                              <div className="text-sm text-slate-400">Bransch</div>
                              <div className="text-white capitalize">{customer.industry_category}</div>
                            </div>
                          )}

                          {customer.business_type && (
                            <div>
                              <div className="text-sm text-slate-400">Verksamhetstyp</div>
                              <div className="text-white">{customer.business_type}</div>
                            </div>
                          )}

                          {customer.customer_size && (
                            <div>
                              <div className="text-sm text-slate-400">Företagsstorlek</div>
                              <div className="text-white capitalize">{customer.customer_size}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Cases Management Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Ärendehantering</h3>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <AdminCasesList
                  customerId={site.id}
                  organizationId={customer.organizationId || undefined}
                />
              </div>
            </section>

            {/* Separator */}
            <div className="border-t border-slate-700" />

            {/* Equipment Placement Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Utrustningsplacering</h3>
              </div>

              <CustomerEquipmentDualView
                customerId={site.id}
                customerName={customer.company_name}
              />
            </section>

            {/* Economic Analysis Section — ny faktureringsdata */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                  <Coins className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Ekonomisk Analys</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Revenue Breakdown — från contract_billing_items */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3">Fakturerad intäkt</h4>

                  {billingLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Laddar...</p>
                    </div>
                  ) : billingStats.total > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                          <span className="text-slate-300">Avtalsfakturering</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-semibold">{formatCurrency(billingStats.contractBilling)}</div>
                          {billingStats.total > 0 && (
                            <div className="text-xs text-slate-500">{((billingStats.contractBilling / billingStats.total) * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                          <span className="text-slate-300">Tilläggstjänster</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-semibold">{formatCurrency(billingStats.adHocBilling)}</div>
                          {billingStats.total > 0 && (
                            <div className="text-xs text-slate-500">{((billingStats.adHocBilling / billingStats.total) * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Totalt fakturerat:</span>
                          <span className="text-xl font-bold text-green-400">{formatCurrency(billingStats.total)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-slate-400 text-sm">Inga faktureringsdata registrerade</div>
                      <div className="text-slate-500 text-xs mt-1">Data visas när avtalsfakturering genereras</div>
                    </div>
                  )}
                </div>

                {/* Payment Status — från contract_billing_items */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3">Faktureringsstatus</h4>

                  {billingLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Laddar...</p>
                    </div>
                  ) : billingItems.length > 0 ? (
                    <div className="space-y-3">
                      {(['paid', 'invoiced', 'approved', 'pending'] as const).map(status => {
                        const data = billingStats.byStatus[status]
                        if (data.amount === 0 && data.count === 0) return null
                        return (
                          <div key={status} className={`flex items-center justify-between p-3 rounded-lg border ${STATUS_COLORS[status]}`}>
                            <span>{STATUS_LABELS[status]}</span>
                            <div className="text-right">
                              <div className="font-semibold">{formatCurrency(data.amount)}</div>
                              <div className="text-xs opacity-80">{data.count} poster</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-slate-400 text-sm">Inga faktureringsdata registrerade</div>
                      <div className="text-slate-500 text-xs mt-1">Status visas när fakturering genereras</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Health & Risk Metrics Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
                  <Activity className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Hälsa & Riskanalys</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Health Score Breakdown */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Health Score Uppdelning
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-300">Övergripande Health Score</span>
                      <HealthScoreBadge
                        score={customer.overallHealthScore.score}
                        level={customer.overallHealthScore.level}
                        tooltip={customer.overallHealthScore.tooltip}
                        size="md"
                      />
                    </div>

                    {/* Health Score Components */}
                    <div className="space-y-3">
                      {Object.entries(customer.overallHealthScore.breakdown).map(([key, data]) => {
                        const label = {
                          contractAge: 'Ålder på avtal',
                          communicationFrequency: 'Kommunikationsfrekvens',
                          supportTickets: 'Supportärenden',
                          paymentHistory: 'Betalningshistorik'
                        }[key] || key

                        const percentage = Math.round((data.weight * 100))
                        const scoreValue = Math.round(data.score)

                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">{label}</span>
                              <span className="text-slate-300">{scoreValue}/100 ({percentage}% vikt)</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  scoreValue >= 80 ? 'bg-green-400' :
                                  scoreValue >= 60 ? 'bg-yellow-400' :
                                  scoreValue >= 40 ? 'bg-orange-400' :
                                  'bg-red-400'
                                }`}
                                style={{ width: `${scoreValue}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Risk Analysis */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    Riskanalys
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-300">Churn Risk</span>
                      <ChurnRiskBadge
                        risk={customer.highestChurnRisk.risk}
                        score={customer.highestChurnRisk.score}
                        tooltip={customer.highestChurnRisk.tooltip}
                        size="md"
                      />
                    </div>

                    {/* Risk Factors */}
                    {customer.highestChurnRisk.factors && customer.highestChurnRisk.factors.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 mb-3">Riskfaktorer:</div>
                        {customer.highestChurnRisk.factors.map((factor, index) => (
                          <div key={index} className="flex items-start gap-2 p-2 bg-slate-700/30 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-300 text-sm">{factor}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Renewal Probability */}
                    <div className="pt-3 border-t border-slate-700/50">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Förnyelsesannolikhet</span>
                          <span className="text-slate-300">{Math.round(customer.averageRenewalProbability)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              customer.averageRenewalProbability >= 80 ? 'bg-green-400' :
                              customer.averageRenewalProbability >= 60 ? 'bg-yellow-400' :
                              customer.averageRenewalProbability >= 40 ? 'bg-orange-400' :
                              'bg-red-400'
                            }`}
                            style={{ width: `${customer.averageRenewalProbability}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contract Status Alerts */}
                    <div className="space-y-2">
                      {customer.hasExpiringSites && (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-400 text-sm">Avtal går ut inom 90 dagar</span>
                        </div>
                      )}

                      {customer.highestChurnRisk.risk === 'high' && (
                        <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 text-sm">Hög risk för kundförlust</span>
                        </div>
                      )}

                      {!customer.is_active && (
                        <div className="flex items-center gap-2 p-2 bg-slate-500/10 rounded-lg border border-slate-500/20">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-400 text-sm">Kunden är markerad som inaktiv</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 rounded-b-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Senast uppdaterad: {customer.updated_at ?
                  new Date(customer.updated_at).toLocaleString('sv-SE') :
                  'Okänt'
                }
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Stäng
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
