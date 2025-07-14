// 📁 src/pages/admin/TechnicianCommissions.tsx - Huvudsida för provisionshantering
import React, { useState } from 'react'
import { ArrowLeft, Wallet, AlertCircle, RefreshCw, Users, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCommissionDashboard } from '../../hooks/useCommissionDashboard'

// Components
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CommissionSummaryCards from '../../components/admin/commissions/CommissionSummaryCards'
import CommissionMonthSelector from '../../components/admin/commissions/CommissionMonthSelector'
import CommissionTechnicianFilter from '../../components/admin/commissions/CommissionTechnicianFilter'
import CommissionChart from '../../components/admin/commissions/CommissionChart'
import CommissionDetailsTable from '../../components/admin/commissions/CommissionDetailsTable'
import CommissionExportButtons from '../../components/admin/commissions/CommissionExportButtons'

// Modal för ärendedetaljer (återanvänd från billing)
import type { CommissionCaseDetail } from '../../types/commission'

const TechnicianCommissions: React.FC = () => {
  const navigate = useNavigate()
  const [selectedCase, setSelectedCase] = useState<CommissionCaseDetail | null>(null)
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  // Hook för dashboard state
  const {
    selectedMonth,
    selectedTechnician,
    availableTechnicians,
    monthOptions,
    loading,
    error,
    kpis,
    monthlyData,
    technicianSummaries,
    caseDetails,
    calculations,
    canNavigatePrev,
    canNavigateNext,
    navigateMonth,
    goToMonth,
    setTechnicianFilter,
    refreshData,
    isDataEmpty,
    hasMultipleTechnicians,
    selectedMonthDisplay,
    selectedTechnicianDisplay
  } = useCommissionDashboard()

  // Error handling
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">
              Kunde inte ladda provisionsdata
            </h2>
            <p className="text-red-300 mb-6">{error}</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={refreshData}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Försök igen</span>
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Tillbaka</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Provisionshantering
                  </h1>
                  <p className="text-slate-400">
                    {selectedTechnicianDisplay === 'Alla tekniker' 
                      ? `${availableTechnicians.length - 1} tekniker`
                      : selectedTechnicianDisplay
                    } • {selectedMonthDisplay}
                  </p>
                </div>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={refreshData}
                disabled={loading}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
                  ${loading
                    ? 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
                    : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
                  }
                `}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Uppdatera</span>
              </button>

              {/* Chart type toggle */}
              <div className="flex items-center bg-slate-800 border border-slate-600 rounded-lg p-1">
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1 text-sm rounded transition-all duration-200 ${
                    chartType === 'line'
                      ? 'bg-green-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Linje
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1 text-sm rounded transition-all duration-200 ${
                    chartType === 'bar'
                      ? 'bg-green-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Stapel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation controls */}
        <CommissionMonthSelector
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={goToMonth}
          onNavigate={navigateMonth}
          canNavigatePrev={canNavigatePrev}
          canNavigateNext={canNavigateNext}
          loading={loading}
        />

        {/* Tekniker filter */}
        {hasMultipleTechnicians && (
          <div className="mb-8">
            <CommissionTechnicianFilter
              selectedTechnician={selectedTechnician}
              availableTechnicians={availableTechnicians}
              onTechnicianChange={setTechnicianFilter}
              loading={loading}
              className="max-w-md"
            />
          </div>
        )}

        {loading && !kpis.total_commission ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <CommissionSummaryCards
              kpis={kpis}
              loading={loading}
              monthDisplay={selectedMonthDisplay}
            />

            {/* Content based on data availability */}
            {isDataEmpty ? (
              <div className="text-center py-20">
                <div className="p-4 bg-slate-800/50 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <Users className="w-10 h-10 text-slate-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-400 mb-4">
                  Inga provisioner för {selectedMonthDisplay}
                </h2>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                  {selectedTechnician.id === 'all'
                    ? 'Det finns inga avslutade ärenden med provision för denna månad.'
                    : `${selectedTechnician.name} har inga avslutade ärenden med provision för denna månad.`
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => navigateMonth('prev')}
                    disabled={!canNavigatePrev}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Föregående månad
                  </button>
                  {selectedTechnician.id !== 'all' && (
                    <button
                      onClick={() => setTechnicianFilter({ id: 'all', name: 'Alla tekniker' })}
                      className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      Visa alla tekniker
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Chart section */}
                <div className="mb-8">
                  <CommissionChart
                    data={monthlyData}
                    loading={loading}
                    selectedTechnician={selectedTechnician.id}
                    chartType={chartType}
                    height={400}
                  />
                </div>

                {/* Export section */}
                <div className="mb-8">
                  <CommissionExportButtons
                    cases={caseDetails}
                    month={selectedMonth.value}
                    monthDisplay={selectedMonthDisplay}
                    disabled={loading || caseDetails.length === 0}
                  />
                </div>

                {/* Details table */}
                <CommissionDetailsTable
                  cases={caseDetails}
                  loading={loading}
                  onCaseClick={setSelectedCase}
                  showTechnicianColumn={selectedTechnician.id === 'all'}
                  groupByTechnician={selectedTechnician.id === 'all' && caseDetails.length > 10}
                />

                {/* Insights section */}
                {calculations.topPerformer && selectedTechnician.id === 'all' && (
                  <div className="mt-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">
                        Månadens insights
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-green-400 font-medium mb-1">🏆 Topprestanda</p>
                        <p className="text-white">
                          {calculations.topPerformer.technician_name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {new Intl.NumberFormat('sv-SE', { 
                            style: 'currency', 
                            currency: 'SEK', 
                            minimumFractionDigits: 0 
                          }).format(calculations.topPerformer.total_commission)} • {calculations.topPerformer.case_count} ärenden
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-green-400 font-medium mb-1">📊 Genomsnitt</p>
                        <p className="text-white">
                          {new Intl.NumberFormat('sv-SE', { 
                            style: 'currency', 
                            currency: 'SEK', 
                            minimumFractionDigits: 0 
                          }).format(calculations.avgCommissionPerTechnician)} per tekniker
                        </p>
                        <p className="text-sm text-slate-400">
                          {new Intl.NumberFormat('sv-SE', { 
                            style: 'currency', 
                            currency: 'SEK', 
                            minimumFractionDigits: 0 
                          }).format(calculations.avgCommissionPerCase)} per ärende
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-green-400 font-medium mb-1">👥 Aktivitet</p>
                        <p className="text-white">
                          {calculations.uniqueTechniciansInSelection} aktiva tekniker
                        </p>
                        <p className="text-sm text-slate-400">
                          {((calculations.uniqueTechniciansInSelection / (availableTechnicians.length - 1)) * 100).toFixed(0)}% av teamet
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Case details modal */}
      {selectedCase && (
        <CaseDetailsModal
          case_={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </div>
  )
}

// Simpel modal för ärendedetaljer (återanvänd logik från BillingManagement)
interface CaseDetailsModalProps {
  case_: CommissionCaseDetail | null
  isOpen: boolean
  onClose: () => void
}

const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  if (!isOpen || !case_) return null

  const formatAddress = (address: any): string => {
    if (!address) return 'Ingen adress angiven'
    
    if (typeof address === 'string') {
      if (address.startsWith('{') && address.includes('formatted_address')) {
        try {
          const parsed = JSON.parse(address)
          return parsed.formatted_address || 'Ingen adress angiven'
        } catch (e) {
          return address
        }
      }
      return address
    }
    
    if (typeof address === 'object') {
      if (address.formatted_address) {
        return address.formatted_address
      }
      
      const parts = []
      if (address.street) parts.push(address.street)
      if (address.city) parts.push(address.city)
      if (address.postalCode || address.postal_code) parts.push(address.postalCode || address.postal_code)
      if (address.country) parts.push(address.country)
      
      return parts.length > 0 ? parts.join(', ') : 'Ingen adress angiven'
    }
    
    return 'Ingen adress angiven'
  }

  const formatCustomerInfo = (case_: CommissionCaseDetail): string => {
    const parts = []
    
    if (case_.type === 'business') {
      if (case_.bestallare) {
        parts.push(case_.bestallare)
      } else if (case_.kontaktperson) {
        parts.push(case_.kontaktperson)
      }
      
      if (case_.org_nr) {
        parts.push(`(${case_.org_nr})`)
      }
    } else {
      if (case_.kontaktperson) {
        parts.push(case_.kontaktperson)
      }
    }
    
    return parts.length > 0 ? parts.join(' ') : 'Okänd kund'
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              case_.type === 'private' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {case_.type === 'private' ? (
                <Users className="w-5 h-5" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {case_.case_number || case_.id.slice(0, 8)}
              </h2>
              <p className="text-sm text-slate-400">
                {case_.type === 'private' ? 'Privatperson' : 'Företag'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Grundinfo */}
          <div>
            <h3 className="text-white font-medium mb-3">Ärendeinformation</h3>
            <div className="bg-slate-700/30 rounded-lg p-4 space-y-3">
              <div>
                <span className="text-slate-400 text-sm">Titel:</span>
                <p className="text-white">{case_.title}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Kund:</span>
                <p className="text-white">{formatCustomerInfo(case_)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Adress:</span>
                <p className="text-white">{formatAddress(case_.adress)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Tekniker:</span>
                <p className="text-white">{case_.primary_assignee_name || 'Ej tilldelad'}</p>
              </div>
            </div>
          </div>

          {/* Ekonomi */}
          <div>
            <h3 className="text-white font-medium mb-3">Ekonomisk information</h3>
            <div className="bg-slate-700/30 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Ärendepris:</span>
                <span className="text-white font-medium">
                  {new Intl.NumberFormat('sv-SE', { 
                    style: 'currency', 
                    currency: 'SEK', 
                    minimumFractionDigits: 0 
                  }).format(case_.case_price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Provision (5%):</span>
                <span className="text-green-400 font-bold">
                  {new Intl.NumberFormat('sv-SE', { 
                    style: 'currency', 
                    currency: 'SEK', 
                    minimumFractionDigits: 0 
                  }).format(case_.commission_amount || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Slutfört:</span>
                <span className="text-white">
                  {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicianCommissions