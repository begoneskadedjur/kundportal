// 📁 src/pages/technician/TechnicianDashboard.tsx - FIXAD FÖR PROFILE DATA

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  DollarSign, FileText, ClipboardList, Calendar, 
  TrendingUp, Award, Clock, AlertCircle,
  Plus, Eye, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'

const formatAddress = (address: any): string => {
  if (!address) return 'Saknas';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } }
  return 'Okänt format';
};

// Interface för EditCaseModal compatibility - KOMPLETT med alla fält
interface TechnicianCase {
  id: string;
  clickup_task_id: string;
  case_number?: string;
  title: string;
  status: string;
  priority?: string;
  case_type: 'private' | 'business' | 'contract';
  created_date: string;
  start_date?: string;
  due_date?: string;
  completed_date?: string;
  commission_amount?: number;
  case_price?: number;
  kontaktperson?: string;
  telefon_kontaktperson?: string;
  e_post_kontaktperson?: string;
  adress?: any;
  foretag?: string;
  org_nr?: string;
  skadedjur?: string;
  description?: string;
  clickup_url?: string;
  assignee_name?: string;
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
  personnummer?: string;
  material_cost?: number;
  time_spent_minutes?: number;
  work_started_at?: string;
  // ROT/RUT fält
  r_rot_rut?: string;
  r_fastighetsbeteckning?: string;
  r_arbetskostnad?: number;
  r_material_utrustning?: string;
  r_servicebil?: string;
  // Rapport
  rapport?: string;
  // Övriga fält från databas
  priority?: string;
  case_number?: string;
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
  filer?: any;
  reklamation?: string;
  avvikelser_tillbud_olyckor?: string;
  annat_skadedjur?: string;
  skicka_bokningsbekraftelse?: string;
}

interface DashboardData {
  stats: {
    total_commission_ytd: number;
    total_cases_ytd: number;
    avg_commission_per_case: number;
    current_month_commission: number;
    pending_cases: number;
    completed_cases_this_month: number;
    technician_name?: string;
    technician_email?: string;
  }
  monthly_data: Array<{
    month: string;
    month_display: string;
    total_commission: number;
    case_count: number;
    avg_commission_per_case: number;
  }>
  recent_cases: Array<{
    id: string;
    clickup_task_id: string;
    title: string;
    status: string;
    case_type: 'private' | 'business';
    completed_date?: string;
    commission_amount?: number;
  }>
  pending_cases: Array<{
    id: string;
    clickup_task_id: string;
    title: string;  
    status: string;
    case_type: 'private' | 'business';
    created_at: string;
    kontaktperson?: string;
    foretag?: string;
    adress?: string;
  }>
}

export default function TechnicianDashboard() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [showPendingCases, setShowPendingCases] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null)

  // ✅ FIXAD: Använd profile data istället för technician prop
  const technicianId = profile?.technician_id
  const technicianData = profile?.technicians
  const displayName = technicianData?.name || profile?.display_name || 'Tekniker'

  useEffect(() => {
    if (profile && !isTechnician) {
      navigate('/login', { replace: true })
      return
    }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && technicianId) {
      fetchDashboardData()
    }
  }, [isTechnician, technicianId])

  // Modal handlers
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedCase(null)
  }

  const handleUpdateSuccess = () => {
    // Refetch dashboard data efter uppdatering
    fetchDashboardData()
  }

  const handleOpenCase = (pendingCase: any) => {
    // Konvertera pending case till TechnicianCase format med ALLA fält
    const technicianCase: TechnicianCase = {
      id: pendingCase.id,
      clickup_task_id: pendingCase.clickup_task_id,
      title: pendingCase.title,
      status: pendingCase.status,
      case_type: pendingCase.case_type,
      created_date: pendingCase.created_at,
      description: pendingCase.description,
      kontaktperson: pendingCase.kontaktperson,
      telefon_kontaktperson: pendingCase.telefon_kontaktperson,
      e_post_kontaktperson: pendingCase.e_post_kontaktperson,
      skadedjur: pendingCase.skadedjur,
      personnummer: pendingCase.personnummer,
      org_nr: pendingCase.org_nr,
      foretag: pendingCase.foretag,
      adress: pendingCase.adress,
      case_price: pendingCase.pris,
      material_cost: pendingCase.material_cost,
      time_spent_minutes: pendingCase.time_spent_minutes,
      work_started_at: pendingCase.work_started_at,
      start_date: pendingCase.start_date,
      due_date: pendingCase.due_date,
      // ROT/RUT fält (bara för privatpersoner)
      r_rot_rut: pendingCase.r_rot_rut,
      r_fastighetsbeteckning: pendingCase.r_fastighetsbeteckning,
      r_arbetskostnad: pendingCase.r_arbetskostnad,
      r_material_utrustning: pendingCase.r_material_utrustning,
      r_servicebil: pendingCase.r_servicebil,
      // Rapport
      rapport: pendingCase.rapport,
      // Övriga fält
      priority: pendingCase.priority,
      case_number: pendingCase.case_number,
      billing_status: pendingCase.billing_status,
    }
    setSelectedCase(technicianCase)
    setIsEditModalOpen(true)
  }

  const fetchDashboardData = async () => {
    if (!technicianId) {
      setError('Ingen tekniker-ID tillgänglig');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/technician/dashboard?technician_id=${technicianId}`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`)
      }
      const dashboardData = await response.json()
      setData(dashboardData)
    } catch (error) {
      console.error('💥 Error fetching dashboard data:', error)
      setError(error instanceof Error ? error.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda data</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} className="w-full">
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }
  
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-slate-400">Ingen data tillgänglig</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Välkommen, {displayName}! 👷‍♂️
              </h1>
              <p className="text-slate-400 mt-1">
                Din personliga översikt över provisioner, ärenden och verktyg
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => navigate('/admin/oneflow-contract-creator')}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa Avtal
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total Provision i år</p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.stats.total_commission_ytd)}</p>
                <p className="text-green-300 text-xs mt-1">{data.stats.total_cases_ytd} ärenden</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Denna månad</p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.stats.current_month_commission)}</p>
                <p className="text-blue-300 text-xs mt-1">{data.stats.completed_cases_this_month} avslutade</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm font-medium">Snitt per ärende</p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.stats.avg_commission_per_case)}</p>
                <p className="text-purple-300 text-xs mt-1">Genomsnittlig provision</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 bg-gradient-to-br from-orange-500/20 to-red-600/20 border-orange-500/30 cursor-pointer hover:from-orange-500/30 hover:to-red-600/30 transition-all"
            onClick={() => setShowPendingCases(!showPendingCases)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-sm font-medium">Pågående ärenden</p>
                <p className="text-2xl font-bold text-white mt-1">{data.stats.pending_cases}</p>
                <p className="text-orange-300 text-xs mt-1">Klicka för att se alla</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
                {showPendingCases ? (
                  <ChevronUp className="w-5 h-5 text-orange-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-orange-400" />
                )}
              </div>
            </div>
          </Card>
        </div>

        {showPendingCases && data.pending_cases && data.pending_cases.length > 0 && (
          <Card className="p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Pågående ärenden ({data.pending_cases.length})
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPendingCases(false)}
                className="flex items-center gap-2"
              >
                <ChevronUp className="w-4 h-4" />
                Dölj
              </Button>
            </div>
            <div className="space-y-3">
              {data.pending_cases.map(case_ => (
                <div 
                  key={case_.id} 
                  className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors cursor-pointer"
                  onClick={() => handleOpenCase(case_)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-white text-sm truncate">{case_.title}</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                        {case_.status}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-600/50 text-slate-300">
                        {case_.case_type === 'private' ? 'Privat' : 'Företag'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 text-xs">
                      {case_.kontaktperson && (
                        <span>👤 {case_.kontaktperson}</span>
                      )}
                      {case_.foretag && (
                        <span>🏢 {case_.foretag}</span>
                      )}
                      {case_.adress && (
                        <span>📍 {formatAddress(case_.adress)}</span>
                      )}
                      <span>📅 {formatDate(case_.created_at)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" />Månadsöversikt</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/technician/commissions')} className="flex items-center gap-2"><Eye className="w-4 h-4" />Visa alla</Button>
            </div>
            {data.monthly_data.length > 0 ? (
              <div className="space-y-4">
                {data.monthly_data.slice(0, 3).map(month => (
                  <div key={month.month} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{month.month_display}</p>
                      <p className="text-sm text-slate-400">{month.case_count} ärenden</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">{formatCurrency(month.total_commission)}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(month.avg_commission_per_case)}/ärende</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-400">Ingen månadsdata tillgänglig ännu</p>
              </div>
            )}
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-blue-500" />Senaste ärenden</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/technician/cases')} className="flex items-center gap-2"><Eye className="w-4 h-4" />Visa alla</Button>
            </div>
            <div className="space-y-3">
              {data.recent_cases.length > 0 ? (
                data.recent_cases.slice(0, 5).map(case_ => (
                  <div key={case_.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white text-sm truncate">{case_.title}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${case_.status?.toLowerCase().includes('avslutat') ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{case_.status}</span>
                      </div>
                      <p className="text-slate-400 text-xs">{case_.case_type === 'private' ? 'Privat' : 'Företag'}{case_.completed_date && ` • ${formatDate(case_.completed_date)}`}</p>
                    </div>
                    {case_.commission_amount && case_.commission_amount > 0 && (
                      <div className="text-right">
                        <p className="text-green-400 font-medium text-sm">{formatCurrency(case_.commission_amount)}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">Inga ärenden att visa</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-500" />Snabbåtgärder</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <button onClick={() => navigate('/technician/schedule')} className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-pink-600/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30 transition-colors"><Calendar className="w-5 h-5 text-purple-400" /></div>
                <div className="text-left"><p className="font-medium text-white">Mitt Schema</p><p className="text-purple-300 text-sm">Kalenderöversikt</p></div>
                <ArrowRight className="w-4 h-4 text-purple-400 ml-auto" />
              </div>
            </button>
            
            <button onClick={() => navigate('/technician/cases')} className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-lg hover:from-blue-500/30 hover:to-cyan-600/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors"><ClipboardList className="w-5 h-5 text-blue-400" /></div>
                <div className="text-left"><p className="font-medium text-white">Mina Ärenden</p><p className="text-blue-300 text-sm">Lista & detaljer</p></div>
                <ArrowRight className="w-4 h-4 text-blue-400 ml-auto" />
              </div>
            </button>

            <button onClick={() => navigate('/technician/commissions')} className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-lg hover:from-green-500/30 hover:to-emerald-600/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/30 transition-colors"><DollarSign className="w-5 h-5 text-green-400" /></div>
                <div className="text-left"><p className="font-medium text-white">Mina Provisioner</p><p className="text-green-300 text-sm">Månadsöversikt</p></div>
                <ArrowRight className="w-4 h-4 text-green-400 ml-auto" />
              </div>
            </button>
            
            <button onClick={() => navigate('/admin/oneflow-contract-creator')} className="p-4 bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/30 rounded-lg hover:from-slate-500/30 hover:to-slate-600/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center group-hover:bg-slate-500/30 transition-colors"><FileText className="w-5 h-5 text-slate-400" /></div>
                <div className="text-left"><p className="font-medium text-white">Skapa Avtal</p><p className="text-slate-300 text-sm">Generera nya kontrakt</p></div>
                <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
            </button>

          </div>
        </Card>
      </main>

      <EditCaseModal 
        isOpen={isEditModalOpen} 
        onClose={handleCloseEditModal} 
        onSuccess={handleUpdateSuccess} 
        caseData={selectedCase} 
      />
    </div>
  )
}